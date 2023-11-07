const whiteSpaceRegex = /\s/;

const attributeQuoteRegex = /['"]/;

const endOfTagNameRegex = /[\s\/>]/;

const endOfAttributeNameRegex = /[\s=\/>]/;

const endOfTagRegex = /[\/>]/;

const validTagNameFirstCharacterRegex = /[a-zA-Z]/;

const strippableWhitespaceRegex = /[\r\n]+[\t ]*/g;
const multipleSpacesRegex = / {2,}/g;

const leadingAndTrailingLineBreaksRegex = /^[\r\n]+|[\r\n]+$/g;

/**
 * @typedef {Object} TmphNode
 * @property {string|null} tagName
 * @property {Array<TmphNode | string>|null} children
 * @property {Record<string, string|true>|null} attributes
 */

class Cursor {
  index = 0;
  string = "";

  get currentCharacter() {
    return this.string[this.index];
  }

  get nextCharacter() {
    return this.string[this.index + 1];
  }

  get previousCharacter() {
    return this.string[this.index - 1];
  }

  /**
   * @param {string} string
   */
  constructor(string) {
    this.string = string;
  }

  skipWhiteSpace() {
    // Keep moving forward until we hit a non-whitespace character, or reach the end of the string
    while (
      this.currentCharacter &&
      whiteSpaceRegex.test(this.currentCharacter)
    ) {
      ++this.index;
    }
  }

  /**
   * Call this after hitting a `<` character to get the tag name of the element
   */
  readTagName() {
    const startIndex = this.index;

    while (
      this.currentCharacter &&
      !endOfTagNameRegex.test(this.currentCharacter)
    ) {
      ++this.index;
    }

    return this.string.slice(startIndex, this.index);
  }

  readAttributeName() {
    this.skipWhiteSpace();

    const startIndex = this.index;

    while (
      this.currentCharacter &&
      // Keep going until we hit a space, =, >, or /
      !endOfAttributeNameRegex.test(this.currentCharacter)
    ) {
      ++this.index;
    }

    return this.string.slice(startIndex, this.index);
  }

  /**
   * Call this after hitting an `=` character after an attribute name in an opening tag
   */
  readAttributeValue() {
    while (this.currentCharacter && this.currentCharacter === "=") {
      ++this.index;
    }

    // Skip ahead to the first non-whitespace character after the =
    this.skipWhiteSpace();

    const openingQuoteCharacter = this.currentCharacter;
    let startIndex = this.index;
    let endIndex = this.index;

    if (!attributeQuoteRegex.test(openingQuoteCharacter)) {
      // If it's an un-quoted attribute, read until we hit whitespace
      while (
        this.currentCharacter &&
        !whiteSpaceRegex.test(this.currentCharacter)
      ) {
        ++this.index;
      }
      endIndex = this.index;
    } else {
      // Shift up to the first character after the opening quote
      ++this.index;
      startIndex = this.index;
      endIndex = this.index;

      // Read until we hit the closing quote character, ignoring escaped quotes
      while (
        this.currentCharacter &&
        (this.currentCharacter !== openingQuoteCharacter ||
          this.previousCharacter === "\\")
      ) {
        ++this.index;
      }

      endIndex = this.index;

      // Advance the cursor past the closing quote character
      ++this.index;
    }

    return this.string.slice(startIndex, endIndex);
  }

  readAttributes() {
    this.skipWhiteSpace();

    /** @type {TmphNode["attributes"]} */
    let attributes = null;

    while (
      this.currentCharacter &&
      !endOfTagRegex.test(this.currentCharacter)
    ) {
      const attributeName = this.readAttributeName();

      if (!attributeName) {
        break;
      }

      if (this.currentCharacter === "=") {
        const attributeValue = this.readAttributeValue();
        (attributes ??= {})[attributeName] = attributeValue;
      } else {
        (attributes ??= {})[attributeName] = true;
      }
    }

    return attributes;
  }

  /**
   * Call this after encountering a `<` character to read the contents of the tag
   *
   * @returns {TmphNode}
   */
  readOpeningTag() {
    // Advance past the `<` character
    while (
      this.currentCharacter &&
      (this.currentCharacter === "<" ||
        whiteSpaceRegex.test(this.currentCharacter))
    ) {
      ++this.index;
    }

    const tagName = this.readTagName();

    const attributes = this.readAttributes();

    const isVoid = this.currentCharacter === "/";

    while (this.currentCharacter && this.previousCharacter !== ">") {
      ++this.index;
    }

    return {
      tagName,
      attributes,
      children: isVoid ? null : [],
    };
  }

  /** Call this after encountering a `</` character combo */
  readClosingTag() {
    while (
      this.currentCharacter &&
      (this.currentCharacter === "<" || this.currentCharacter === "/")
    ) {
      ++this.index;
    }

    const tagName = this.readTagName();

    // Continue until we hit the end of the tag
    while (this.currentCharacter && this.previousCharacter !== ">") {
      ++this.index;
    }

    return {
      tagName,
    };
  }

  /**
   * Reads until it finds a matching closing tag for an element, skipping processing for anything that looks like a nested element
   * This is necessary for <script> and <style> tags which can contain arbitrary text
   *
   * @param {string} tagName
   */
  readToMatchingClosingTag(tagName) {
    const startIndex = this.index;

    while (this.currentCharacter) {
      if (this.nextCharacter === "<") {
        let lookAheadIndex = this.index + 2;

        while (
          this.string[lookAheadIndex] &&
          whiteSpaceRegex.test(this.string[lookAheadIndex])
        ) {
          ++lookAheadIndex;
        }

        // It's a closing tag!
        if (this.string[lookAheadIndex] === "/") {
          while (
            this.string[lookAheadIndex] &&
            (this.string[lookAheadIndex] === "/" ||
              whiteSpaceRegex.test(this.string[lookAheadIndex]))
          ) {
            ++lookAheadIndex;
          }

          if (!this.string[lookAheadIndex]) {
            this.index = lookAheadIndex;
            break;
          }

          let tagNameStartIndex = lookAheadIndex;

          while (
            this.string[lookAheadIndex] &&
            !endOfTagNameRegex.test(this.string[lookAheadIndex])
          ) {
            ++lookAheadIndex;
          }

          if (
            this.string.slice(tagNameStartIndex, lookAheadIndex) === tagName
          ) {
            // We found the closing tag for the element we're looking for, so break out of the loop
            break;
          }
        }
      }

      ++this.index;
    }

    const textContent = this.string.slice(startIndex, this.index);

    // Advance the cursor past the closing tag
    while (this.currentCharacter && this.previousCharacter !== ">") {
      ++this.index;
    }

    return textContent;
  }

  readUntilTag() {
    const startIndex = this.index;

    while (
      this.currentCharacter &&
      !(
        // Keep going until we hit a "<" character followed immediately by a letter, signifying an opening tag, or a "<" character followed by a "/" and a letter, signifying a closing tag
        (
          this.currentCharacter === "<" &&
          ((this.nextCharacter === "/" &&
            validTagNameFirstCharacterRegex.test(
              this.string[this.index + 2]
            )) ||
            validTagNameFirstCharacterRegex.test(this.nextCharacter))
        )
      )
    ) {
      ++this.index;
    }

    // if the first character after the "<" is a "/", then we're looking at a closing tag
    const isClosingTag = this.nextCharacter === "/";

    return {
      text: this.string.slice(startIndex, this.index),
      isClosingTag,
    };
  }
}

/**
 * @typedef {Object} RootTmphNode
 * @property {null} tagName
 * @property {null} attributes
 * @property {Array<TmphNode | string>} children
 */

/**
 *
 * @param {string} xmlString
 */
export function parseXML(xmlString) {
  const cursor = new Cursor(xmlString);

  /** @type {RootTmphNode} */
  const root = {
    tagName: null,
    attributes: null,
    children: [],
  };

  /** @type {Array<TmphNode>} */
  let nodeTree = [root];

  while (cursor.currentCharacter) {
    let currentNode = nodeTree[nodeTree.length - 1];

    const { text, isClosingTag } = cursor.readUntilTag();
    if (text) {
      currentNode.children ??= [];

      // <pre> tags should have whitespace preserved
      const shouldPreserveWhitespace = currentNode.tagName === "pre";

      if (shouldPreserveWhitespace) {
        currentNode.children.push(text);
      } else {
        const flattenedText = text
          // Strip all meaningless whitespace
          .replaceAll(strippableWhitespaceRegex, "")
          // Flatten multiple spaces into a single space
          .replaceAll(multipleSpacesRegex, " ");

        if (flattenedText) {
          currentNode.children.push(flattenedText);
        }
      }
    }

    if (!cursor.currentCharacter) {
      // We hit the end of the string, so break out of the loop
      break;
    }

    if (isClosingTag) {
      const { tagName } = cursor.readClosingTag();

      while (currentNode !== root) {
        const currentNodeTagName = currentNode.tagName;
        // Drop the last item from the node tree
        nodeTree.length -= 1;
        currentNode = nodeTree[nodeTree.length - 1];

        if (currentNodeTagName === tagName) {
          // If we just closed the node we were looking for, break out of the loop
          break;
        }
      }
    } else {
      const openingTag = cursor.readOpeningTag();

      if (openingTag.tagName === "script" || openingTag.tagName === "style") {
        const text = cursor
          .readToMatchingClosingTag(openingTag.tagName)
          // Remove all leading and trailing line breaks
          .replaceAll(leadingAndTrailingLineBreaksRegex, "");
        openingTag.children = [text];
        (currentNode.children ??= []).push(openingTag);
      } else {
        (currentNode.children ??= []).push(openingTag);
        if (openingTag.children) {
          nodeTree.push(openingTag);
          currentNode = openingTag;
        }
      }
    }
  }

  return root;
}
