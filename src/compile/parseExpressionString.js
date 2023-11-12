// Regex matches the last line of a JavaScript expression
const lastLineOfExpressionRegex = /;?(.+)[;\s]?$/;

const asyncExpressionRegex = /\b(async|await|Promise)\b/;

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

  const isAsync = asyncExpressionRegex.test(expressionString);

  return {
    expressionCode: setupExpressionLines
      ? `${isAsync ? "await (async " : "("}()=>{
    ${setupExpressionLines}
    return ${lastExpressionLine}
  })()`
      : lastExpressionLine,
    isAsync,
  };
}
