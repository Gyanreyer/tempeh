// Regex matches the last line of a JavaScript expression
const lastLineOfExpressionRegex = /;?(.+)[;\s]?$/;

/**
 * @param {unknown} expressionString
 */
export function processExpressionString(expressionString) {
  if (typeof expressionString !== "string") {
    throw new Error("Received invalid expression value");
  }

  const lastLineOfExpressionMatch = expressionString.match(
    lastLineOfExpressionRegex
  );

  if (!lastLineOfExpressionMatch) {
    throw new Error(`Failed to parse expression: "${expressionString}"`);
  }

  const lastExpressionLine = lastLineOfExpressionMatch[0];
  const setupExpressionLines = expressionString
    .slice(0, lastLineOfExpressionMatch.index)
    .trim();

  return setupExpressionLines
    ? `(()=>{
    ${setupExpressionLines}
    return ${lastExpressionLine}
  })()`
    : lastExpressionLine;
}
