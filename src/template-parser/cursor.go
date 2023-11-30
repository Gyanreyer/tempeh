package main

import (
	"errors"
	"strconv"
)

type RenderAttribute struct {
	AttributeName     string `json:"name"`
	AttributeModifier string `json:"modifier,omitempty"`
	AttributeValue    string `json:"value,omitempty"`
	Position          string `json:"position"`
}

type StaticAttribute struct {
	AttributeName  string `json:"name"`
	AttributeValue string `json:"value,omitempty"`
	Position       string `json:"position"`
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

type Cursor struct {
	index    int
	str      string
	maxIndex int
	line     int
	column   int
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

func (c *Cursor) PeekSubstring(length int) (string, error) {
	endIndex := c.index + length
	if length < 0 || endIndex > c.maxIndex {
		return "", errors.New("substring end index out of bounds")
	}

	return c.str[c.index:endIndex], nil
}

func (c *Cursor) CurrentChar() (rune, error) {
	return c.At(c.index)
}

func (c *Cursor) AdvanceChar(amount ...int) (newChar rune, err error) {
	incrementAmount := 1
	if len(amount) > 0 {
		incrementAmount = amount[0]
	}

	newIndex := c.index + incrementAmount

	for err == nil && c.index < newIndex {
		prevChar, err := c.CurrentChar()
		c.index++
		if err == nil {
			if prevChar == '\n' || prevChar == '\r' {
				c.line++
				c.column = 1
			} else {
				c.column++
			}
		} else {
			break
		}
	}

	newChar, err = c.CurrentChar()

	return newChar, err
}

func (c *Cursor) IsAtEnd() bool {
	return c.index > c.maxIndex
}

func (c *Cursor) GetPosition() string {
	return strconv.Itoa(c.line) + ":" + strconv.Itoa(c.column)
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

func (c *Cursor) IsOpeningTagWithNameAhead(tagName string) bool {
	expectedSubstring := "<" + tagName

	substring, err := c.PeekSubstring(len(expectedSubstring))

	return err == nil && substring == expectedSubstring
}

const CLOSING_TAG_PREFIX = "</"

func (c *Cursor) IsClosingTagAhead() bool {
	substring, err := c.PeekSubstring(len(CLOSING_TAG_PREFIX))
	return err == nil && substring == CLOSING_TAG_PREFIX
}

func (c *Cursor) IsClosingTagWithNameAhead(tagName string) bool {
	expectedSubstring := CLOSING_TAG_PREFIX + tagName

	substring, err := c.PeekSubstring(len(expectedSubstring))

	return err == nil && substring == expectedSubstring
}

const COMMENT_OPEN_TAG = "<!--"

func (c *Cursor) IsCommentOpenTagAhead() bool {
	substring, err := c.PeekSubstring(len(COMMENT_OPEN_TAG))
	return err == nil && substring == COMMENT_OPEN_TAG
}

const COMMENT_CLOSE_TAG = "-->"

func (c *Cursor) IsCommentCloseTagAhead() bool {
	substring, err := c.PeekSubstring(len(COMMENT_CLOSE_TAG))
	return err == nil && substring == COMMENT_CLOSE_TAG
}

func (c *Cursor) SkipComment() {
	_, err := c.CurrentChar()
	for err == nil && !c.IsCommentCloseTagAhead() {
		_, err = c.AdvanceChar()
	}

	// Skip past the comment close tag
	c.AdvanceChar(3)
}

func (c *Cursor) ReadUntilTag() (textContent string, isClosingTag bool) {
	textStartIndex := c.index

	isClosingTag = false

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

	textContent = c.str[textStartIndex:textEndIndex]

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
		// Track the line/column position of the attribute for error logging
		attributePosition := c.GetPosition()

		for err == nil && isLegalTagOrAttributeNameChar(ch) {
			if isRenderAttribute && (ch == ':') {
				renderAttributeModifierIndex = c.index
			}
			ch, err = c.AdvanceChar()
		}

		var attributeName string
		var attributeModifier string

		if isDynamicAttribute {
			attributeName = "attr"
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
				renderAttributes = append(renderAttributes, RenderAttribute{
					AttributeName:     attributeName,
					AttributeModifier: attributeModifier,
					Position:          attributePosition,
				})
			} else {
				staticAttributes = append(staticAttributes, StaticAttribute{
					AttributeName: attributeName,
					Position:      attributePosition,
				})
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
				renderAttributes = append(renderAttributes, RenderAttribute{
					AttributeName: attributeName, AttributeModifier: attributeModifier,
					Position: attributePosition,
				})
			} else {
				staticAttributes = append(staticAttributes, StaticAttribute{
					AttributeName: attributeName,
					Position:      attributePosition,
				})
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
					Position:          attributePosition,
				})
			} else {
				staticAttributes = append(staticAttributes, StaticAttribute{
					AttributeName:  attributeName,
					AttributeValue: attributeValue,
					Position:       attributePosition,
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
					Position:          attributePosition,
				})
			} else {
				staticAttributes = append(staticAttributes, StaticAttribute{
					AttributeName:  attributeName,
					AttributeValue: attributeValue,
					Position:       attributePosition,
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
func (c *Cursor) ReadRawTagTextContent(tagName string, shouldCheckForNestedTags bool) (textContent string) {

	contentStartIndex := c.index
	contentEndIndex := c.index

	_, err := c.CurrentChar()

	nestedTagDepth := 0

	for err == nil {
		// Keep going until we hit a closing tag with the same name as the opening tag
		if c.IsClosingTagWithNameAhead(tagName) {
			// If this looks like a closing tag, hang onto the current index as the potential end
			// of the tag's content; ReadClosingTag will advance the cursor index past the closing tag
			// and we don't want to include any of that in the returned content
			contentEndIndex = c.index
			if nestedTagDepth > 0 {
				nestedTagDepth--
			} else {
				break
			}
		} else {
			if shouldCheckForNestedTags && c.IsOpeningTagWithNameAhead(tagName) {
				nestedTagDepth++
			}
			_, err = c.AdvanceChar()
		}

		contentEndIndex = c.index
	}

	textContent = c.str[contentStartIndex:contentEndIndex]

	return textContent
}

func NewCursor(str string, line int, column int) *Cursor {
	return &Cursor{
		index:    0,
		str:      str,
		maxIndex: len(str) - 1,
		line:     line,
		column:   column,
	}
}