package main

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

		if !shouldPreserveWhiteSpace {
			// Flatten whitespace if we don't need to preserve it
			textContent = flattenWhiteSpace(
				textContent,
				true,
				// If this is the first child of an element, strip leading whitespace
				len(parentChildNodes) == 0,
				// If we just encountered a closing tag or hit the end of the parent element's content,
				// strip trailing whitespace
				isAtEndOfElementContent,
			)
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
			textContentNode := NewTextNode(
				flattenWhiteSpace(elementChildContent, false, true, true),
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
