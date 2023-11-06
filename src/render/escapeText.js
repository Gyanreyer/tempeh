/**
 * Escapes special characters and HTML entities in a way that is safe to use
 * within HTML content.
 *
 * @type {Record<string, string>}
 */
const escapedCharMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
};

// Only escape '&' if it's not part of an HTML entity; everything else can be directly escaped
const escapedCharRegex = /(&(?![\w\d]+;))|[<>"'`\/]/g;

/**
 * Replace matched characters with their escaped equivalents
 * @param {string} matchChar
 */
const replaceEscapedChar = (matchChar) =>
  escapedCharMap[matchChar] || matchChar;

/**
 * Takes a string which could potentially include unsafe HTML characters and escapes them.
 *
 * @param {unknown} text
 */
export default function escapeText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(escapedCharRegex, replaceEscapedChar);
}
