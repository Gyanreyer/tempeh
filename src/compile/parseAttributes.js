import { makeCursor } from "./stringReaderCursor.js";
import {
  isAttrValueQuoteChar,
  isNonWhiteSpaceChar,
  isTagEndChar,
  isWhiteSpaceChar,
} from "./charUtils.js";

/** @typedef {Record<string, string|boolean>} ElementAttributes */

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
  "#": true,
};

/**
 * @typedef {{ [key in keyof typeof renderAttributeNames]?: { modifier: string | null, value: string|boolean } }} RenderAttributes
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
const isIllegalAttrChar = (char) => char in illegalAttrChars;

/**
 * @param {string} char
 * @returns {boolean}
 */
const isEndOfAttributeName = (char) =>
  char === "=" || isTagEndChar(char) || isWhiteSpaceChar(char);

/**
 * @param {string} char
 * @returns {boolean}
 */
const isEndOfUnquotedAttributeValue = (char) =>
  isWhiteSpaceChar(char) || isTagEndChar(char) || isIllegalAttrChar(char);

/**
 * @param {string} attributeString
 */
export function parseAttributes(attributeString) {
  /** @type {ElementAttributes} */
  const attributes = {};
  /** @type {RenderAttributes} */
  const renderAttributes = {};

  const cursor = makeCursor(attributeString);

  while (!cursor.isAtEnd()) {
    // Advance until we hit a non-whitespace character; this is the start of the attribute name
    let char = cursor.advanceUntil(isNonWhiteSpaceChar);

    // If we hit the end of the string, we're done
    if (!char || isTagEndChar(char)) {
      break;
    } else if (isIllegalAttrChar(char)) {
      console.error(
        `Illegal character ${char} encountered while parsing attributes. The final output may not work as expected.`
      );
      break;
    }

    let attributeName = cursor.advanceUntil(isEndOfAttributeName, true);
    /** @type {string | null} */
    let attributeModifier = null;

    if (!attributeName) {
      console.error(
        "Failed to parse attribute name. The final output may not work as expected."
      );
      break;
    }

    let isRenderAttribute = false;

    if (attributeName[0] === ":") {
      // `:attrName` is a shorthand for `#attr:attrName`
      attributeName = `#attr${attributeName}`;
    }

    if (attributeName[0] === "#") {
      const splitAttributeName = attributeName.split(":");
      if (isValidRenderAttributeName(splitAttributeName[0])) {
        isRenderAttribute = true;
        attributeName = splitAttributeName[0];
        attributeModifier = splitAttributeName[1] || null;
      } else {
        console.error(
          `Invalid render attribute name encountered: ${attributeName}. The final output may not work as expected.`
        );
      }
    }

    // Advance to the next non-whitespace char. If it's an "=" then we have an attribute value. Otherwise this is a boolean attribute.
    char = cursor.advanceUntil(isNonWhiteSpaceChar);
    if (char !== "=") {
      // If we didn't find an "=", then this is a boolean attribute with no value. Continue on to the next attribute!
      if (isRenderAttribute) {
        renderAttributes[
          /** @type {keyof typeof renderAttributes} */ (attributeName)
        ] = {
          modifier: attributeModifier,
          value: true,
        };
      } else {
        attributes[attributeName] = true;
      }

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
        renderAttributes[
          /** @type {keyof typeof renderAttributes} */ (attributeName)
        ] = {
          modifier: attributeModifier,
          value: "",
        };
      } else {
        attributes[attributeName] = "";
      }
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
      renderAttributes[
        /** @type {keyof typeof renderAttributes} */ (attributeName)
      ] = {
        modifier: attributeModifier,
        value: attributeValue,
      };
    } else {
      attributes[attributeName] = attributeValue;
    }
  }

  return {
    attributes,
    renderAttributes,
  };
}
