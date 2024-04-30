package main

var lineBreakChars = map[rune]bool{
	'\n': true,
	'\r': true,
	'\f': true,
}

func isLineBreak(char rune) bool {
	_, isLineBreakChar := lineBreakChars[char]
	return isLineBreakChar
}

var whiteSpaceChars = map[rune]bool{
	' ':  true,
	'\t': true,
	'\n': true,
	'\r': true,
	'\f': true,
}

func isWhiteSpace(char rune) bool {
	_, isWhiteSpaceChar := whiteSpaceChars[char]
	return isWhiteSpaceChar
}

var attributeValueQuoteChars = map[rune]bool{
	'"':  true,
	'\'': true,
}

func isAttributeValueQuoteChar(char rune) bool {
	_, isAttributeValueQuoteChar := attributeValueQuoteChars[char]
	return isAttributeValueQuoteChar
}

var tagEndChars = map[rune]bool{
	'>': true,
	'/': true,
}

func isEndOfTagChar(char rune) bool {
	_, isEndOfTagChar := tagEndChars[char]
	return isEndOfTagChar
}

func isLetter(char rune) bool {
	return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
}

// There are more strict rules for the first character in a tag name; it must be a letter or an underscore
func isLegalLeadingTagNameChar(char rune) bool {
	return isLetter(char) || char == '_'
}

func isNumber(char rune) bool {
	return char >= '0' && char <= '9'
}

var legalTagNameSpecialChars = map[rune]bool{
	'-': true,
	'_': true,
	'.': true,
	':': true,
}

// Test if the character is a valid PCEN ("PotentialCustomElementName") unicode character for a tag name
func isPCENChar(char rune) bool {
	return char == 0xB7 ||
		(char >= 0xC0 && char <= 0xD6) ||
		(char >= 0xD8 && char <= 0xF6) ||
		(char >= 0xF8 && char <= 0x37D) ||
		(char >= 0x37F && char <= 0x1FFF) ||
		(char >= 0x200C && char <= 0x200D) ||
		(char >= 0x203F && char <= 0x2040) ||
		(char >= 0x2070 && char <= 0x218F) ||
		(char >= 0x2C00 && char <= 0x2FEF) ||
		(char >= 0x3001 && char <= 0xD7FF) ||
		(char >= 0xF900 && char <= 0xFDCF) ||
		(char >= 0xFDF0 && char <= 0xFFFD) ||
		(char >= 0x10000 && char <= 0xEFFFF)
}

// Tag name characters can be letters, numbers, a given set of special characters
func isLegalTagNameChar(char rune) bool {
	_, isLegalTagNameSpecialChar := legalTagNameSpecialChars[char]
	if isLegalTagNameSpecialChar {
		return true
	}

	return isLetter(char) || isNumber(char) || isPCENChar(char)
}

// Attribute names are pretty flexible, but can't contain an equals sign, whitespace, quotes, or tag ending characters
func isLegalAttributeNameChar(char rune) bool {
	return char != '=' && !isWhiteSpace(char) && !isEndOfTagChar(char) && !isAttributeValueQuoteChar(char)
}

func isLegalUnquotedAttributeValueChar(char rune) bool {
	return !isWhiteSpace(char) && !isAttributeValueQuoteChar(char) && !isEndOfTagChar(char) && char != '<'
}

var scriptQuoteChars = map[rune]bool{
	'"':  true,
	'\'': true,
	'`':  true,
}

func isScriptQuoteChar(char rune) bool {
	_, isScriptQuoteChar := scriptQuoteChars[char]
	return isScriptQuoteChar
}

var styleQuoteChars = map[rune]bool{
	'"':  true,
	'\'': true,
}

func isStyleQuoteChar(char rune) bool {
	return styleQuoteChars[char] || false
}

var rawTextContentTagNames = map[string]bool{
	"script":   true,
	"style":    true,
	"textarea": true,
}

// Child content of these elements are parsed as raw text instead of HTML
func isRawTextContentElementTagName(tagName string) bool {
	return rawTextContentTagNames[tagName] || false
}

var voidTagNames = map[string]bool{
	"area":   true,
	"base":   true,
	"br":     true,
	"col":    true,
	"embed":  true,
	"hr":     true,
	"img":    true,
	"input":  true,
	"link":   true,
	"meta":   true,
	"param":  true,
	"source": true,
	"track":  true,
	"wbr":    true,
}

func isVoidTag(tagName string) bool {
	return voidTagNames[tagName] || false
}
