package main

// There are more strict rules for the first character in a tag name; it must be a letter
func isLegalLeadingTagNameChar(char rune) bool {
	return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char == ':' || char == '_'
}

func isEndOfTagChar(char rune) bool {
	return char == '>' || char == '/'
}

func isLineBreak(char rune) bool {
	return char == '\n' || char == '\r' || char == '\f'
}

func isWhiteSpace(char rune) bool {
	return char == ' ' || char == '\t' || isLineBreak(char)
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

func isScriptQuoteChar(char rune) bool {
	return char == '"' || char == '\'' || char == '`'
}

func isStyleQuoteChar(char rune) bool {
	return char == '"' || char == '\''
}

// Child content of these elements are parsed as raw text instead of HTML
func isRawTextContentElementTagName(tagName string) bool {
	return tagName == "script" || tagName == "style" || tagName == "textarea"
}
