package main

import (
	"errors"
)

func isVoidElement(tagName string) bool {
	return tagName == "area" || tagName == "base" || tagName == "br" || tagName == "col" || tagName == "embed" || tagName == "hr" || tagName == "img" || tagName == "input" || tagName == "link" || tagName == "meta" || tagName == "param" || tagName == "source" || tagName == "track" || tagName == "wbr"
}

func isWhiteSpace(char rune) bool {
	return char == ' ' || char == '\t' || char == '\n' || char == '\r' || char == '\f'
}

// There are more strict rules for the first character in a tag name; it must be a letter
func isLegalLeadingTagNameChar(char rune) bool {
	return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
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

func (c *Cursor) ReadUntilTag(shouldPreserveWhitespace bool) (string, bool) {
	if !shouldPreserveWhitespace {
		_, err := c.SkipWhiteSpace()

		if err != nil {
			return "", false
		}
	}

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
	trailingChar, err := c.At(textEndIndex - 1)

	for !shouldPreserveWhitespace && textEndIndex > textStartIndex && err == nil && isWhiteSpace(trailingChar) {
		textEndIndex--
		trailingChar, err = c.At(textEndIndex - 1)
	}

	return c.str[textStartIndex:textEndIndex], isClosingTag
}

func (c *Cursor) ReadTagName() string {
	startIndex := c.index

	ch, err := c.CurrentChar()

	for err == nil && isLegalTagOrAttributeNameChar(ch) {
		ch, err = c.AdvanceChar()
	}

	return c.str[startIndex:c.index]
}

type AttributeArray [][]any

func (c *Cursor) ReadOpeningTagAttributes() AttributeArray {
	attributes := AttributeArray{}

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

		attributeNameStartIndex := c.index

		for err == nil && isLegalTagOrAttributeNameChar(ch) {
			ch, err = c.AdvanceChar()
		}

		attributeName := c.str[attributeNameStartIndex:c.index]

		if ch != '=' {
			// If there's no =, this is a boolean attribute
			attributes = append(attributes, []any{attributeName, true})
			continue
		}

		// Skip the =
		c.AdvanceChar()

		// Skip any whitespace between the = and the attribute value
		ch, err = c.SkipWhiteSpace()

		if err != nil {
			// If we hit the end of the file before reaching an attribute value,
			// call the value an empty string
			attributes = append(attributes, []any{attributeName, ""})
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
			attributes = append(attributes, []any{attributeName, attributeValue})

			// Skip the closing quote char
			ch, err = c.AdvanceChar()
		} else {
			valueStartIndex := c.index

			for err == nil && isLegalUnquotedAttributeValueChar(ch) {
				ch, err = c.AdvanceChar()
			}

			attributeValue := c.str[valueStartIndex:c.index]
			attributes = append(attributes, []any{attributeName, attributeValue})
		}
	}

	if len(attributes) == 0 {
		// Return nil instead of an empty array to represent that there are no attributes
		return nil
	}

	return attributes
}

func (c *Cursor) ReadOpeningTag() (string, AttributeArray, bool) {
	ch, err := c.CurrentChar()

	// If cursor is on the "<" char, skip it
	if err == nil && ch == '<' {
		c.AdvanceChar()
	}

	tagName := c.ReadTagName()

	attributes := c.ReadOpeningTagAttributes()

	ch, err = c.CurrentChar()

	// Advance the cursor to the end of the tag
	for err == nil && ch != '>' {
		ch, err = c.AdvanceChar()
	}

	// Increment the cursor one last time past the end of the tag
	c.AdvanceChar()

	return tagName, attributes, isVoidElement(tagName)
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

func (c *Cursor) ReadToMatchingClosingTag(tagName string, shouldPreserveWhitespace bool) string {
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

	trailingChar, err := c.At(contentEndIndex - 1)

	for !shouldPreserveWhitespace && contentEndIndex > contentStartIndex && err == nil && isWhiteSpace(trailingChar) {
		contentEndIndex--
		trailingChar, err = c.At(contentEndIndex - 1)
	}

	return c.str[contentStartIndex:contentEndIndex]
}
