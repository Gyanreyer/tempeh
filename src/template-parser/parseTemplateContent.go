package main

import "regexp"

var leadingWhiteSpaceRegex = regexp.MustCompile(`^\s+`)
var trailingWhiteSpaceRegex = regexp.MustCompile(`\s+$`)
var intermediateWhiteSpaceRegex = regexp.MustCompile(`\s+`)

func parseElementChildren(parentChildNodeChannel chan []*TmphNode, elementContent string, shouldPreserveWhiteSpace bool, line int, column int) {
	if elementContent == "" {
		return
	}

	cursor := NewTemplateReader(elementContent, line, column)

	parentChildNodes := make([]*TmphNode, 0, 1)

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

			// Flatten all intermediate whitespace to a single space
			textContent = intermediateWhiteSpaceRegex.ReplaceAllString(textContent, " ")
		}

		if textContent != "" {
			parentChildNodes = append(parentChildNodes, NewTextNode(textContent, textContentStartLine, textContentStartColumn))
		}

		if isAtEndOfElementContent {
			break
		}

		tagStartLine := cursor.line
		tagStartColumn := cursor.column
		openedTagName, staticAttributes, renderAttributes, isVoid := cursor.ReadOpeningTag()

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

			textContentNode := NewTextNode(
				elementChildContent[leadingWhiteSpaceEndIndex:trailingWhiteSpaceStartIndex],
				childrenStartLine, childrenStartColumn,
			)

			parentChildNodes = append(
				parentChildNodes,
				NewElementNode(
					openedTagName, []*TmphNode{textContentNode},
					staticAttributes, renderAttributes,
					tagStartLine, tagStartColumn,
				),
			)
		} else if isVoid || elementChildContent == "" {
			parentChildNodes = append(
				parentChildNodes,
				NewElementNode(
					openedTagName, nil,
					staticAttributes, renderAttributes,
					tagStartLine, tagStartColumn,
				),
			)
		} else {
			childNodeChannel := make(chan []*TmphNode)

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
				NewElementNode(
					openedTagName, childNodes,
					staticAttributes, renderAttributes,
					tagStartLine, tagStartColumn,
				),
			)
		}
	}

	parentChildNodeChannel <- parentChildNodes
}
