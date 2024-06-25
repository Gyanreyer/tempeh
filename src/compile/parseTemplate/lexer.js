import { createReadStream } from "fs";
import {
  FWD_SLASH,
  LT,
  asCodePointString,
  doCodePointStringsMatch,
  getCodePointsFromUTF8BufferView,
  isAttributeEqualsChar,
  isAttributeValueQuoteChar,
  isBang,
  isEndOfTagChar,
  isForwardSlash,
  isHyphen,
  isLegalAttributeNameChar,
  isLegalLeadingTagNameChar,
  isLegalTagNameChar,
  isLegalUnquotedAttributeValueChar,
  isLineBreak,
  isNextCharEscapedByPrecedingString,
  isRawTextContentElementTagname,
  isScriptQuoteChar,
  isStyleQuoteChar,
  isTagEndBracket,
  isTagStartBracket,
  isVoidElementTagname,
  isWhitespace,
} from "./lexerUtils.js";

/**
 * Enum for lexer token types.
 * @readonly
 * @enum {typeof LexerTokenType[keyof typeof LexerTokenType]}
 */
export const LexerTokenType = Object.freeze({
  EOF: 0,
  ERROR: 1,
  TEXT_CONTENT: 2,
  OPENING_TAGNAME: 3,
  CLOSING_TAGNAME: 4,
  SELF_CLOSING_TAG_END: 5,
  ATTRIBUTE_NAME: 6,
  ATTRIBUTE_VALUE: 7,
  COMMENT: 8,
});

/**
 * @typedef LexerTokenWithValue
 * @property {typeof LexerTokenType["ERROR"
 *  | "TEXT_CONTENT"
 *  | "OPENING_TAGNAME"
 *  | "OPENING_TAGNAME"
 *  | "CLOSING_TAGNAME"
 *  | "ATTRIBUTE_NAME"
 *  | "ATTRIBUTE_VALUE"
 *  | "COMMENT"
 * ]} type
 * @property {string} value
 * @property {number} l - Line number
 * @property {number} c - Column number
 */

/**
 * @typedef LexerTokenWithNoValue
 * @property {typeof LexerTokenType["EOF" | "SELF_CLOSING_TAG_END"]} type
 * @property {never} [value]
 * @property {number} l - Line number
 * @property {number} c - Column number
 */

/**
 * @template {keyof typeof LexerTokenType} [T=keyof typeof LexerTokenType]
 * @typedef {(LexerTokenWithValue | LexerTokenWithNoValue) & {
 *  type: typeof LexerTokenType[T]
 * }} LexerToken
 */

/**
 * @typedef {() => Promise<[number, number, number] | LexerToken<"EOF" | "ERROR">>} PullCharFn

 * @typedef {() => undefined | LexerToken<"ERROR">} UnreadCharFn
 */

/**
 * @param {string} filePath
 * @returns {AsyncGenerator<LexerToken, void>}
 */
export async function* lex(filePath) {
  const readStream = createReadStream(filePath);

  /** @type {AsyncIterator<Buffer, unknown>} */
  const streamIterator = readStream[Symbol.asyncIterator]();

  /**
   * @type {number | undefined}
   */
  let lastReadCharCode = undefined;

  let line = 1;
  let lastReadCharLine = 1;

  let column = 0;
  let lastReadCharColumn = 0;

  /**
   * @type {number[]}
   */
  let bufferedCodePoints = [];
  let bufferedCharIndex = 0;

  /**
   * @type {PullCharFn}
   */
  const pullChar = async () => {
    if (bufferedCharIndex >= bufferedCodePoints.length) {
      const { value, done } = await streamIterator.next();
      if (done) {
        return {
          type: LexerTokenType.EOF,
          l: line,
          c: column,
        };
      }
      const codePointsResult = getCodePointsFromUTF8BufferView(
        new Uint8Array(value.buffer)
      );
      if (codePointsResult instanceof Error) {
        return {
          type: LexerTokenType.ERROR,
          value: codePointsResult.message,
          l: line,
          c: column,
        };
      }
      bufferedCodePoints = codePointsResult;
      bufferedCharIndex = 0;
    }

    lastReadCharLine = line;
    lastReadCharColumn = column;

    const charCodePoint = bufferedCodePoints[bufferedCharIndex];
    ++bufferedCharIndex;

    lastReadCharCode = charCodePoint;

    if (isLineBreak(charCodePoint)) {
      ++line;
      column = 0;
      return [charCodePoint, lastReadCharLine, lastReadCharColumn + 1];
    }

    return [charCodePoint, line, ++column];
  };

  /**
   * @type {UnreadCharFn}
   */
  const unreadChar = () => {
    if (lastReadCharCode) {
      line = lastReadCharLine;
      column = lastReadCharColumn;
      bufferedCodePoints.unshift(lastReadCharCode);
      lastReadCharCode = undefined;
    } else {
      return {
        type: LexerTokenType.ERROR,
        value: "Cannot unread a character that has not been read",
        l: line,
        c: column,
      };
    }

    return undefined;
  };

  /**
   * @type {LexerStateGenerator | null}
   */
  let tokenGenerator = lexTextContent(pullChar, unreadChar);
  while (tokenGenerator) {
    const { value, done } = await tokenGenerator.next();
    if (done) {
      tokenGenerator = value;
    } else {
      yield value;
    }
  }
}

/**
 * @template {keyof typeof LexerTokenType} [T=keyof typeof LexerTokenType]
 * @typedef {AsyncGenerator<LexerToken<T>, LexerStateGenerator | null>} LexerStateGenerator
 */

/**
 * @template {keyof typeof LexerTokenType} [T=keyof typeof LexerTokenType]
 * @typedef {(
 *  pullChar: PullCharFn,
 *  unreadChar: UnreadCharFn,
 * ) => LexerStateGenerator} LexerStateIterator
 */

/**
 * @type {LexerStateIterator<"TEXT_CONTENT" | "EOF" | "ERROR">}
 */
async function* lexTextContent(pullChar, unreadChar) {
  /**
   * @type {number|undefined}
   */
  let startLine;
  /**
   * @type {number|undefined}
   */
  let startColumn;

  /**
   * @type {number[]}
   */
  const textContentCodes = [];

  while (true) {
    let pullCharResult = await pullChar();

    if (!Array.isArray(pullCharResult)) {
      if (
        pullCharResult.type === LexerTokenType.EOF &&
        textContentCodes.length > 0
      ) {
        // If we have any text content buffered, yield it as a final token before EOF
        yield {
          type: LexerTokenType.TEXT_CONTENT,
          value: String.fromCodePoint(...textContentCodes),
          l: startLine ?? pullCharResult.l,
          c: startColumn ?? pullCharResult.c,
        };
      }
      yield pullCharResult;
      return null;
    }

    const [nextCharCode, nextLine, nextCol] = pullCharResult;

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    const textContentLength = textContentCodes.length;

    if (isLegalLeadingTagNameChar(nextCharCode)) {
      if (
        textContentLength > 0 &&
        isTagStartBracket(textContentCodes[textContentLength - 1])
      ) {
        // Splice off the "<" character we buffered before the tag name
        textContentCodes.splice(-1);

        const unreadErrToken = unreadChar();
        if (unreadErrToken) {
          yield unreadErrToken;
          return null;
        }

        yield {
          type: LexerTokenType.TEXT_CONTENT,
          value: String.fromCodePoint(...textContentCodes),
          l: startLine,
          c: startColumn,
        };
        return lexOpeningTagContents(pullChar, unreadChar);
      } else if (
        textContentLength >= 2 &&
        isTagStartBracket(textContentCodes[textContentLength - 2]) &&
        isForwardSlash(textContentCodes[textContentLength - 1])
      ) {
        textContentCodes.splice(-2);

        const unreadErrToken = unreadChar();
        if (unreadErrToken) {
          yield unreadErrToken;
          return null;
        }

        yield {
          type: LexerTokenType.TEXT_CONTENT,
          value: String.fromCodePoint(...textContentCodes),
          l: startLine,
          c: startColumn,
        };
        return lexClosingTagName(pullChar, unreadChar);
      }
    } else if (isHyphen(nextCharCode)) {
      // Test if we're starting a comment tag
      if (
        textContentLength >= 3 &&
        // If the last 3 characters are "<!-" and the next char is "-", we've got a comment tag
        isTagStartBracket(textContentCodes[textContentLength - 3]) &&
        isBang(textContentCodes[textContentLength - 2]) &&
        isHyphen(textContentCodes[textContentLength - 1])
      ) {
        textContentCodes.splice(-3);
        yield {
          type: LexerTokenType.TEXT_CONTENT,
          value: String.fromCodePoint(...textContentCodes),
          l: startLine,
          c: startColumn,
        };
        return lexCommentTag(pullChar, unreadChar);
      }
    }

    textContentCodes.push(nextCharCode);
  }
}

/**
 * Read the tag name at the start of an opening tag's contents.
 * @type {LexerStateIterator<"OPENING_TAGNAME" | "EOF" | "ERROR">}
 */
async function* lexOpeningTagName(pullChar, unreadChar) {
  /**
   * @type {number[]}
   */
  let tagnameCodePointString = [];

  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  while (true) {
    const pullCharResult = await pullChar();

    if (!Array.isArray(pullCharResult)) {
      yield pullCharResult;
      return null;
    }

    const nextCharCode = pullCharResult[0];

    if (!startLine || !startColumn) {
      startLine = pullCharResult[1];
      startColumn = pullCharResult[2];
    }

    if (isLegalTagNameChar(nextCharCode)) {
      tagnameCodePointString.push(nextCharCode);
    } else {
      const unreadErrToken = unreadChar();
      if (unreadErrToken) {
        yield unreadErrToken;
        return null;
      }

      yield {
        type: LexerTokenType.OPENING_TAGNAME,
        value: String.fromCodePoint(...tagnameCodePointString),
        l: startLine,
        c: startColumn,
      };
      return null;
    }
  }
}

/**
 * @type {LexerStateIterator<"ATTRIBUTE_NAME"|"ATTRIBUTE_VALUE"|"EOF"|"ERROR">}
 */
async function* lexOpeningTagContents(pullChar, unreadChar) {
  /**
   * Track the raw content of the opening tag so we can eject and yield it as text content
   * if we hit the end of the file without reaching a closing ">".
   * @type {number[]}
   */
  let rawOpeningTagContentCodePointStr = [];

  /**
   * @type {number|null}
   */
  let rawTextStartLine = null;
  /**
   * @type {number|null}
   */
  let rawTextStartColumn = null;

  /**
   * @type {PullCharFn}
   */
  const pullOpeningTagChar = async () => {
    const pullCharResult = await pullChar();

    if (
      (!rawTextStartLine || !rawTextStartColumn) &&
      Array.isArray(pullCharResult)
    ) {
      rawTextStartLine = pullCharResult[1];
      rawTextStartColumn = pullCharResult[2];
    }

    return pullCharResult;
  };

  /**
   * @type {number|null}
   */
  let prevCharCode = null;

  /**
   * @type {LexerToken[]}
   */
  let openingTagContentTokens = [];

  /**
   * @type {string|null}
   */
  let tagname = null;

  for await (const token of lexOpeningTagName(pullOpeningTagChar, unreadChar)) {
    switch (token.type) {
      case LexerTokenType.OPENING_TAGNAME:
        tagname = token.value;
        break;
      case LexerTokenType.EOF:
        yield {
          type: LexerTokenType.TEXT_CONTENT,
          value: String.fromCodePoint(...rawOpeningTagContentCodePointStr),
          l: rawTextStartLine ?? token.l,
          c: rawTextStartColumn ?? token.c,
        };
        yield token;
        return null;
      case LexerTokenType.ERROR:
        yield token;
        return null;
    }

    openingTagContentTokens.push(token);
  }

  if (!tagname) {
    yield {
      type: LexerTokenType.ERROR,
      value: "Failed to parse opening tagname for opening tag contents",
      l: rawTextStartLine ?? 0,
      c: rawTextStartColumn ?? 0,
    };
    return null;
  }

  const isVoidTag = isVoidElementTagname(tagname);

  // Start a loop to lex attributes until we hit the end of the tag
  while (true) {
    const pullCharResult = await pullOpeningTagChar();

    if (!Array.isArray(pullCharResult)) {
      yield pullCharResult;
      return null;
    }

    const [nextCharCode, nextLine, nextCol] = pullCharResult;

    if (!isWhitespace(nextCharCode)) {
      // We hit the end of the opening tag! Now we need to figure out what to do next.
      if (isTagEndBracket(nextCharCode)) {
        // Yield all the tokens we've collected so far for the opening tag
        yield* openingTagContentTokens;

        // If this is a void tag or the tag was terminated with "/>", consider it a
        // self-closing tag with no content.
        if (isVoidTag || (prevCharCode && isForwardSlash(prevCharCode))) {
          yield {
            type: LexerTokenType.SELF_CLOSING_TAG_END,
            l: nextLine,
            c: nextCol,
          };
          // Transition to lexing text content after the tag
          return lexTextContent(pullChar, unreadChar);
        }

        // If this is a raw text content element,
        // we need to read the raw content inside the element.
        if (isRawTextContentElementTagname(tagname)) {
          return lexRawElementContent(
            pullChar,
            unreadChar,
            asCodePointString(tagname)
          );
        }

        // This is just the end of the opening tag, we don't have any tokens to emit.
        // So just start lexing the text content inside the element
        return lexTextContent(pullChar, unreadChar);
      } else if (isLegalAttributeNameChar(nextCharCode)) {
        // We just hit the start of an attribute name. Unread the first char so the next lexer can use it.
        const unreadErrToken = unreadChar();
        if (unreadErrToken) {
          yield unreadErrToken;
          return null;
        }

        // Lex the attribute name and value
        for await (const token of lexOpeningTagAttribute(
          pullOpeningTagChar,
          unreadChar
        )) {
          if (
            token.type === LexerTokenType.EOF ||
            token.type === LexerTokenType.ERROR
          ) {
            yield token;
            return null;
          }
          openingTagContentTokens.push(token);
        }
      }
    }

    prevCharCode = nextCharCode;
  }
}

/**
 * @param {PullCharFn} pullChar
 * @param {UnreadCharFn} unreadChar
 * @returns {AsyncGenerator<LexerToken<"ATTRIBUTE_NAME" | "ATTRIBUTE_VALUE" | "EOF" | "ERROR">, void>}
 */
async function* lexOpeningTagAttribute(pullChar, unreadChar) {
  const attributeNameToken = await parseOpeningTagAttributeName(
    pullChar,
    unreadChar
  );

  yield attributeNameToken;
  if (
    attributeNameToken.type === LexerTokenType.EOF ||
    attributeNameToken.type === LexerTokenType.ERROR
  ) {
    return;
  }

  const attributeNameTerminatorPullCharResult = await pullChar();

  if (!Array.isArray(attributeNameTerminatorPullCharResult)) {
    return yield attributeNameTerminatorPullCharResult;
  }

  const [attributeNameTerminatorCharCode] =
    attributeNameTerminatorPullCharResult;
  if (isAttributeEqualsChar(attributeNameTerminatorCharCode)) {
    // Looks like this attribute has a value. We need to determine if the value is quoted or not.
    const quoteOrAttrValuePullCharResult = await pullChar();

    if (!Array.isArray(quoteOrAttrValuePullCharResult)) {
      return yield quoteOrAttrValuePullCharResult;
    }

    const [quoteOrAttributeValueCharCode] = quoteOrAttrValuePullCharResult;

    // Unread the next char so the next lexer can use it.
    const unreadErrToken = unreadChar();
    if (unreadErrToken) {
      return yield unreadErrToken;
    }

    if (isAttributeValueQuoteChar(quoteOrAttributeValueCharCode)) {
      yield* lexOpeningTagQuotedAttributeValue(pullChar, unreadChar);
    } else if (
      isLegalUnquotedAttributeValueChar(quoteOrAttributeValueCharCode)
    ) {
      yield* lexOpeningTagUnquotedAttributeValue(pullChar, unreadChar);
    }
  } else {
    // Looks like this is just a boolean attribute with no value,
    // so we'll transition back to lexing the opening tag contents.
    const unreadErrToken = unreadChar();
    if (unreadErrToken) {
      return yield unreadErrToken;
    }
  }
}

/**
 * Read the attribute name until we encounter an illegal attribute name char; usually "=" for an attribute with a value or whitespace for a boolean attribute.
 * @param {PullCharFn} pullChar
 * @param {UnreadCharFn} unreadChar
 * @returns {Promise<LexerToken<"ATTRIBUTE_NAME" | "EOF" | "ERROR">>}
 */
async function parseOpeningTagAttributeName(pullChar, unreadChar) {
  /**
   * @type {number[]}
   */
  let attributeNameCodePointString = [];

  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  while (true) {
    const pullCharResult = await pullChar();

    if (!Array.isArray(pullCharResult)) {
      return pullCharResult;
    }

    const [nextCharCode, nextLine, nextCol] = pullCharResult;

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    if (!isLegalAttributeNameChar(nextCharCode)) {
      const unreadErrToken = unreadChar();
      if (unreadErrToken) {
        return unreadErrToken;
      }

      return {
        type: LexerTokenType.ATTRIBUTE_NAME,
        value: String.fromCodePoint(...attributeNameCodePointString),
        l: startLine,
        c: startColumn,
      };
    }

    attributeNameCodePointString.push(nextCharCode);
  }
}

/**
 * Reads a quoted attribute value until the closing quote is encountered.
 * The opening quote will be the first character read.
 * @param {PullCharFn} pullChar
 * @param {UnreadCharFn} unreadChar
 * @returns {AsyncGenerator<LexerToken<"ATTRIBUTE_VALUE" | "EOF" | "ERROR">, void>}
 */
async function* lexOpeningTagQuotedAttributeValue(pullChar, unreadChar) {
  /**
   * @type {number[]}
   */
  let attributeValueCodePointString = [];
  /**
   * @type {number|null}
   */
  let quoteCharCode = null;

  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  while (true) {
    const pullCharResult = await pullChar();

    if (!Array.isArray(pullCharResult)) {
      return yield pullCharResult;
    }

    const [nextCharCode, nextLine, nextCol] = pullCharResult;

    if (!startLine || !startColumn || !quoteCharCode) {
      quoteCharCode = nextCharCode;
      startLine = nextLine;
      startColumn = nextCol;
      // Continue to the next loop iteration since we don't want to include the quote character in the attribute value.
      continue;
    }

    if (
      nextCharCode === quoteCharCode &&
      !isNextCharEscapedByPrecedingString(attributeValueCodePointString)
    ) {
      const unreadErrToken = unreadChar();
      if (unreadErrToken) {
        return yield unreadErrToken;
      }

      return yield {
        type: LexerTokenType.ATTRIBUTE_VALUE,
        value: String.fromCodePoint(...attributeValueCodePointString),
        l: startLine,
        c: startColumn,
      };
    }

    attributeValueCodePointString.push(nextCharCode);
  }
}

/**
 * Reads an unquoted attribute value until the next whitespace or tag end is encountered.
 * @param {PullCharFn} pullChar
 * @param {UnreadCharFn} unreadChar
 * @returns {AsyncGenerator<LexerToken<"ATTRIBUTE_VALUE" | "EOF" | "ERROR">, void>}
 */
async function* lexOpeningTagUnquotedAttributeValue(pullChar, unreadChar) {
  /**
   * @type {number[]}
   */
  let attributeValueCodePointString = [];

  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  while (true) {
    const pullCharResult = await pullChar();

    if (!Array.isArray(pullCharResult)) {
      return yield pullCharResult;
    }

    const [nextCharCode, nextLine, nextCol] = pullCharResult;

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    if (!isLegalUnquotedAttributeValueChar(nextCharCode)) {
      const unreadErrToken = unreadChar();
      if (unreadErrToken) {
        return yield unreadErrToken;
      }

      return yield {
        type: LexerTokenType.ATTRIBUTE_VALUE,
        value: String.fromCodePoint(...attributeValueCodePointString),
        l: startLine,
        c: startColumn,
      };
    }

    attributeValueCodePointString.push(nextCharCode);
  }
}

/**
 * @type {LexerStateIterator<"EOF"|"ERROR">}
 */
async function* lexClosingTagName(pullChar, unreadChar) {
  /**
   * @type {number[]}
   */
  let tagnameCodePointStr = [];

  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  while (true) {
    const pullCharResult = await pullChar();

    if (!Array.isArray(pullCharResult)) {
      yield pullCharResult;
      return null;
    }

    const [nextCharCode, nextLine, nextCol] = pullCharResult;

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    if (!isLegalTagNameChar(nextCharCode)) {
      const unreadErrToken = unreadChar();
      if (unreadErrToken) {
        yield unreadErrToken;
        return null;
      }

      yield {
        type: LexerTokenType.CLOSING_TAGNAME,
        value: String.fromCodePoint(...tagnameCodePointStr),
        l: startLine,
        c: startColumn,
      };
      return lexClosingTagEnd(pullChar, unreadChar);
    }

    tagnameCodePointStr.push(nextCharCode);
  }
}

/**
 * At this point, we are in a closing tag but after the tag name. We just need to read until
 * the closing ">" is encountered.
 * @type {LexerStateIterator<"EOF"|"ERROR">}
 */
async function* lexClosingTagEnd(pullChar, unreadChar) {
  /**
   * @type {number|undefined}
   */
  let startLine;
  /**
   * @type {number|undefined}
   */
  let startColumn;

  while (true) {
    const pullCharResult = await pullChar();
    if (!Array.isArray(pullCharResult)) {
      yield pullCharResult;
      return null;
    }

    const [nextCharCode, nextLine, nextCol] = pullCharResult;

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    if (isTagEndBracket(nextCharCode)) {
      return lexTextContent(pullChar, unreadChar);
    }
  }
}

/**
 * HTML comment tags in form <!-- ... -->
 * This lexer is starting after the opening "<!--" tag, so it just needs to
 * read until the closing "-->" is encountered.
 * @type {LexerStateIterator<"COMMENT"|"EOF"|"ERROR">}
 */
async function* lexCommentTag(pullChar, unreadChar) {
  /**
   * @type {number|undefined}
   */
  let startLine;
  /**
   * @type {number|undefined}
   */
  let startColumn;

  /**
   * @type {number[]}
   */
  let commentContentCodePointStr = [];

  while (true) {
    const pullCharResult = await pullChar();

    if (!Array.isArray(pullCharResult)) {
      yield pullCharResult;
      return null;
    }

    const [nextCharCode, nextLine, nextCol] = pullCharResult;

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    const commentContentLength = commentContentCodePointStr.length;

    if (
      isEndOfTagChar(nextCharCode) &&
      isHyphen(commentContentCodePointStr[commentContentLength - 1]) &&
      isHyphen(commentContentCodePointStr[commentContentLength - 2])
    ) {
      commentContentCodePointStr.splice(-2);

      yield {
        type: LexerTokenType.COMMENT,
        value: String.fromCodePoint(...commentContentCodePointStr).trim(),
        l: startLine,
        c: startColumn,
      };
      return lexTextContent(pullChar, unreadChar);
    }

    commentContentCodePointStr.push(nextCharCode);
  }
}

const SCRIPT_CODE_POINT_STRING = asCodePointString("script");
const STYLE_CODE_POINT_STRING = asCodePointString("style");

/**
 * Read the raw contents of a script or style tag until the closing tag is encountered.
 *
 * @param {PullCharFn} pullChar
 * @param {UnreadCharFn} unreadChar
 * @param {number[]} elementTagNameCodeString
 * @returns {LexerStateGenerator<"EOF" | "ERROR" | "TEXT_CONTENT" | "CLOSING_TAGNAME">}
 */
async function* lexRawElementContent(
  pullChar,
  unreadChar,
  elementTagNameCodeString
) {
  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  /**
   * @type {number[]}
   */
  const rawContentCharCodes = [];

  const closingTagnameMatchString = [
    // "<"
    LT,
    // "/"
    FWD_SLASH,
    ...elementTagNameCodeString,
  ];

  const isScript = doCodePointStringsMatch(
    elementTagNameCodeString,
    SCRIPT_CODE_POINT_STRING
  );
  const isStyle = doCodePointStringsMatch(
    elementTagNameCodeString,
    STYLE_CODE_POINT_STRING
  );

  /**
   * @type {number | null}
   */
  let unterminatedQuoteCharCode = null;

  while (true) {
    const pullCharResult = await pullChar();

    if (!Array.isArray(pullCharResult)) {
      yield pullCharResult;
      return null;
    }

    const [nextCharCode, nextLine, nextCol] = pullCharResult;

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    if (unterminatedQuoteCharCode !== null) {
      if (nextCharCode === unterminatedQuoteCharCode) {
        if (!isNextCharEscapedByPrecedingString(rawContentCharCodes)) {
          // The quote character is not escaped, so we can now consider the quote as terminated.
          unterminatedQuoteCharCode = null;
        }
      }
    } else if (
      (isScript && isScriptQuoteChar(nextCharCode)) ||
      (isStyle && isStyleQuoteChar(nextCharCode))
    ) {
      unterminatedQuoteCharCode = nextCharCode;
    } else if (
      !isLegalTagNameChar(nextCharCode) &&
      doCodePointStringsMatch(
        rawContentCharCodes,
        closingTagnameMatchString,
        -closingTagnameMatchString.length
      )
    ) {
      const unreadErrToken = unreadChar();
      if (unreadErrToken) {
        yield unreadErrToken;
        return null;
      }

      const closingTagnameMatchStringLength = closingTagnameMatchString.length;
      rawContentCharCodes.splice(-closingTagnameMatchStringLength);
      yield {
        type: LexerTokenType.TEXT_CONTENT,
        value: String.fromCodePoint(...rawContentCharCodes),
        l: startLine,
        c: startColumn,
      };
      yield {
        type: LexerTokenType.CLOSING_TAGNAME,
        value: String.fromCodePoint(...elementTagNameCodeString),
        l: nextLine,
        c: nextCol - closingTagnameMatchStringLength,
      };
      return lexClosingTagEnd(pullChar, unreadChar);
    }

    rawContentCharCodes.push(nextCharCode);
  }
}
