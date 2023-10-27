/**
 * @typedef {Object} TmphTextNode
 * @property {string} textContent
 */

/** @typedef {Record<string, string|boolean>} ElementAttributes */

const renderAttributeNames = {
  "#for": true,
  "#if": true,
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
 * @typedef {Object} TmphElement
 * @property {string} tagName
 * @property {ElementAttributes} attributes - Normal attributes which will be included in the final HTML.
 * @property {RenderAttributes} renderAttributes - Special tagged attributes which inform how the element should be rendered, but will be stripped from the final HTML.
 * @property {TmphTextNode | TmphElement[]} children
 * @property {TmphElement | null} parentElement
 */

/** @typedef {TmphTextNode | TmphElement} TmphNode */

const whiteSpaceChars = { " ": true, "\t": true, "\n": true, "\r": true };

/**
 * @param {string} char
 * @returns {char is keyof typeof whiteSpaceChars}
 */
const isWhiteSpaceChar = (char) => char in whiteSpaceChars;

const attrValueQuoteChars = { "'": true, '"': true };

/**
 * @param {string} char
 * @returns {char is keyof typeof attrValueQuoteChars}
 */
const isAttrValueQuoteChar = (char) => char in attrValueQuoteChars;

/**
 * @param {string} attributeName
 * @returns {attributeName is keyof typeof renderAttributeNames}
 */
const isRenderAttribute = (attributeName) =>
  attributeName in renderAttributeNames;

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
    ++cursorPosition;
    currentChar = componentString[cursorPosition];
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

  while (currentChar && isWhiteSpaceChar(currentChar)) {
    advanceCursor();
  }

  // Parse attributes
  /** @type {ElementAttributes} */
  let attributes = {};
  /** @type {ElementAttributes} */
  let renderAttributes = {};

  while (currentChar && currentChar !== ">") {
    /** @type {string} */
    let attributeName = currentChar;

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

    if (!attributeHasValue) {
      attributes[attributeName] = true;
      advanceCursor();
      continue;
    }

    advanceCursor();

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

// /**
//  * Takes a component file string and parses it into an array of objects representing the HTML.
//  *
//  * @param {string} componentString
//  */
// export function parseElements(componentString) {
//   /** @type {Node[]} */
//   const nodes = [];

//   /** @type {Node | null} */
//   let currentNodeRoot = null;
//   /** @type {Node | null} */
//   let currentNode = null;

//   let cursor = -1;
//   const stringLength = componentString.length;

//   while (++cursor < stringLength) {
//     switch (componentString[cursor]) {
//       case "<": {
//         /** @type {Element} */
//         const element = {
//           tagName: "",
//           attributes: {},
//           children: [],
//           parentElement: null,
//         };

//         let currentChar = "";
//         let isNextCharEscaped = false;

//         let tagName = "";

//         while (
//           ++cursor < stringLength &&
//           (currentChar = componentString[cursor]) !== ">"
//         ) {
//           if (currentChar in whiteSpaceChars && tagName) {
//             break;
//           }

//           tagName += currentChar;
//         }

//         element.tagName = tagName;

//         /** @type {string | null} */
//         let attributeName = null;
//         /** @type {string | true | null} */
//         let attributeValue = null;

//         while (
//           ++cursor < stringLength &&
//           (currentChar = componentString[cursor]) !== ">"
//         ) {
//           if (currentChar)
//             if (currentChar in attrValueQuoteChars) {
//               if (!attributeName) {
//                 console.error(
//                   "Found quoted attribute value without a name. This will not be included in the output HTML."
//                 );
//               }

//               attributeValue = "";

//               const attrValueOpeningQuoteChar = currentChar;
//               while (
//                 ++cursor < stringLength &&
//                 (currentChar = componentString[cursor]) !==
//                   attrValueOpeningQuoteChar
//               ) {
//                 if (currentChar === "\\") {
//                   isNextCharEscaped = true;
//                 } else if (
//                   currentChar in attrValueQuoteChars &&
//                   !isNextCharEscaped
//                 ) {
//                   // The value is now done!
//                   break;
//                 }

//                 attributeValue += currentChar;
//               }

//               continue;
//             }
//         }
//       }
//     }
//   }
// }
