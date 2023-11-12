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
  switch (typeof text) {
    case "string":
      return text.replace(escapedCharRegex, replaceEscapedChar);
    case "boolean":
    case "number":
    case "bigint":
      // Numbers and booleans can safely be directly converted to strings
      return String(text);
    case "object":
      if (text === null) {
        return "";
      }
      // Omit objects, functions, and symbols to avoid unintentionally leaking information to the client
      return "__OBJECT OMITTED__";
    case "function":
      return "__FUNCTION OMITTED__";
    case "symbol":
      return "__SYMBOL OMITTED__";
    default:
      return "";
  }
}
