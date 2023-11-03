/**
 * @param {string} char
 */
export const isWhiteSpaceChar = (char) =>
  char === " " || char === "\t" || char === "\n" || char === "\r";

/**
 * @param {string} char
 */
export const isNonWhiteSpaceChar = (char) => !isWhiteSpaceChar(char);

/**
 * @param {string} char
 */
export const isAttrValueQuoteChar = (char) =>
  char === "'" || char === '"' || char === "`";

/**
 * @param {string} char
 */
export const isTagStartChar = (char) => char === "<";

/**
 * @param {string} char
 */
export const isTagEndChar = (char) => char === ">";

/**
 * @param {string} char
 */
export const isEndOfTagContentChar = (char) =>
  isTagEndChar(char) || char === "/";
