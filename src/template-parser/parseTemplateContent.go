package main

import (
	"regexp"

	gen "github.com/gyanreyer/tempeh/template-parser/pb/gen/go"
)

var leadingWhiteSpaceRegex = regexp.MustCompile(`^\s+`)
var trailingWhiteSpaceRegex = regexp.MustCompile(`\s+$`)
var intermediateWhiteSpaceRegex = regexp.MustCompile(`\s+`)

var lineBreakRegex = regexp.MustCompile(`[\n\r]+`)

func replaceIntermediateWhiteSpaceMatchfunc(match string) string {
	// Flatten all white space containing a line break with a single new line character
	if lineBreakRegex.MatchString(match) {
		return "\n"
	}

	// Flatten all other white space to a single space
	return " "
}

func parseElementChildren(parentChildNodeChannel chan []*gen.TmphNode, elementContent string, shouldPreserveWhiteSpace bool, line int, column int) {
	if elementContent == "" {
		return
	}

	cursor := NewTemplateReader(elementContent, line, column)

	parentChildNodes := make([]*gen.TmphNode, 0, 1)

	for !cursor.IsAtEnd() {
		textContentStartLine := cursor.line
		textContentStartColumn := cursor.column

		textContent := cursor.ReadUntilTag()

		isAtEndOfElementContent := cursor.IsAtEnd()

		// Flatten white space if we don't need to prserve it
		if !shouldPreserveWhiteSpace {
			if len(parentChildNodes) == 0 {
				// If this is the first child of an element, strip leading whitespace
				if matchInds := leadingWhiteSpaceRegex.FindStringIndex(textContent); matchInds != nil {
					leadingWhiteSpaceEndIndex := matchInds[1]
					textContent = textContent[leadingWhiteSpaceEndIndex:]
				}
			}
			if isAtEndOfElementContent {
				if matchInds := trailingWhiteSpaceRegex.FindStringIndex(textContent); matchInds != nil {
					// If this is the last child of an element, strip trailing whitespace
					trailingWhiteSpaceStartIndex := matchInds[0]
					textContent = textContent[:trailingWhiteSpaceStartIndex]
				}
			}

			// Flatten all intermediate whitespace to a single space or line break
			textContent = intermediateWhiteSpaceRegex.ReplaceAllStringFunc(textContent, replaceIntermediateWhiteSpaceMatchfunc)
		}

		if textContent != "" {
			textNode := &gen.TmphNode{
				TextContent: &textContent,
				Line:        uint32(textContentStartLine),
				Column:      uint32(textContentStartColumn),
			}
			parentChildNodes = append(parentChildNodes, textNode)
		}

		if isAtEndOfElementContent {
			break
		}

		tagStartLine := cursor.line
		tagStartColumn := cursor.column
		openedTagName, attributes, isVoid := cursor.ReadOpeningTag()

		// Grab the line and column that the cursor is at for the start position of the tag's child contents
		childrenStartLine := cursor.line
		childrenStartColumn := cursor.column

		// Script and style tag contents should be treated as raw text content
		shouldUseRawTextContent := openedTagName == "script" || openedTagName == "style"

		elementChildContent := cursor.ReadRawTagTextContent(
			openedTagName,
			!isVoid && !shouldUseRawTextContent,
		)

		if shouldUseRawTextContent {
			var leadingWhiteSpaceEndIndex int
			if leadingMatchInds := leadingWhiteSpaceRegex.FindStringIndex(elementChildContent); leadingMatchInds != nil {
				leadingWhiteSpaceEndIndex = leadingMatchInds[1]
			} else {
				leadingWhiteSpaceEndIndex = 0
			}

			var trailingWhiteSpaceStartIndex int
			if trailingMatchInds := trailingWhiteSpaceRegex.FindStringIndex(elementChildContent); trailingMatchInds != nil {
				trailingWhiteSpaceStartIndex = trailingMatchInds[0]
			} else {
				trailingWhiteSpaceStartIndex = len(elementChildContent)
			}

			textContentSlice := elementChildContent[leadingWhiteSpaceEndIndex:trailingWhiteSpaceStartIndex]
			textContentNode := &gen.TmphNode{
				TextContent: &textContentSlice,
				Line:        uint32(childrenStartLine),
				Column:      uint32(childrenStartColumn),
			}

			parentChildNodes = append(
				parentChildNodes,
				&gen.TmphNode{
					TagName:    openedTagName,
					ChildNodes: []*gen.TmphNode{textContentNode},
					Attributes: attributes,
					Line:       uint32(tagStartLine),
					Column:     uint32(tagStartColumn),
				},
			)
		} else if isVoid || elementChildContent == "" {
			parentChildNodes = append(
				parentChildNodes,
				&gen.TmphNode{
					TagName:    openedTagName,
					Attributes: attributes,
					Line:       uint32(tagStartLine),
					Column:     uint32(tagStartColumn),
				},
			)
		} else {
			childNodeChannel := make(chan []*gen.TmphNode)

			go parseElementChildren(
				childNodeChannel,
				elementChildContent,
				// Preserve whitespace for pre and textarea tags
				shouldPreserveWhiteSpace || openedTagName == "pre" || openedTagName == "textarea",
				childrenStartLine,
				childrenStartColumn,
			)

			childNodes := <-childNodeChannel

			parentChildNodes = append(
				parentChildNodes,
				&gen.TmphNode{
					TagName:    openedTagName,
					Attributes: attributes,
					ChildNodes: childNodes,
					Line:       uint32(tagStartLine),
					Column:     uint32(tagStartColumn),
				},
			)
		}
	}

	parentChildNodeChannel <- parentChildNodes
}
