/**
 * @param {string} char
 * @returns {number}
 */
export const asCharCode = (char) =>
  /** @type {number} **/ (char.codePointAt(0));

const _32BitIntMask = 0xff0000;
/**
 * @param {number} codePoint
 * @returns {boolean}
 */
const is32BitInt = (codePoint) => (codePoint & _32BitIntMask) > 0;

/**
 * @param {string} str
 * @returns {number[]}
 */
export const asCodePointString = (str) => {
  const strLen = str.length;
  const codePoints = new Array(str.length);

  for (
    let strIndex = 0, codeIndex = 0;
    strIndex < strLen;
    ++strIndex, ++codeIndex
  ) {
    const codePoint = str.codePointAt(strIndex);
    if (codePoint === undefined) {
      break;
    }

    codePoints[codeIndex] = codePoint;
    if (is32BitInt(codePoint)) {
      // Strings are indexed by 16-bit code units, so if we just got a 32-bit code point,
      // we need to skip the next code unit
      ++strIndex;
      --codePoints.length;
    }
  }

  return codePoints;
};

/**
 * Takes a Uint8Array of UTF-8 encoded text and returns an array of code points
 * @param {Uint8Array} bufferView
 * @returns {number[] | Error}
 */
export const getCodePointsFromUTF8BufferView = (bufferView) => {
  /**
   * @type {number[]}
   */
  const codePoints = new Array(bufferView.length);
  let codePointIndex = 0;

  for (
    let byteReadIndex = 0, bufferLen = bufferView.length;
    byteReadIndex < bufferLen;
    ++byteReadIndex, ++codePointIndex
  ) {
    const firstByte = bufferView[byteReadIndex];

    if (firstByte < 0x80) {
      // 1-byte sequence
      codePoints[codePointIndex] = firstByte;
    } else if (firstByte >= 0xc0 && firstByte <= 0xdf) {
      // 2-byte sequence
      codePoints[codePointIndex] =
        ((firstByte & 0x1f) << 6) | (bufferView[++byteReadIndex] & 0x3f);
    } else if (firstByte >= 0xe0 && firstByte <= 0xef) {
      // 3-byte sequence
      codePoints[codePointIndex] =
        ((firstByte & 0x0f) << 12) |
        ((bufferView[++byteReadIndex] & 0x3f) << 6) |
        (bufferView[++byteReadIndex] & 0x3f);
    } else if (firstByte >= 0xf0 && firstByte <= 0xf7) {
      // 4-byte sequence
      codePoints[codePointIndex] =
        ((firstByte & 0x07) << 18) |
        ((bufferView[++byteReadIndex] & 0x3f) << 12) |
        ((bufferView[++byteReadIndex] & 0x3f) << 6) |
        (bufferView[++byteReadIndex] & 0x3f);
    } else {
      return new Error(`Invalid UTF-8 leading byte: ${firstByte}`);
    }
  }

  // Trim off any unused array slots due to multi-byte code points
  codePoints.length = codePointIndex;

  return codePoints;
};

const LOWER_A = 97;
const LOWER_Z = 122;
const UPPER_A = 65;
const UPPER_Z = 90;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isLetter = (charCode) =>
  (charCode >= LOWER_A && charCode <= LOWER_Z) ||
  (charCode >= UPPER_A && charCode <= UPPER_Z);

const SPACE = 32;
const TAB = 9;
const NEWLINE = 10;
const VERTICAL_TAB = 11;
const FORM_FEED = 12;
const CARRIAGE_RETURN = 13;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isLineBreak = (charCode) =>
  charCode >= NEWLINE && charCode <= CARRIAGE_RETURN;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isWhitespace = (charCode) =>
  charCode === SPACE || (charCode >= TAB && charCode <= CARRIAGE_RETURN);

const UNDERSCORE = 95;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isLegalLeadingTagNameChar = (charCode) =>
  isLetter(charCode) || charCode === UNDERSCORE;

const ONE = 49;
const NINE = 57;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isNumber = (charCode) => charCode >= ONE && charCode <= NINE;

const HYPHEN = 45;
const PERIOD = 46;
const COLON = 58;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isHyphen = (charCode) => charCode === HYPHEN;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
const isLegalTagNameSpecialChar = (charCode) =>
  charCode === HYPHEN ||
  charCode === PERIOD ||
  charCode === COLON ||
  charCode === UNDERSCORE;

const PCEN_CHAR_RANGES = [
  //
  0xc0, 0xd6,
  //
  0xd8, 0xf6,
  //
  0xf8, 0x37d,
  //
  0x37f, 0x1fff,
  //
  0x200c, 0x200d,
  //
  0x203f, 0x2040,
  //
  0x2070, 0x218f,
  //
  0x2c00, 0x2fef,
  //
  0x3001, 0xd7ff,
  //
  0xf900, 0xfdcf,
  //
  0xfdf0, 0xfffd,
  //
  0x10000, 0xeffff,
];

/**
 * Test if the character is a valid PCEN ("PotentialCustomElementName") unicode character for a tag name
 * @param {number} charCode
 * @returns {boolean}
 */
export const isPCENChar = (charCode) => {
  for (let i = 0; i < PCEN_CHAR_RANGES.length; i += 2) {
    if (
      charCode >= /** @type {number} */ (PCEN_CHAR_RANGES[i]) &&
      charCode <= /** @type {number} */ (PCEN_CHAR_RANGES[i + 1])
    ) {
      return true;
    }
  }

  return false;
};

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isLegalTagNameChar = (charCode) =>
  isLegalTagNameSpecialChar(charCode) ||
  isLetter(charCode) ||
  isNumber(charCode) ||
  isPCENChar(charCode);

const SINGLE_QUOTE = 39;
const DOUBLE_QUOTE = 34;
const BACKTICK = 96;

/**
 *
 * @param {number} charCode
 * @returns {boolean}
 */
export const isScriptQuoteChar = (charCode) =>
  charCode === SINGLE_QUOTE ||
  charCode === DOUBLE_QUOTE ||
  charCode === BACKTICK;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isStyleQuoteChar = (charCode) =>
  charCode === SINGLE_QUOTE || charCode === DOUBLE_QUOTE;

const rawTextContentTagnames = Object.freeze({
  script: true,
  style: true,
  textarea: true,
  title: true,
});

/**
 * @param {string} tagName
 * @returns {boolean}
 */
export const isRawTextContentElementTagname = (tagName) =>
  Object.hasOwn(rawTextContentTagnames, tagName);

const voidTagnames = Object.freeze({
  area: true,
  base: true,
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true,
});

/**
 * @param {string} tagName
 * @returns {boolean}
 */
export const isVoidElementTagname = (tagName) =>
  Object.hasOwn(voidTagnames, tagName);

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isAttributeValueQuoteChar = (charCode) =>
  charCode === SINGLE_QUOTE || charCode === DOUBLE_QUOTE;

export const LT = 60;
export const GT = 62;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isTagStartBracket = (charCode) => charCode === LT;
/**
 *
 * @param {number} charCode
 * @returns {boolean}
 */
export const isTagEndBracket = (charCode) => charCode === GT;

export const FWD_SLASH = 47;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isForwardSlash = (charCode) => charCode === FWD_SLASH;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isEndOfTagChar = (charCode) =>
  charCode === GT || charCode === FWD_SLASH;

const EQUALS = 61;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isAttributeEqualsChar = (charCode) => charCode === EQUALS;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isLegalAttributeNameChar = (charCode) =>
  !(
    isAttributeEqualsChar(charCode) ||
    isWhitespace(charCode) ||
    isEndOfTagChar(charCode) ||
    isAttributeValueQuoteChar(charCode)
  );

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isLegalUnquotedAttributeValueChar = (charCode) =>
  !(
    isWhitespace(charCode) ||
    isAttributeValueQuoteChar(charCode) ||
    isEndOfTagChar(charCode) ||
    isTagStartBracket(charCode)
  );

const EXCLAMATION_PT = 33;

/**
 * @param {number} charCode
 * @returns {boolean}
 */
export const isBang = (charCode) => charCode === EXCLAMATION_PT;

const BACKSLASH = 92;

/**
 * Count how many backslash escape characters precede the quote character.
 * If the count is even, the quote character is not escaped and is the closing quote character.
 * Examples:
 * "quote: \"" -> '"' is escaped, '"' is not"
 * "backslash: \\" -> '\' is escaped, '"' is not"
 * "backslash and quote: \\\"" -> '\' is escaped, '"' is escaped, final '"' is not
 * @param {number[]} precedingStringCharCodes - The string preceding the character which we are testing to see if it is escaped
 * @returns {boolean}
 */
export const isNextCharEscapedByPrecedingString = (
  precedingStringCharCodes
) => {
  let count = 0;
  for (let i = precedingStringCharCodes.length - 1; i >= 0; i--) {
    if (precedingStringCharCodes[i] === BACKSLASH) {
      ++count;
    } else {
      break;
    }
  }

  return count % 2 !== 0;
};

/**
 *
 * @param {number[]} a
 * @param {number[]} b
 * @param {number} [aOffset=0]
 * @param {number} [bOffset=0]
 */
export const doCodePointStringsMatch = (a, b, aOffset = 0, bOffset = 0) => {
  const aLength = a.length;
  const bLength = b.length;

  if (aOffset < 0) {
    aOffset = aLength + aOffset;
  }
  if (bOffset < 0) {
    bOffset = bLength + bOffset;
  }

  if (aOffset < 0 || aOffset > aLength || bOffset < 0 || bOffset > bLength) {
    return false;
  }

  for (let i = aOffset, j = bOffset; i < aLength && j < bLength; ++i, ++j) {
    if (a[i] !== b[j]) {
      return false;
    }
  }

  return true;
};
