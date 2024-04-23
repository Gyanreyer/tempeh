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
	reader          *bufio.Reader
	line            int
	column          int
	previousCharBuf []rune
	tokens          chan *LexerToken
	lastTagName     string
}

func NewLexer(reader *bufio.Reader) *Lexer {
	return &Lexer{
		reader: reader,
		line:   1,
		column: 1,
		// Buffer hangs on to last 4 characters to help with lexing. Ordered from most recent to least recent,
		// where the most recently read character is at index 0 and the least recently read character is at index 3.
		// -1 represents chars before the start of the file
		previousCharBuf: []rune{-1, -1, -1, -1},
		tokens:          make(chan *LexerToken),
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

		l.UnshiftPrevCharBuf(r)
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

	l.ShiftPrevCharBuf()
	return err
}

func (l *Lexer) UnshiftPrevCharBuf(char rune) {
	// Add a new character to the front of the buffer and shift the rest of the buffer up
	l.previousCharBuf[3] = l.previousCharBuf[2]
	l.previousCharBuf[2] = l.previousCharBuf[1]
	l.previousCharBuf[1] = l.previousCharBuf[0]
	l.previousCharBuf[0] = char
}

func (l *Lexer) ShiftPrevCharBuf() {
	// Shift chars down the buffer; this will leave an empty space at the end of the buffer.
	// This is okay because the buffer is only used to look back at the last 2 characters and unread can't be called more than once in a row.
	l.previousCharBuf[0] = l.previousCharBuf[1]
	l.previousCharBuf[1] = l.previousCharBuf[2]
	l.previousCharBuf[2] = l.previousCharBuf[3]
	l.previousCharBuf[3] = -1
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

		if nextChar == '<' {
			nextChar, err = l.ReadRune()

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
				emitTextContent()
				// Unread so the next state func can read the character which caused this state to end
				if err = l.UnreadRune(); err != nil {
					l.Emit(LT_ERROR, err.Error(), l.line, l.column)
					return nil
				}
				return LexOpeningTagName
			} else if nextChar == '/' {
				nextChar, err = l.ReadRune()

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
					emitTextContent()
					// Unread so the next state func can start with the first letter of the tag name
					if err = l.UnreadRune(); err != nil {
						l.Emit(LT_ERROR, err.Error(), l.line, l.column)
						return nil
					}
					return LexClosingTagName
				} else {
					textContentRunes = append(textContentRunes, '<', '/', nextChar)
				}
			} else {
				textContentRunes = append(textContentRunes, '<', nextChar)
			}
		} else {
			textContentRunes = append(textContentRunes, nextChar)
		}
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
			if l.previousCharBuf[1] == '/' {
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

		if nextChar == openingQuoteChar && l.previousCharBuf[1] != '\\' {
			// If the next character is the closing quote character and the character before it is not an escape character, then we have reached the end of the attribute value
			emitAttrValue()
			return LexOpeningTagContents
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
	scriptContentRunes := make([]rune, 0)
	startLine := l.line
	startCol := l.column

	elementTagName := l.lastTagName

	var emitScriptContent = func() {
		l.Emit(LT_TEXTCONTENT, string(scriptContentRunes), startLine, startCol)
	}

	var unterminatedQuoteChar *rune

	for {
		nextChar, err := l.ReadRune()
		if err != nil {
			emitScriptContent()
			if err == io.EOF {
				l.Emit(LT_EOF, "", l.line, l.column)
			} else {
				l.Emit(LT_ERROR, err.Error(), l.line, l.column)
			}
			return nil
		}

		if unterminatedQuoteChar != nil && nextChar == *unterminatedQuoteChar && l.previousCharBuf[1] != '\\' {
			unterminatedQuoteChar = nil
			scriptContentRunes = append(scriptContentRunes, nextChar)
		} else if unterminatedQuoteChar == nil && (elementTagName == "script" && isScriptQuoteChar(nextChar)) || (elementTagName == "style" && isStyleQuoteChar(nextChar)) {
			unterminatedQuoteChar = &nextChar
			scriptContentRunes = append(scriptContentRunes, nextChar)
		} else if nextChar == '<' {
			closingTagNameLine := l.line
			closingTagNameCol := l.column

			// check for the 8 chars in </script
			expectedClosingTagNameChars := []rune("</script")

			didMatchClosingTagName := true

			for i := 1; i < 8; i++ {
				nextChar, err = l.ReadRune()
				if err != nil {
					emitScriptContent()
					if err == io.EOF {
						l.Emit(LT_EOF, "", l.line, l.column)
					} else {
						l.Emit(LT_ERROR, err.Error(), l.line, l.column)
					}
					return nil
				}

				if nextChar != expectedClosingTagNameChars[i] {
					// If the next character does not match the expected closing tag name, add the character to the script content
					scriptContentRunes = append(scriptContentRunes, expectedClosingTagNameChars[:i]...)
					scriptContentRunes = append(scriptContentRunes, nextChar)
					didMatchClosingTagName = false
					break
				}

			}

			if didMatchClosingTagName {
				// It matches a closing tag!
				emitScriptContent()
				l.Emit(LT_CLOSINGTAGNAME, "script", closingTagNameLine, closingTagNameCol)
				// Finish lexing the closing tag
				return LexClosingTag
			}
		} else {
			scriptContentRunes = append(scriptContentRunes, nextChar)
		}
	}
}

// func LexRawStyleContent(l *Lexer) StateFn {
// 	// styleContentRunes := make([]rune, 0)
// 	// startLine := l.line
// 	// startCol := l.column
// 	// var emitStyleContent = func() {
// 	// 	l.Emit(LT_TEXTCONTENT, string(styleContentRunes), startLine, startCol)
// 	// }
// 	// for {
// 	// 	nextChar, err := l.ReadRune()
// 	// 	if err != nil {…}
// 	// 	if nextChar == '<' {
// 	// 		// Check if it's the closing style tag
// 	// 		if l.previousCharBuf[1] == '/' {
// 	// 			// Check if the next characters match the closing style tag name
// 	// 			if matchClosingTagName(l, "style") {
// 	// 				emitStyleContent()
// 	// 				return LexTextContent
// 	// 			}
// 	// 		}
// 	// 	}
// 	// 	styleContentRunes = append(styleContentRunes, nextChar)
// 	// }
// }

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
