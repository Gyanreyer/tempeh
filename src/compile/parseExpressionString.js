import { getRandomString } from "../utils/getRandomString.js";

// Regex matches the last line of a JavaScript expression
const lastLineOfExpressionRegex = /;?(.+)[;\s]?$/;

/**
 * @param {unknown} expressionString
 */
export function processExpressionString(
  expressionString,
  resultVariableName = `__tmph_expr__${getRandomString()}`
) {
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
  const code = expressionString.slice(0, lastLineOfExpressionMatch.index);

  return {
    code: `
      ${code}
      let ${resultVariableName} = (${lastExpressionLine});
    `,
    resultVariableName,
  };
}
