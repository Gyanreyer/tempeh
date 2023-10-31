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

/** @typedef {TmphElement | string} TmphNode */

/**
 * @typedef {Object} TmphElement
 * @property {string} tagName
 * @property {import("./parseAttributes").ElementAttributes} attributes - Normal attributes which will be included in the final HTML.
 * @property {import("./parseAttributes").RenderAttributes} renderAttributes - Special tagged attributes which inform how the element should be rendered, but will be stripped from the final HTML.
 * @property {Array<TmphNode>} children
 * @property {TmphElement | null} parent
 */

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

  /** @type {TmphElement | null} */
  let currentParentElement = null;

  /**
   * @param {TmphNode} element
   */
  const addElement = (element) => {
    if (!element) {
      return;
    }

    if (currentParentElement) {
      currentParentElement.children.push(element);
    } else {
      elements.push(element);
    }
  };

  const cursor = makeCursor(componentString);

  while (!cursor.isAtEnd()) {
    // Skip whitespace until we hit some content
    let char = cursor.advanceUntil(isNonWhiteSpaceChar);

    if (char === "<") {
      if (cursor.peekNext() === "/") {
        // This is a closing tag. Let's move ahead to the start of the tag name.
        if (
          !cursor.advanceUntil(
            (char) => char !== "<" && char !== "/" && !isWhiteSpaceChar(char)
          )
        ) {
          throw new Error(
            "Something went wrong while parsing closing tag name from component string"
          );
        }

        const tagName = cursor.advanceUntil(isEndOfTagName, true);

        if (!currentParentElement) {
          throw new Error(
            `Closing tag "${tagName}" found without matching opening tag`
          );
        }

        /** @type {TmphElement} */
        let closingElement = currentParentElement;

        if (currentParentElement.tagName === tagName) {
          currentParentElement = closingElement.parent;
        } else {
          while (
            currentParentElement &&
            currentParentElement.tagName !== tagName
          ) {
            closingElement = currentParentElement;
            currentParentElement = closingElement.parent;
          }
        }

        cursor.advanceUntil((char, nextChar, prevChar) => prevChar === ">");
        continue;
      }

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

      /** @type {TmphElement} */
      const element = {
        tagName,
        attributes,
        renderAttributes,
        children: [],
        parent: currentParentElement,
      };

      addElement(element);

      if (!isSelfClosing) {
        currentParentElement = element;
      }

      // Advance the cursor outside of the tag
      cursor.advanceUntil((char, nextChar, prevChar) => prevChar === ">");
    } else {
      const textContent = cursor.advanceUntil(isTagStartChar, true);
      addElement(textContent);
    }
  }

  return elements;
}
