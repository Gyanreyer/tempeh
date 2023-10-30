const whiteSpaceChars = { " ": true, "\t": true, "\n": true, "\r": true };

/**
 * @param {string} char
 */
export const isWhiteSpaceChar = (char) => char in whiteSpaceChars;

/**
 * @param {string} char
 */
export const isNonWhiteSpaceChar = (char) => !isWhiteSpaceChar(char);

const attrValueQuoteChars = { "'": true, '"': true, "`": true };

/**
 * @param {string} char
 * @returns {char is keyof typeof attrValueQuoteChars}
 */
export const isAttrValueQuoteChar = (char) => char in attrValueQuoteChars;

/**
 * @param {string} char
 */
export const isTagStartChar = (char) => char === "<";

const tagEndChar = { ">": true, "/": true };

/**
 * @param {string} char
 */
export const isTagEndChar = (char) => char in tagEndChar;
