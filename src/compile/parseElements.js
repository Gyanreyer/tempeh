import {
  isAttrValueQuoteChar,
  isNonWhiteSpaceChar,
  isTagEndChar,
  isTagStartChar,
  isWhiteSpaceChar,
} from "./charUtils.js";
import { parseAttributes } from "./parseAttributes.js";
import { makeCursor } from "./stringReaderCursor.js";

/** @typedef {import("./parseAttributes").ElementAttributes} ElementAttributes */
/** @typedef {import("./parseAttributes").RenderAttributes} RenderAttributes */

/**
 * @typedef {Object} TmphTextNode
 * @property {string} textContent
 */

/**
 * @typedef {Object} TmphElement
 * @property {string} tagName
 * @property {import("./parseAttributes").ElementAttributes} attributes - Normal attributes which will be included in the final HTML.
 * @property {import("./parseAttributes").RenderAttributes} renderAttributes - Special tagged attributes which inform how the element should be rendered, but will be stripped from the final HTML.
 * @property {Array<TmphTextNode | TmphElement> | null} children
 * @property {TmphElement | null} parentElement
 */

/** @typedef {TmphTextNode | TmphElement} TmphNode */

/**
 *
 * @param {string} componentString
 * @param {number} cursorPosition
 * @param {TmphElement | null} parentElement
 *
 * @returns {TmphElement}
 */
export function parseTag(componentString, cursorPosition, parentElement) {
  /** @type {string | undefined} */
  let previousChar;
  /** @type {string | undefined} */
  let currentChar = componentString[cursorPosition];
  /** @type {string | undefined} */
  let nextChar = componentString[cursorPosition + 1];

  const advanceCursor = () => {
    previousChar = currentChar;
    currentChar = nextChar;
    ++cursorPosition;
    nextChar = componentString[cursorPosition + 1];

    return currentChar;
  };

  if (currentChar === "<") {
    advanceCursor();
  }

  while (currentChar && isWhiteSpaceChar(currentChar)) {
    advanceCursor();
  }

  /** @type {string} */
  let tagName = "";

  while (
    // Keep going until we hit the end of the string or the end of the tag
    currentChar &&
    currentChar !== ">" &&
    // If we hit a whitespace character
    // we have hit the end of the tagName
    !isWhiteSpaceChar(currentChar)
  ) {
    tagName += currentChar;

    advanceCursor();
  }

  // Parse attributes
  /** @type {import("./parseAttributes").ElementAttributes} */
  let attributes = {};
  /** @type {ElementAttributes} */
  let renderAttributes = {};

  while (currentChar && currentChar !== ">") {
    while (isWhiteSpaceChar(currentChar)) {
      advanceCursor();
    }

    if (currentChar === ">") {
      break;
    }

    /** @type {string} */
    let attributeName = "";

    let attributeHasValue = false;

    // Collect the attribute name
    attributeNameLoop: while (currentChar && currentChar !== ">") {
      // If the character is a whitespace character, we've reached the end of the attribute name.
      // However, we need to keep going in case there's an equal sign which would indicate an attribute value.
      while (isWhiteSpaceChar(currentChar) && nextChar) {
        if (!isWhiteSpaceChar(nextChar)) {
          attributeHasValue = nextChar === "=";
          break attributeNameLoop;
        }

        advanceCursor();
      }

      if (currentChar === "=") {
        attributeHasValue = true;
        break attributeNameLoop;
      }

      attributeName += currentChar;

      advanceCursor();
    }

    advanceCursor();

    if (!attributeHasValue) {
      attributes[attributeName] = true;
      continue;
    }

    /** @type {string} */
    let attributeValue = "";

    // Skip whitespace until we hit a value
    while (isWhiteSpaceChar(currentChar)) {
      advanceCursor();
    }

    if (currentChar === ">") {
      attributes[attributeName] = "";
      break;
    }

    if (isAttrValueQuoteChar(currentChar)) {
      /** @type {string} */
      const attrValueQuoteChar = currentChar;
      advanceCursor();
      while (currentChar) {
        // Keep going until we hit the closing quote character,
        // skipping escaped quote characters
        if (previousChar !== "\\" && currentChar === attrValueQuoteChar) {
          break;
        }

        attributeValue += currentChar;
        advanceCursor();
      }
    } else {
      // Unquoted attribute values can go until we hit whitespace or the end of the tag
      while (
        currentChar &&
        currentChar !== ">" &&
        !isWhiteSpaceChar(currentChar)
      ) {
        attributeValue += currentChar;
        advanceCursor();
      }
    }

    attributes[attributeName] = attributeValue;

    if (currentChar !== ">") {
      advanceCursor();
    }
  }

  return {
    tagName,
    attributes,
    renderAttributes,
    parentElement,
    children: [],
  };
}

/**
 * @param {string} char
 */
const isEndOfTagName = (char) => isWhiteSpaceChar(char) || isTagEndChar(char);

/**
 *
 * @param {string} componentString
 */
export function parseElements(componentString) {
  /** @type {Array<TmphNode>} */
  const elements = [];

  const cursor = makeCursor(componentString);

  // Skip whitespace until we hit some content
  let char = cursor.advanceUntil(isNonWhiteSpaceChar);

  if (char === "<") {
    /** @type {string | null} */
    let tagName = null;

    // Skip the "<" char
    cursor.advanceCursor();
    // Advance until we hit a non-whitespace character; this is the start of the tag name
    cursor.advanceUntil(isNonWhiteSpaceChar);
    // Collect all chars until we hit a whitespace character; this is the end of the tag name
    tagName = cursor.advanceUntil(isEndOfTagName, true);
    if (!tagName) {
      throw new Error(
        "Something went wrong while parsing tag name from component string"
      );
    }

    // Collect all chars between the tag name and the end of the tag; these are the attributes.
    // We'll need to do some extra work to parse them in to an object.
    const attributeString = cursor.advanceUntil(isTagEndChar, true);

    const { attributes, renderAttributes } = parseAttributes(
      attributeString || ""
    );

    const isSelfClosing = cursor.peekPrev() === "/";
    elements.push({
      tagName,
      attributes,
      renderAttributes,
      children: isSelfClosing ? null : [],
      parentElement: null,
    });
  } else {
    const textContent = cursor.advanceUntil(isTagStartChar, true) || "";
    elements.push({ textContent });
  }

  return elements;
}
