package main

import (
	"regexp"
)

// Note that this regex is not perfect as it will match string literals that contain the word "await"
// Writing perfect regex for this is not worth the performance and complexity cost.
var asyncTokenRegex = regexp.MustCompile(`[^\w.]await\b`)

func isAsyncExpression(expression string) bool {
	return asyncTokenRegex.MatchString(expression)
}

var propsTokenRegex = regexp.MustCompile(`\bprops\b`)

func doesExpressionReferenceProps(expression string) bool {
	return propsTokenRegex.MatchString(expression)
}
