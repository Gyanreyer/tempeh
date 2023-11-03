import { makeCursor } from "./stringReaderCursor.js";
import {
  isAttrValueQuoteChar,
  isEndOfTagContentChar,
  isNonWhiteSpaceChar,
  isWhiteSpaceChar,
} from "./charUtils.js";

/** @typedef {Record<string, string|true>} ElementAttributes */

const renderAttributeNames = {
  "#for": true,
  "#if": true,
  "#attr": true,
  "#with": true,
  "#data": true,
  "#cache": true,
  "#render": true,
  "#scoped": true,
  "#global": true,
  "#external": true,
  "#component": true,
  "#md": true,
  "#types": true,
  "#text": true,
  "#html": true,
};

/** @typedef {string|true} AttributeValue */

/** @typedef {{ [modifierKey: string]: AttributeValue }} AttributeWithModifiers */

/**
 * @typedef {{
 *  "#for"?: { [modifierKey: string]: string|true },
 *  "#if"?: { [modifierKey: string]: string|true },
 * }} RenderAttributes
 */

/**
 * @param {string} attributeName
 * @returns {attributeName is keyof typeof renderAttributeNames}
 */
const isValidRenderAttributeName = (attributeName) =>
  attributeName in renderAttributeNames;

/**
 * Illegal characters for attribute names or unquoted attribute values
 */
const illegalAttrChars = {
  "=": true,
  '"': true,
  "'": true,
  "`": true,
  "<": true,
};

/**
 * @param {string} char
 * @returns {char is keyof typeof illegalAttrChars}
 */
const isIllegalAttrChar = (char) =>
  char === "=" || char === '"' || char === "'" || char === "`" || char === "<";

/**
 * @param {string} char
 * @returns {boolean}
 */
const isEndOfAttributeName = (char) =>
  char === "=" || isEndOfTagContentChar(char) || isWhiteSpaceChar(char);

/**
 * @param {string} char
 * @returns {boolean}
 */
const isEndOfUnquotedAttributeValue = (char) =>
  isWhiteSpaceChar(char) ||
  isEndOfTagContentChar(char) ||
  isIllegalAttrChar(char);

/**
 * @param {string} attributeString
 */
export function parseAttributes(attributeString) {
  /** @type {ElementAttributes} */
  const attributes = {};
  /** @type {Record<string, { [modifierKey: string]: string | true }>} */
  const renderAttributes = {};

  const cursor = makeCursor(attributeString);

  while (!cursor.isAtEnd()) {
    // Advance until we hit a non-whitespace character; this is the start of the attribute name
    let char = cursor.advanceUntil(isNonWhiteSpaceChar);

    // If we hit the end of the string, we're done
    if (!char || isEndOfTagContentChar(char)) {
      break;
    } else if (isIllegalAttrChar(char)) {
      console.error(
        `Illegal character ${char} encountered while parsing attributes. The final output may not work as expected.`
      );
      break;
    }

    let attributeName = cursor.advanceUntil(isEndOfAttributeName, true);
    let attributeModifier = "";

    if (!attributeName) {
      console.error(
        "Failed to parse attribute name. The final output may not work as expected."
      );
      break;
    }

    if (attributeName[0] === ":") {
      // `:attrName` is a shorthand for `#attr:attrName`
      attributeName = `#attr${attributeName}`;
    }

    const isRenderAttribute = attributeName[0] === "#";

    if (isRenderAttribute) {
      [attributeName, attributeModifier = ""] = attributeName.split(":");
    }

    // Advance to the next non-whitespace char. If it's an "=" then we have an attribute value. Otherwise this is a boolean attribute.
    char = cursor.advanceUntil(isNonWhiteSpaceChar);
    if (char !== "=") {
      // If we didn't find an "=", then this is a boolean attribute with no value. Continue on to the next attribute!
      if (isRenderAttribute) {
        if (attributeName === "#") {
          // Skip # comment attributes
          continue;
        }

        const [renderAttributeName, renderAttributeModifier = ""] =
          attributeName.split(":");

        if (isValidRenderAttributeName(attributeName)) {
          (renderAttributes[attributeName] =
            renderAttributes[attributeName] || {})[attributeModifier] = true;
          continue;
        } else {
          console.error(
            `Invalid render attribute name encountered: ${attributeName}. The final output may not work as expected.`
          );
        }
      }

      attributes[attributeName] = true;
      continue;
    }

    // Skip the "=" char
    cursor.advanceCursor();
    // Advance to the next non-whitespace char. This is the start of the attribute value.
    char = cursor.advanceUntil(isNonWhiteSpaceChar);

    if (!char) {
      console.error(
        "Failed to parse attribute value. The final output may not work as expected."
      );
      // If we reached the end of the string without finding a value to go along with the equal sign, set the value to an empty string
      if (isRenderAttribute) {
        if (attributeName === "#") {
          // Skip # comment attributes
          break;
        }

        if (isValidRenderAttributeName(attributeName)) {
          (renderAttributes[attributeName] =
            renderAttributes[attributeName] || {})[attributeModifier] = "";
          break;
        } else {
          console.error(
            `Invalid render attribute name encountered: ${attributeName}. The final output may not work as expected.`
          );
        }
      }

      attributes[attributeName] = "";
      break;
    }

    let attributeValue = "";

    if (isAttrValueQuoteChar(char)) {
      // Advance past the quote char
      cursor.advanceCursor();

      // If we found a quote char, we're dealing with a quoted attribute value, so collect the value between the quotes
      const quoteChar = char;
      // Advance until the closing quote, skipping escaped chars
      attributeValue = cursor.advanceUntil(
        (currentChar, _, prevChar) =>
          prevChar !== "\\" && currentChar === quoteChar,
        true
      );

      if (attributeValue) {
        // Advance past the closing quote
        cursor.advanceCursor();
      }
    } else {
      // If we didn't find a quote char, we're dealing with an unquoted attribute value, so collect the value until we hit whitespace or the end of the tag
      attributeValue = cursor.advanceUntil(isEndOfUnquotedAttributeValue, true);

      char = cursor.peek();
      if (isIllegalAttrChar(char)) {
        console.error(
          `Illegal character ${char} encountered while parsing attributes. The final output may not work as expected.`
        );
      }
    }

    if (isRenderAttribute) {
      if (attributeName === "#") {
        // Skip # comment attributes
        continue;
      }

      if (isValidRenderAttributeName(attributeName)) {
        (renderAttributes[attributeName] =
          renderAttributes[attributeName] || {})[attributeModifier] =
          attributeValue;
        continue;
      } else {
        console.error(
          `Invalid render attribute name encountered: ${attributeName}. The final output may not work as expected.`
        );
      }
    }

    attributes[attributeName] = attributeValue;
  }

  return {
    attributes,
    renderAttributes,
  };
}
