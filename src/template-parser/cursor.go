package main

import (
	"errors"
)

type RenderAttribute struct {
	AttributeName     string `json:"name"`
	AttributeModifier string `json:"modifier,omitempty"`
	AttributeValue    string `json:"value,omitempty"`
}

type StaticAttribute struct {
	AttributeName  string `json:"name"`
	AttributeValue string `json:"value,omitempty"`
}

func isVoidElement(tagName string) bool {
	return tagName == "area" || tagName == "base" || tagName == "br" || tagName == "col" || tagName == "embed" || tagName == "hr" || tagName == "img" || tagName == "input" || tagName == "link" || tagName == "meta" || tagName == "param" || tagName == "source" || tagName == "track" || tagName == "wbr"
}

func isWhiteSpace(char rune) bool {
	return char == ' ' || char == '\t' || char == '\n' || char == '\r' || char == '\f'
}

// There are more strict rules for the first character in a tag name; it must be a letter
func isLegalLeadingTagNameChar(char rune) bool {
	return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char == ':' || char == '_'
}

func isEndOfTagChar(char rune) bool {
	return char == '>' || char == '/'
}

func isAttributeValueQuoteChar(char rune) bool {
	return char == '"' || char == '\'' || char == '`'
}

func isLegalTagOrAttributeNameChar(char rune) bool {
	return !isWhiteSpace(char) && !isAttributeValueQuoteChar(char) && !isEndOfTagChar(char) && char != '='
}

func isLegalUnquotedAttributeValueChar(char rune) bool {
	return !isWhiteSpace(char) && !isAttributeValueQuoteChar(char) && !isEndOfTagChar(char) && char != '<'
}

func flattenWhiteSpace(str string, shouldFlattenIntermediateSpace bool, shouldStripLeadingSpace bool, shouldStripTrailingSpace bool) string {
	index := 0
	strLen := len(str)

	for index < strLen {
		if !isWhiteSpace(rune(str[index])) {
			// Skip over non-whitespace characters
			index++
			continue
		}

		// We hit whitespace! Let's keep going until we hit the end of this group of whitespace and then figure out how to flatten it
		whiteSpaceGroupStartIndex := index
		index++

		for index < strLen && isWhiteSpace(rune(str[index])) {
			index++
		}
		whiteSpaceGroupEndIndex := index

		isLeading := whiteSpaceGroupStartIndex == 0
		isTrailing := whiteSpaceGroupEndIndex >= strLen

		shouldStripSpace := (isLeading && shouldStripLeadingSpace) || (isTrailing && shouldStripTrailingSpace)

		if isLeading {
			str = str[whiteSpaceGroupEndIndex:]
			index = 1
			if !shouldStripSpace {
				str = " " + str
				index++
			}
		} else if isTrailing {
			str = str[:whiteSpaceGroupStartIndex]
			if !shouldStripSpace {
				str = str + " "
			}
			index = len(str)
		} else if shouldFlattenIntermediateSpace {
			beforeWhiteSpace := str[:whiteSpaceGroupStartIndex]
			afterWhiteSpace := str[whiteSpaceGroupEndIndex:]
			// All other whitespace should be flattened to a single space
			str = beforeWhiteSpace + " " + afterWhiteSpace
			index = whiteSpaceGroupStartIndex + 1
		}

		strLen = len(str)
	}

	return str
}

type Cursor struct {
	index    int
	str      string
	maxIndex int
}

func (c *Cursor) At(index int) (rune, error) {
	if index < 0 || index > c.maxIndex {
		return 0, errors.New("index out of bounds")
	}

	return rune(c.str[index]), nil
}

func (c *Cursor) Peek(peekAmount int) (rune, error) {
	return c.At(c.index + peekAmount)
}

func (c *Cursor) CurrentChar() (rune, error) {
	return c.At(c.index)
}

func (c *Cursor) AdvanceChar(amount ...int) (rune, error) {
	if len(amount) > 0 {
		c.index += amount[0]
	} else {
		c.index++
	}
	return c.CurrentChar()
}

func (c *Cursor) SkipWhiteSpace() (rune, error) {
	ch, err := c.CurrentChar()
	for err == nil && isWhiteSpace(ch) {
		ch, err = c.AdvanceChar()
	}

	return ch, err
}

func (c *Cursor) IsOpeningTagAhead() bool {
	ch, err := c.CurrentChar()

	if err != nil || ch != '<' {
		return false
	}

	ch, err = c.Peek(1)

	return err == nil && isLegalLeadingTagNameChar(ch)
}

func (c *Cursor) IsClosingTagAhead() bool {
	ch, err := c.CurrentChar()

	if err != nil || ch != '<' {
		return false
	}

	ch, err = c.Peek(1)

	if err != nil || ch != '/' {
		return false
	}

	ch, err = c.Peek(2)

	return err == nil && isLegalLeadingTagNameChar(ch)
}

func (c *Cursor) IsCommentOpenTagAhead() bool {
	ch, err := c.CurrentChar()

	if err != nil || ch != '<' {
		return false
	}

	ch, err = c.Peek(1)

	if err != nil || ch != '!' {
		return false
	}

	ch, err = c.Peek(2)

	if err != nil || ch != '-' {
		return false
	}

	ch, err = c.Peek(3)

	return err == nil && ch == '-'
}

func (c *Cursor) IsCommentCloseTagAhead() bool {
	ch, err := c.CurrentChar()

	if err != nil || ch != '-' {
		return false
	}

	ch, err = c.Peek(1)

	if err != nil || ch != '-' {
		return false
	}

	ch, err = c.Peek(2)

	return err == nil && ch == '>'
}

func (c *Cursor) SkipComment() {
	_, err := c.CurrentChar()
	for err == nil && !c.IsCommentCloseTagAhead() {
		_, err = c.AdvanceChar()
	}

	// Skip past the comment close tag
	c.AdvanceChar(3)
}

func (c *Cursor) ReadUntilTag(shouldPreserveWhiteSpace bool, childIndex int) (string, bool) {
	textStartIndex := c.index

	isClosingTag := false

	_, err := c.CurrentChar()

	for err == nil {
		if c.IsOpeningTagAhead() {
			break
		} else if c.IsClosingTagAhead() {
			isClosingTag = true
			break
		} else if c.IsCommentOpenTagAhead() {
			commentStartIndex := c.index
			c.SkipComment()
			commentEndIndex := c.index
			// Strip the comment from the string
			c.str = c.str[:commentStartIndex] + c.str[commentEndIndex:]
			c.maxIndex = len(c.str) - 1
			// Roll the cursor back to the start of the comment
			_, err = c.AdvanceChar(commentStartIndex - commentEndIndex)
		} else {
			_, err = c.AdvanceChar()
		}
	}

	textEndIndex := c.index

	textContent := c.str[textStartIndex:textEndIndex]

	if !shouldPreserveWhiteSpace {
		textContent = flattenWhiteSpace(
			textContent,
			true,
			// If this is the first child of an element, strip leading whitespace
			childIndex == 0,
			// If we just encountered a closing tag, meaning this is the last child of an element, strip trailing whitespace
			isClosingTag,
		)
	}

	return textContent, isClosingTag
}

func (c *Cursor) ReadTagName() string {
	startIndex := c.index

	ch, err := c.CurrentChar()

	for err == nil && isLegalTagOrAttributeNameChar(ch) {
		ch, err = c.AdvanceChar()
	}

	return c.str[startIndex:c.index]
}

func (c *Cursor) ReadOpeningTagAttributes() ([]StaticAttribute, []RenderAttribute) {
	var staticAttributes []StaticAttribute = nil
	var renderAttributes []RenderAttribute = nil

	ch, err := c.CurrentChar()

	for err == nil && !isEndOfTagChar(ch) {
		// Skip until we hit a legal attribute name character
		for err == nil && !isEndOfTagChar(ch) && !isLegalTagOrAttributeNameChar(ch) {
			ch, err = c.AdvanceChar()
		}

		if !isLegalTagOrAttributeNameChar(ch) {
			// If the character we landed on isn't a legal attribute name character, we're done
			break
		}

		isDynamicAttribute := ch == ':'
		isRenderAttribute := isDynamicAttribute || ch == '#'
		renderAttributeModifierIndex := -1

		// Skip the : or # char
		if isRenderAttribute {
			ch, err = c.AdvanceChar()
		}

		if isRenderAttribute && renderAttributes == nil {
			renderAttributes = []RenderAttribute{}
		} else if !isRenderAttribute && staticAttributes == nil {
			staticAttributes = []StaticAttribute{}
		}

		attributeNameStartIndex := c.index

		for err == nil && isLegalTagOrAttributeNameChar(ch) {
			if isRenderAttribute && (ch == ':') {
				renderAttributeModifierIndex = c.index
			}
			ch, err = c.AdvanceChar()
		}

		var attributeName string
		var attributeModifier string

		if isDynamicAttribute {
			attributeName = "#attr"
			attributeModifier = c.str[attributeNameStartIndex:c.index]
		} else if isRenderAttribute {
			if renderAttributeModifierIndex != -1 {
				attributeName = c.str[attributeNameStartIndex:renderAttributeModifierIndex]
				attributeModifier = c.str[renderAttributeModifierIndex+1 : c.index]
			} else {
				attributeName = c.str[attributeNameStartIndex:c.index]
			}
		} else {
			attributeName = c.str[attributeNameStartIndex:c.index]
		}

		if ch != '=' {
			if isRenderAttribute {
				renderAttributes = append(renderAttributes, RenderAttribute{AttributeName: attributeName, AttributeModifier: attributeModifier})
			} else {
				staticAttributes = append(staticAttributes, StaticAttribute{AttributeName: attributeName})
			}
			continue
		}

		// Skip the =
		c.AdvanceChar()

		// Skip any whitespace between the = and the attribute value
		ch, err = c.SkipWhiteSpace()

		if err != nil {
			// If we hit the end of the file before reaching an attribute value,
			// call the value an empty string
			if isRenderAttribute {
				renderAttributes = append(renderAttributes, RenderAttribute{AttributeName: attributeName, AttributeModifier: attributeModifier})
			} else {
				staticAttributes = append(staticAttributes, StaticAttribute{AttributeName: attributeName})
			}
			break
		}

		if isAttributeValueQuoteChar(ch) {
			// This is a quoted attribute value, so we need to find the closing quote char
			openingQuoteChar := ch

			// Skip the opening quote char
			ch, err = c.AdvanceChar()

			if err != nil {
				break
			}

			valueStartIndex := c.index

			for err == nil {
				if ch == openingQuoteChar {
					prevChar, err := c.Peek(-1)

					// Only stop if the quote char isn't escaped
					if err == nil && prevChar != '\\' {
						break
					}
				}

				ch, err = c.AdvanceChar()
			}

			attributeValue := c.str[valueStartIndex:c.index]
			if isRenderAttribute {
				renderAttributes = append(renderAttributes, RenderAttribute{
					AttributeName:     attributeName,
					AttributeModifier: attributeModifier,
					AttributeValue:    attributeValue,
				})
			} else {
				staticAttributes = append(staticAttributes, StaticAttribute{
					AttributeName:  attributeName,
					AttributeValue: attributeValue,
				})
			}

			// Skip the closing quote char
			ch, err = c.AdvanceChar()
		} else {
			valueStartIndex := c.index

			for err == nil && isLegalUnquotedAttributeValueChar(ch) {
				ch, err = c.AdvanceChar()
			}

			attributeValue := c.str[valueStartIndex:c.index]
			if isRenderAttribute {
				renderAttributes = append(renderAttributes, RenderAttribute{
					AttributeName:     attributeName,
					AttributeModifier: attributeModifier,
					AttributeValue:    attributeValue,
				})
			} else {
				staticAttributes = append(staticAttributes, StaticAttribute{
					AttributeName:  attributeName,
					AttributeValue: attributeValue,
				})
			}
		}
	}

	return staticAttributes, renderAttributes
}

func (c *Cursor) ReadOpeningTag() (string, []StaticAttribute, []RenderAttribute, bool) {
	ch, err := c.CurrentChar()

	// If cursor is on the "<" char, skip it
	if err == nil && ch == '<' {
		c.AdvanceChar()
	}

	tagName := c.ReadTagName()

	staticAttributes, renderAttributes := c.ReadOpeningTagAttributes()

	ch, err = c.CurrentChar()

	// Advance the cursor to the end of the tag
	for err == nil && ch != '>' {
		ch, err = c.AdvanceChar()
	}

	// Increment the cursor one last time past the end of the tag
	c.AdvanceChar()

	return tagName, staticAttributes, renderAttributes, isVoidElement(tagName)
}

func (c *Cursor) ReadClosingTag() string {
	ch, err := c.CurrentChar()

	if err != nil {
		return ""
	}

	if ch == '<' {
		_, err = c.AdvanceChar(2)
	} else if ch == '/' {
		_, err = c.AdvanceChar()
	}

	if err != nil {
		return ""
	}

	tagName := c.ReadTagName()

	ch, err = c.CurrentChar()

	// Advance the cursor to the end of the closing tag
	for err == nil && ch != '>' {
		ch, err = c.AdvanceChar()
	}

	if err == nil {
		// Increment the cursor one last time past the end of closing tag
		ch, err = c.AdvanceChar()

		if err == nil && ch == '\n' {
			// If there's a newline after the closing tag, skip it as well
			c.AdvanceChar()
		}
	}

	return tagName
}

// Reads the content of a tag as a string without parsing it
func (c *Cursor) ReadRawTagTextContent(tagName string, shouldPreserveWhitespace bool) string {
	if !shouldPreserveWhitespace {
		c.SkipWhiteSpace()
	}

	contentStartIndex := c.index
	contentEndIndex := c.index

	_, err := c.CurrentChar()

	for err == nil {
		// Keep going until we hit a closing tag with the same name as the opening tag
		if c.IsClosingTagAhead() {
			// If this looks like a closing tag, hang onto the current index as the potential end
			// of the tag's content; ReadClosingTag will advance the cursor index past the closing tag
			// and we don't want to include any of that in the returned content
			contentEndIndex = c.index
			closingTagName := c.ReadClosingTag()
			if closingTagName == tagName {
				break
			}
		} else {
			_, err = c.AdvanceChar()
		}

		contentEndIndex = c.index
	}

	textContent := c.str[contentStartIndex:contentEndIndex]

	if !shouldPreserveWhitespace {
		textContent = flattenWhiteSpace(textContent,
			// Only strip leading and trailing whitespace
			false,
			true,
			true,
		)
	}

	return textContent
}
