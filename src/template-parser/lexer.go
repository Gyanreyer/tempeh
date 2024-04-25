package main

import (
	"bufio"
	"fmt"
	"io"
)

type LexerTokenType int

const (
	LT_EOF               LexerTokenType = iota // end of file
	LT_ERROR                                   // error occurred
	LT_TEXTCONTENT                             // text content
	LT_OPENINGTAGNAME                          // element opening tag name
	LT_ATTRIBUTENAME                           // element attribute name
	LT_ATTRIBUTEVALUE                          // element attribute value
	LT_SELFCLOSINGTAGEND                       // end of a self-closing tag; '/>'
	LT_CLOSINGTAGNAME                          // element closing tag name
)

type LexerToken struct {
	tokenType  LexerTokenType
	tokenValue string
	line       int
	column     int
}

func (lt *LexerToken) String() string {
	var typeString string
	switch lt.tokenType {
	case LT_EOF:
		typeString = "EOF"
	case LT_ERROR:
		typeString = "ERROR"
	case LT_TEXTCONTENT:
		typeString = "TEXTCONTENT"
	case LT_OPENINGTAGNAME:
		typeString = "OPENINGTAGNAME"
	case LT_ATTRIBUTENAME:
		typeString = "ATTRIBUTENAME"
	case LT_ATTRIBUTEVALUE:
		typeString = "ATTRIBUTEVALUE"
	case LT_SELFCLOSINGTAGEND:
		typeString = "SELFCLOSINGTAGEND"
	case LT_CLOSINGTAGNAME:
		typeString = "CLOSINGTAGNAME"
	}
	return fmt.Sprintf("Type %s: '%s'\n", typeString, lt.tokenValue)
}

type Lexer struct {
	reader      *bufio.Reader
	line        int
	column      int
	tokens      chan *LexerToken
	lastTagName string
}

func NewLexer(reader *bufio.Reader) *Lexer {
	return &Lexer{
		reader: reader,
		line:   1,
		column: 1,
		tokens: make(chan *LexerToken),
		// Track the last tag name; necessary context to determine how an element's content should
		// processed since script and style tags have raw content
		lastTagName: "",
	}
}

func (l *Lexer) Emit(tokenType LexerTokenType, tokenValue string, line int, column int) {
	l.tokens <- &LexerToken{
		tokenType:  tokenType,
		tokenValue: tokenValue,
		line:       line,
		column:     column,
	}
}

func (l *Lexer) ReadRune() (r rune, err error) {
	r, _, err = l.reader.ReadRune()
	if err == nil {
		if isLineBreak(r) {
			l.line++
			l.column = 1
		} else {
			l.column++
		}
	}

	return r, err
}

func (l *Lexer) UnreadRune() (err error) {
	err = l.reader.UnreadRune()
	if l.column == 1 {
		l.line--
	} else {
		l.column--
	}

	return err
}

func (l *Lexer) Run() {
	for state := LexTextContent; state != nil; {
		state = state(l)
	}
}

func (l *Lexer) NextToken() *LexerToken {
	return <-l.tokens
}

// StateFn represents the state of the scanner as a function that returns the next state.
type StateFn func(*Lexer) StateFn

// Reads raw text content until an opening or closing tag is encountered.
// Emits LT_TEXTCONTENT token.
func LexTextContent(l *Lexer) StateFn {
	textContentRunes := make([]rune, 0)

	startLine := l.line
	startCol := l.column

	var emitTextContent = func() {
		l.Emit(LT_TEXTCONTENT, string(textContentRunes), startLine, startCol)
	}

	for {
		nextChar, err := l.ReadRune()
		if err != nil {
			emitTextContent()
			if err == io.EOF {
				l.Emit(LT_EOF, "", l.line, l.column)
			} else {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
			}
			return nil
		}

		if isLegalLeadingTagNameChar(nextChar) {
			textContentLength := len(textContentRunes)

			if textContentLength > 0 && textContentRunes[textContentLength-1] == '<' {
				// Slice off the '<' character that was appended to the text content since that's part of the tag
				textContentRunes = textContentRunes[:textContentLength-1]
				emitTextContent()
				// Unread so the next state func can read the first character of the tag name
				if err = l.UnreadRune(); err != nil {
					l.Emit(LT_ERROR, err.Error(), l.line, l.column)
					return nil
				}
				return LexOpeningTagName
			} else if textContentLength >= 2 && textContentRunes[textContentLength-2] == '<' && textContentRunes[textContentLength-1] == '/' {
				// Slice off the "</" characters that were appended to the text content since that's part of the closing tag
				textContentRunes = textContentRunes[:textContentLength-2]
				emitTextContent()
				// Unread so the next state func can start with the first letter of the tag name
				if err = l.UnreadRune(); err != nil {
					l.Emit(LT_ERROR, err.Error(), l.line, l.column)
					return nil
				}
				return LexClosingTagName
			}
		} else if nextChar == '-' {
			textContentLength := len(textContentRunes)
			// See if previous chars match "<!-"
			if textContentLength >= 3 && textContentRunes[textContentLength-3] == '<' && textContentRunes[textContentLength-2] == '!' && textContentRunes[textContentLength-1] == '-' {
				// Slice off the "<!-" characters that were appended to the text content since that's part of the comment
				textContentRunes = textContentRunes[:textContentLength-3]
				emitTextContent()
				// Unread so the next state func can start with the first character of the comment
				if err = l.UnreadRune(); err != nil {
					l.Emit(LT_ERROR, err.Error(), l.line, l.column)
					return nil
				}
				return LexCommentTag
			}
		}

		textContentRunes = append(textContentRunes, nextChar)
	}
}

// The first character from ReadRune will be the first character of the tag name following the '<' character.
// Reads until the first illegal tag name character; usually whitespace or '>'.
// Emits LT_OPENINGTAGNAME token.
func LexOpeningTagName(l *Lexer) StateFn {
	tagNameRunes := make([]rune, 0)

	startLine := l.line
	startCol := l.column

	var emitTagName = func() {
		tagName := string(tagNameRunes)
		l.Emit(LT_OPENINGTAGNAME, tagName, startLine, startCol)
		l.lastTagName = tagName
	}

	for {
		nextChar, err := l.ReadRune()
		if err != nil {
			emitTagName()
			if err == io.EOF {
				l.Emit(LT_EOF, "", l.line, l.column)
			} else {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
			}
			return nil
		}

		if isLegalTagOrAttributeNameChar(nextChar) {
			tagNameRunes = append(tagNameRunes, nextChar)
		} else {
			emitTagName()
			// Unread so the next state func can read the character which caused this state to end
			if err = l.UnreadRune(); err != nil {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
				return nil
			}
			return LexOpeningTagContents
		}
	}
}

// The first character from ReadRune will be the first character which terminated the opening tag's name; usually whitespace or '>'.
// Reads until the end of the opening tag and emits LT_SELFCLOSINGTAGEND token if the tag is self-closing, but will divert
// to lex attribute names if a legal attribute name character is encountered.
func LexOpeningTagContents(l *Lexer) StateFn {
	var prevChar *rune

	for {
		nextChar, err := l.ReadRune()
		if err != nil {
			l.Emit(LT_SELFCLOSINGTAGEND, "", l.line, l.column)
			if err == io.EOF {
				l.Emit(LT_EOF, "", l.line, l.column)
			} else {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
			}
			return nil
		}

		if isWhiteSpace(nextChar) {
			// Skip whitespace
			continue
		} else if nextChar == '>' {
			// End of opening tag
			if prevChar != nil && *prevChar == '/' {
				// Self-closing tag
				l.Emit(LT_SELFCLOSINGTAGEND, "", l.line, l.column)
			} else if l.lastTagName == "script" || l.lastTagName == "style" {
				return LexRawElementContent
			}
			// Go back to lexing text content; if a self closing tag, that will be the content after this tag, otherwise it
			// will be the content inside the tag
			return LexTextContent
		} else if isLegalTagOrAttributeNameChar(nextChar) {
			// Unread so the first character of the attribute name can be read by the next state func
			if err = l.UnreadRune(); err != nil {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
				return nil
			}
			// Attribute name
			return LexOpeningTagAttributeName
		}

		prevChar = &nextChar
	}
}

// The first character from ReadRune will be the first character of the attribute name.
// Reads until the first illegal attribute name character; usually '=' for an attribute with a value or whitespace for a boolean attribute.
// Emits LT_ATTRIBUTENAME token.
func LexOpeningTagAttributeName(l *Lexer) StateFn {
	attrNameRunes := make([]rune, 0)

	startLine := l.line
	startCol := l.column

	var emitAttrName = func() {
		l.Emit(LT_ATTRIBUTENAME, string(attrNameRunes), startLine, startCol)
	}

	for {
		nextChar, err := l.ReadRune()
		if err != nil {
			emitAttrName()
			if err == io.EOF {
				l.Emit(LT_EOF, "", l.line, l.column)
			} else {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
			}
			return nil
		}

		if nextChar == '=' {
			nextChar, err = l.ReadRune()
			if err != nil {
				emitAttrName()
				if err == io.EOF {
					l.Emit(LT_EOF, "", l.line, l.column)
				} else {
					l.Emit(LT_ERROR, err.Error(), l.line, l.column)
				}
				return nil
			}

			emitAttrName()

			// Unread so the next state func can read the first character following the =
			if err = l.UnreadRune(); err != nil {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
				return nil
			}

			if isAttributeValueQuoteChar(nextChar) {
				return LexOpeningTagQuotedAttributeValue
			} else if isLegalTagOrAttributeNameChar(nextChar) {
				return LexOpeningTagUnquotedAttributeValue
			} else {
				return LexOpeningTagContents
			}
		} else if !isLegalTagOrAttributeNameChar(nextChar) {
			emitAttrName()

			// Unread so the next state func can read the character which caused this state to end
			if err = l.UnreadRune(); err != nil {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
				return nil
			}
			return LexOpeningTagContents
		}

		attrNameRunes = append(attrNameRunes, nextChar)
	}
}

// The first character from ReadRune will be the opening quote character of the quoted attribute value.
// Reads until the first instance of an unescaped matching quote character.
// Emits LT_ATTRIBUTEVALUE token.
func LexOpeningTagQuotedAttributeValue(l *Lexer) StateFn {
	openingQuoteChar, err := l.ReadRune()

	attrValueRunes := make([]rune, 0)

	startLine := l.line
	startCol := l.column

	var emitAttrValue = func() {
		l.Emit(LT_ATTRIBUTEVALUE, string(attrValueRunes), startLine, startCol)
	}

	if err != nil {
		emitAttrValue()
		if err == io.EOF {
			l.Emit(LT_EOF, "", l.line, l.column)
		} else {
			l.Emit(LT_ERROR, err.Error(), l.line, l.column)
		}
	}

	for {
		nextChar, err := l.ReadRune()
		if err != nil {
			emitAttrValue()
			if err == io.EOF {
				l.Emit(LT_EOF, "", l.line, l.column)
			} else {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
			}
			return nil
		}

		if nextChar == openingQuoteChar {
			escapeCharCount := 0

			for i := len(attrValueRunes) - 1; i >= 0; i-- {
				if attrValueRunes[i] == '\\' {
					escapeCharCount++
				} else {
					// Break on the first non-escape character
					break
				}
			}

			if escapeCharCount%2 == 0 {
				// If the next character is the closing quote character and it isn't escaped, then we have reached the end of the attribute value
				emitAttrValue()
				return LexOpeningTagContents
			}
		}

		attrValueRunes = append(attrValueRunes, nextChar)
	}
}

// At this point, we know that the first character from ReadRune will be the first character of the unquoted attribute value.
// Reads until the end of the attribute value; an unquoted attribute value is terminated by whitespace or tag characters like '>' or '/'.
// Emits LT_ATTRIBUTEVALUE token.
func LexOpeningTagUnquotedAttributeValue(l *Lexer) StateFn {
	attrValueRunes := make([]rune, 0)

	startLine := l.line
	startCol := l.column

	var emitAttrValue = func() {
		l.Emit(LT_ATTRIBUTEVALUE, string(attrValueRunes), startLine, startCol)
	}

	for {
		nextChar, err := l.ReadRune()
		if err != nil {
			emitAttrValue()
			if err == io.EOF {
				l.Emit(LT_EOF, "", l.line, l.column)
			} else {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
			}
			return nil
		}

		if !isLegalUnquotedAttributeValueChar(nextChar) {
			emitAttrValue()
			if err = l.UnreadRune(); err != nil {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
				return nil
			}
			return LexOpeningTagContents
		}
	}
}

// Read the raw contents of a script or style tag until the closing tag is encountered.
// Emits LT_TEXTCONTENT token.
func LexRawElementContent(l *Lexer) StateFn {
	rawTextContentRunes := make([]rune, 0)
	startLine := l.line
	startCol := l.column

	elementTagName := l.lastTagName

	var emitTextContent = func() {
		l.Emit(LT_TEXTCONTENT, string(rawTextContentRunes), startLine, startCol)
	}

	var unterminatedQuoteChar *rune

	for {
		nextChar, err := l.ReadRune()
		if err != nil {
			emitTextContent()
			if err == io.EOF {
				l.Emit(LT_EOF, "", l.line, l.column)
			} else {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
			}
			return nil
		}

		if unterminatedQuoteChar != nil {
			if nextChar == *unterminatedQuoteChar {
				// Count how many backslash escape characters precede the quote character.
				// If the count is even, the quote character is not escaped and is the closing quote character.
				// Examples:
				// "quote: \"" -> '"' is escaped, '"' is not"
				// "backslash: \\" -> '\' is escaped, '"' is not"
				// "backslash and quote: \\\"" -> '\' is escaped, '"' is escaped, final '"' is not
				escapeCharCount := 0

				for i := len(rawTextContentRunes) - 1; i >= 0; i-- {
					if rawTextContentRunes[i] == '\\' {
						escapeCharCount++
					} else {
						// Break on the first non-escape character
						break
					}
				}

				if escapeCharCount%2 == 0 {
					// The quote character is not escaped, so we can now consider it terminated
					unterminatedQuoteChar = nil
				}
			}
			rawTextContentRunes = append(rawTextContentRunes, nextChar)
		} else if (elementTagName == "script" && isScriptQuoteChar(nextChar)) || (elementTagName == "style" && isStyleQuoteChar(nextChar)) {
			// We've encountered the opening quote character for a string in a script or style tag
			unterminatedQuoteChar = &nextChar
			rawTextContentRunes = append(rawTextContentRunes, nextChar)
		} else if nextChar == '<' {
			// If there is no unterminated quote character, check if we just hit a closing tag
			closingTagNameLine := l.line
			closingTagNameCol := l.column

			// check for the chars in </script or </style
			expectedClosingTagChars := []rune("</" + elementTagName)

			actualChars := make([]rune, 0, len(expectedClosingTagChars))
			actualChars = append(actualChars, nextChar)

			closingTagNameCharCount := len(expectedClosingTagChars)
			didMatchClosingTagName := true

			for i := 1; i < closingTagNameCharCount; i++ {
				if nextChar, err = l.ReadRune(); err != nil {
					emitTextContent()
					if err == io.EOF {
						l.Emit(LT_EOF, "", l.line, l.column)
					} else {
						l.Emit(LT_ERROR, err.Error(), l.line, l.column)
					}
					return nil
				}

				actualChars = append(actualChars, nextChar)

				if nextChar != expectedClosingTagChars[i] {
					didMatchClosingTagName = false
					break
				}
			}

			if didMatchClosingTagName {
				// We need to read one last character to make sure the tag name is terminated correctly
				// to be an exact match; we don't want to be fooled by a malformed `</scriptttt` tag name
				if nextChar, err = l.ReadRune(); err != nil {
					emitTextContent()
					if err == io.EOF {
						l.Emit(LT_EOF, "", l.line, l.column)
					} else {
						l.Emit(LT_ERROR, err.Error(), l.line, l.column)
					}
					return nil
				}

				actualChars = append(actualChars, nextChar)

				if !isLegalTagOrAttributeNameChar(nextChar) {
					// It matches a closing tag!
					emitTextContent()
					l.Emit(LT_CLOSINGTAGNAME, elementTagName, closingTagNameLine, closingTagNameCol)
					// Unread so the next state func can read the character which caused this state to end
					if err = l.UnreadRune(); err != nil {
						l.Emit(LT_ERROR, err.Error(), l.line, l.column)
						return nil
					}
					// Finish lexing the closing tag
					return LexClosingTag
				}
			}

			// If we didn't hit on a closing tag match, add all of the characters we read so far to the script content
			rawTextContentRunes = append(rawTextContentRunes, actualChars...)
		} else {
			rawTextContentRunes = append(rawTextContentRunes, nextChar)
		}
	}
}

// HTML comment tags are of the form <!-- ... -->.
// Reads until the closing --> is encountered.
// We don't need to emit a token for comments, just want to skip them
func LexCommentTag(l *Lexer) StateFn {
	var prevChar *rune
	var prevPrevChar *rune

	for {
		nextChar, err := l.ReadRune()
		if err != nil {
			if err == io.EOF {
				l.Emit(LT_EOF, "", l.line, l.column)
			} else {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
			}
			return nil
		}

		if prevPrevChar != nil && prevChar != nil && *prevPrevChar == '-' && *prevChar == '-' && nextChar == '>' {
			// The comment has been terminated with -->
			return LexTextContent
		}

		prevPrevChar = prevChar
		prevChar = &nextChar
	}
}

// Reads until the end of the tag name.
// emits LT_CLOSINGTAGNAME token
func LexClosingTagName(l *Lexer) StateFn {
	closingTagNameRunes := make([]rune, 0)

	startLine := l.line
	startCol := l.column

	var emitClosingTagName = func() {
		l.Emit(LT_CLOSINGTAGNAME, string(closingTagNameRunes), startLine, startCol)
	}

	for {
		nextChar, err := l.ReadRune()
		if err != nil {
			emitClosingTagName()
			if err == io.EOF {
				l.Emit(LT_EOF, "", l.line, l.column)
			} else {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
			}
			return nil
		}

		if !isLegalTagOrAttributeNameChar(nextChar) {
			emitClosingTagName()
			if err = l.UnreadRune(); err != nil {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
				return nil
			}
			return LexClosingTag
		}

		closingTagNameRunes = append(closingTagNameRunes, nextChar)
	}
}

// At this point, we are in a closing tag but after the tag name.
// This will simply skip until the closing '>' character is found and then revert back to the default state
// lexing text content.
func LexClosingTag(l *Lexer) StateFn {
	for {
		nextChar, err := l.ReadRune()
		if err != nil {
			if err == io.EOF {
				l.Emit(LT_EOF, "", l.line, l.column)
			} else {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
			}
			return nil
		}

		if nextChar == '>' {
			return LexTextContent
		}
	}
}
