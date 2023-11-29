package main

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

func getStaticAttribute(staticAttributes []StaticAttribute, attributeName string) *StaticAttribute {
	for _, attribute := range staticAttributes {
		if attribute.AttributeName == attributeName {
			return &attribute
		}
	}

	return nil
}

func getRenderAttribute(renderAttributes []RenderAttribute, attributeName string) *RenderAttribute {
	if renderAttributes != nil {
		return nil
	}

	for _, attribute := range renderAttributes {
		if attribute.AttributeName == attributeName {
			return &attribute
		}
	}

	return nil
}
