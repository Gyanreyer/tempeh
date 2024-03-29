// Regex matches the last line of a JavaScript expression
const lastLineOfExpressionRegex = /([^;]+)[\s;]?$/;
// Regex matches a return statement so we can extract the returned value from the last line of an expression if necessary
const returnedValueRegex = /\breturn\s+(?<returnedValue>[^;]+)/;

const containsAwaitTokenRegex = /\bawait\b/;

/**
 * @param {string} dynamicContent
 */
export function parseDynamicAttributeContent(dynamicContent) {
  const lastLineOfExpressionMatch = dynamicContent.match(
    lastLineOfExpressionRegex
  );

  if (!lastLineOfExpressionMatch) {
    throw new Error(`Failed to parse expression: "${dynamicContent}"`);
  }

  const isAsync = containsAwaitTokenRegex.test(dynamicContent);

  let lastExpressionLine = lastLineOfExpressionMatch[0];
  const setupExpressionLines = dynamicContent
    .slice(0, lastLineOfExpressionMatch.index)
    .trim();

  const returnedValueMatch = lastExpressionLine.match(returnedValueRegex);
  if (returnedValueMatch?.groups?.returnedValue) {
    // If the last line is a return statement, we should strip the last line down
    // to just the value being returned
    lastExpressionLine = returnedValueMatch.groups.returnedValue;
  }

  lastExpressionLine = lastExpressionLine.trim();

  return {
    setupExpressionLines,
    lastExpressionLine,
    isAsync,
  };
}
