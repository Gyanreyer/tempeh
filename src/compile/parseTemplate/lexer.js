import { createReadStream } from "fs";
import {
  FWD_SLASH,
  LT,
  asCodePointString,
  doCodePointStringsMatch,
  isAttributeEqualsChar,
  isAttributeValueQuoteChar,
  isBackSlash,
  isBang,
  isEndOfTagChar,
  isForwardSlash,
  isHyphen,
  isLegalAttributeNameChar,
  isLegalLeadingTagNameChar,
  isLegalTagNameChar,
  isLegalUnquotedAttributeValueChar,
  isLineBreak,
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
 * @typedef {() => Promise<{
 *  ch: number;
 *  l: number;
 *  c: number;
 *  terminatorToken: LexerToken<"EOF" | "ERROR"> | null;
 * }>} PullCharFn

 * @typedef {() => undefined | LexerToken<"ERROR">} UnreadCharFn
 */

const EOF = Symbol("EOF");

/**
 * @param {string} filePath
 * @returns {AsyncGenerator<LexerToken, void>}
 */
export async function* lex(filePath) {
  const readStream = createReadStream(filePath);

  /**
   * @type {number | undefined}
   */
  let lastReadCharCode = undefined;
  let hasUnreadLastChar = false;

  let line = 1;
  let lastReadCharLine = 1;

  let column = 0;
  let lastReadCharColumn = 0;

  // Waits for the stream to emit a readable event,
  // indicating that there is more data available to read via a read() call.
  const waitForReadable = () =>
    /** @type {Promise<Error | EOF | null>} */ (
      new Promise((resolve) => {
        function onEnd() {
          readStream.off("readable", onReadable);
          readStream.off("error", onError);
          readStream.off("end", onEnd);
          resolve(EOF);
        }
        function onReadable() {
          readStream.off("readable", onReadable);
          readStream.off("error", onError);
          readStream.off("end", onEnd);
          resolve(null);
        }
        /**
         * @param {Error} err
         */
        function onError(err) {
          readStream.off("readable", onReadable);
          readStream.off("error", onError);
          readStream.off("end", onEnd);
          resolve(err);
        }

        readStream.on("readable", onReadable);
        readStream.on("error", onError);
        readStream.on("end", onEnd);
      })
    );

  /**
   * @type {PullCharFn}
   */
  const pullChar = async () => {
    /** @type {number} */
    let pulledCodePoint;
    if (hasUnreadLastChar) {
      hasUnreadLastChar = false;
      if (lastReadCharCode === undefined) {
        return {
          ch: -1,
          l: line,
          c: column,
          terminatorToken: {
            type: LexerTokenType.ERROR,
            value: "Cannot unread a character that has not been read",
            l: line,
            c: column,
          },
        };
      }
      pulledCodePoint = lastReadCharCode;
    } else {
      if (!readStream.readable || readStream.readableLength === 0) {
        const waitForReadableResult = await waitForReadable();
        if (waitForReadableResult === EOF) {
          return {
            ch: -1,
            l: line,
            c: column,
            terminatorToken: {
              type: LexerTokenType.EOF,
              l: line,
              c: column,
            },
          };
        } else if (waitForReadableResult instanceof Error) {
          return {
            ch: -1,
            l: line,
            c: column,
            terminatorToken: {
              type: LexerTokenType.ERROR,
              value: waitForReadableResult.message,
              l: line,
              c: column,
            },
          };
        }
      }

      /** @type {Buffer} */
      const leadingCharByteBuf = readStream.read(1);

      if (!leadingCharByteBuf) {
        return {
          ch: -1,
          l: line,
          c: column,
          terminatorToken: {
            type: LexerTokenType.EOF,
            l: line,
            c: column,
          },
        };
      }

      const leadingCharByte = new Uint8Array(leadingCharByteBuf)[0];

      // Bytes >= 0x80 are the start of a multi-byte sequence
      if (leadingCharByte < 0x80) {
        pulledCodePoint = leadingCharByte;
      } else if (leadingCharByte >= 0xc0 && leadingCharByte <= 0xdf) {
        // 2-byte sequence
        const nextByteBuf = readStream.read(1);
        if (!nextByteBuf) {
          return {
            ch: -1,
            l: line,
            c: column,
            terminatorToken: {
              type: LexerTokenType.EOF,
              l: line,
              c: column,
            },
          };
        }
        let nextByte = new Uint8Array(nextByteBuf)[0];
        pulledCodePoint = ((leadingCharByte & 0x1f) << 6) | (nextByte & 0x3f);
      } else if (leadingCharByte >= 0xe0 && leadingCharByte <= 0xef) {
        // 3-byte sequence
        const nextBytesBuf = readStream.read(2);
        if (!nextBytesBuf) {
          return {
            ch: -1,
            l: line,
            c: column,
            terminatorToken: {
              type: LexerTokenType.EOF,
              l: line,
              c: column,
            },
          };
        }
        const nextBytes = new Uint8Array(nextBytesBuf);
        pulledCodePoint =
          ((leadingCharByte & 0x0f) << 12) |
          ((nextBytes[0] & 0x3f) << 6) |
          (nextBytes[1] & 0x3f);
      } else if (leadingCharByte >= 0xf0 && leadingCharByte <= 0xf7) {
        // 4-byte sequence
        const nextBytesBuf = readStream.read(3);
        if (!nextBytesBuf) {
          return {
            ch: -1,
            l: line,
            c: column,
            terminatorToken: {
              type: LexerTokenType.EOF,
              l: line,
              c: column,
            },
          };
        }
        const nextBytes = new Uint8Array(nextBytesBuf);
        pulledCodePoint =
          ((leadingCharByte & 0x07) << 18) |
          ((nextBytes[0] & 0x3f) << 12) |
          ((nextBytes[1] & 0x3f) << 6) |
          (nextBytes[2] & 0x3f);
      } else {
        console.log(
          "Invalid UTF-8 leading byte: ",
          leadingCharByte,
          `${filePath}:${line}:${column}`
        );
        return {
          ch: -1,
          l: line,
          c: column,
          terminatorToken: {
            type: LexerTokenType.ERROR,
            value: `Invalid UTF-8 leading byte: ${leadingCharByte}`,
            l: line,
            c: column,
          },
        };
      }
    }

    lastReadCharLine = line;
    lastReadCharColumn = column;

    lastReadCharCode = pulledCodePoint;

    if (isLineBreak(pulledCodePoint)) {
      ++line;
      column = 0;
      return {
        ch: pulledCodePoint,
        l: line,
        c: column + 1,
        terminatorToken: null,
      };
    }

    return {
      ch: pulledCodePoint,
      l: lastReadCharLine,
      c: ++column,
      terminatorToken: null,
    };
  };

  /**
   * @type {UnreadCharFn}
   */
  const unreadChar = () => {
    if (lastReadCharCode) {
      line = lastReadCharLine;
      column = lastReadCharColumn;
      hasUnreadLastChar = true;
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
    let {
      ch: nextCharCode,
      l: nextLine,
      c: nextCol,
      terminatorToken,
    } = await pullChar();

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    if (terminatorToken) {
      if (terminatorToken.type === LexerTokenType.EOF) {
        // If we have any text content buffered, yield it as a final token before EOF
        yield {
          type: LexerTokenType.TEXT_CONTENT,
          value: String.fromCodePoint(...textContentCodes),
          l: startLine,
          c: startColumn,
        };
      }
      yield terminatorToken;
      return null;
    }

    const textContentLength = textContentCodes.length;

    if (isLegalLeadingTagNameChar(nextCharCode)) {
      if (
        textContentLength > 0 &&
        isTagStartBracket(textContentCodes[textContentLength - 1])
      ) {
        // Splice off the "<" character we buffered before the tag name
        --textContentCodes.length;

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
        textContentCodes.length -= 2;

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
        textContentCodes.length -= 3;
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
    const {
      ch: nextCharCode,
      l: nextLine,
      c: nextCol,
      terminatorToken,
    } = await pullChar();

    if (terminatorToken) {
      yield terminatorToken;
      return null;
    }

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
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
async function* lexOpeningTagContents(basePullChar, baseUnreadChar) {
  /**
   * Track the raw content of the opening tag so we can eject and yield it as text content
   * if we hit the end of the file without reaching a closing ">".
   * @type {number[]}
   */
  let rawOpeningTagContentCodePointStr = [
    // We can assume the first character is "<" since that is the only way we could have gotten here.
    LT,
  ];

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
    const pullCharResult = await basePullChar();

    if (!rawTextStartLine || !rawTextStartColumn) {
      rawTextStartLine = pullCharResult.l;
      rawTextStartColumn = pullCharResult.c;
    }

    if (!pullCharResult.terminatorToken) {
      rawOpeningTagContentCodePointStr.push(pullCharResult.ch);
    }

    return pullCharResult;
  };

  /**
   * @type {UnreadCharFn}
   */
  const unreadOpeningTagChar = () => {
    const unreadCharErrToken = baseUnreadChar();
    if (!unreadCharErrToken) {
      // If there wasn't an error, cut off the last character from the raw content string
      --rawOpeningTagContentCodePointStr.length;
    }
    return unreadCharErrToken;
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

  for await (const token of lexOpeningTagName(
    pullOpeningTagChar,
    unreadOpeningTagChar
  )) {
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
    const {
      ch: nextCharCode,
      l: nextLine,
      c: nextCol,
      terminatorToken,
    } = await pullOpeningTagChar();

    if (terminatorToken) {
      yield terminatorToken;
      return null;
    }

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
          return lexTextContent(basePullChar, baseUnreadChar);
        }

        // If this is a raw text content element,
        // we need to read the raw content inside the element.
        if (isRawTextContentElementTagname(tagname)) {
          return lexRawElementContent(
            basePullChar,
            baseUnreadChar,
            asCodePointString(tagname)
          );
        }

        // This is just the end of the opening tag, we don't have any tokens to emit.
        // So just start lexing the text content inside the element
        return lexTextContent(basePullChar, baseUnreadChar);
      } else if (isLegalAttributeNameChar(nextCharCode)) {
        // We just hit the start of an attribute name. Unread the first char so the next lexer can use it.
        const unreadErrToken = unreadOpeningTagChar();
        if (unreadErrToken) {
          yield unreadErrToken;
          return null;
        }

        // Lex the attribute name and value
        for await (const token of lexOpeningTagAttribute(
          pullOpeningTagChar,
          unreadOpeningTagChar
        )) {
          if (token.type === LexerTokenType.EOF) {
            yield {
              type: LexerTokenType.TEXT_CONTENT,
              value: String.fromCodePoint(...rawOpeningTagContentCodePointStr),
              l: rawTextStartLine ?? token.l,
              c: rawTextStartColumn ?? token.c,
            };
            yield token;
            return null;
          }
          if (token.type === LexerTokenType.ERROR) {
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
 * @returns {AsyncGenerator<LexerToken<"ATTRIBUTE_NAME" | "ATTRIBUTE_VALUE" | "EOF" | "ERROR">, null>}
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
    return null;
  }

  const { ch: attributeNameTerminatorCharCode, terminatorToken } =
    await pullChar();

  if (terminatorToken) {
    yield terminatorToken;
    return null;
  }

  if (isAttributeEqualsChar(attributeNameTerminatorCharCode)) {
    // Looks like this attribute has a value. We need to determine if the value is quoted or not.
    const {
      ch: quoteOrAttributeValueCharCode,
      terminatorToken: quoteOrAttrValueTerminatorToken,
    } = await pullChar();

    if (quoteOrAttrValueTerminatorToken) {
      yield quoteOrAttrValueTerminatorToken;
      return null;
    }

    // Unread the next char so the next lexer can use it.
    const unreadErrToken = unreadChar();
    if (unreadErrToken) {
      yield unreadErrToken;
      return null;
    }

    if (isAttributeValueQuoteChar(quoteOrAttributeValueCharCode)) {
      yield* lexOpeningTagQuotedAttributeValue(pullChar, unreadChar);
      return null;
    } else if (
      isLegalUnquotedAttributeValueChar(quoteOrAttributeValueCharCode)
    ) {
      yield* lexOpeningTagUnquotedAttributeValue(pullChar, unreadChar);
      return null;
    }
  } else {
    // Looks like this is just a boolean attribute with no value,
    // so we'll transition back to lexing the opening tag contents.
    const unreadErrToken = unreadChar();
    if (unreadErrToken) {
      yield unreadErrToken;
      return null;
    }
  }

  return null;
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
    const {
      ch: nextCharCode,
      l: nextLine,
      c: nextCol,
      terminatorToken,
    } = await pullChar();

    if (terminatorToken) {
      return terminatorToken;
    }

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
 * @returns {AsyncGenerator<LexerToken<"ATTRIBUTE_VALUE" | "EOF" | "ERROR">, null>}
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

  let isNextCharEscaped = false;

  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  while (true) {
    const {
      ch: nextCharCode,
      l: nextLine,
      c: nextCol,
      terminatorToken,
    } = await pullChar();

    if (terminatorToken) {
      yield terminatorToken;
      return null;
    }

    if (!startLine || !startColumn || !quoteCharCode) {
      quoteCharCode = nextCharCode;
      startLine = nextLine;
      startColumn = nextCol;
      // Continue to the next loop iteration since we don't want to include the quote character in the attribute value.
      continue;
    }

    if (isBackSlash(nextCharCode) && !isNextCharEscaped) {
      // If we encountered an unescaped backslash, that means the next
      // character is escaped; don't include this escaping backslash in the attribute value.
      isNextCharEscaped = true;
    } else if (nextCharCode === quoteCharCode && !isNextCharEscaped) {
      // If the next char is a matching closing quote and isn't escaped,
      // we've reached the end of the attribute value.
      const unreadErrToken = unreadChar();
      if (unreadErrToken) {
        yield unreadErrToken;
        return null;
      }

      yield {
        type: LexerTokenType.ATTRIBUTE_VALUE,
        value: String.fromCodePoint(...attributeValueCodePointString),
        l: startLine,
        c: startColumn,
      };
      return null;
    } else {
      attributeValueCodePointString.push(nextCharCode);
      isNextCharEscaped = false;
    }
  }
}

/**
 * Reads an unquoted attribute value until the next whitespace or tag end is encountered.
 * @param {PullCharFn} pullChar
 * @param {UnreadCharFn} unreadChar
 * @returns {AsyncGenerator<LexerToken<"ATTRIBUTE_VALUE" | "EOF" | "ERROR">, null>}
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
    const {
      ch: nextCharCode,
      l: nextLine,
      c: nextCol,
      terminatorToken,
    } = await pullChar();

    if (terminatorToken) {
      yield terminatorToken;
      return null;
    }

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
    const {
      ch: nextCharCode,
      l: nextLine,
      c: nextCol,
      terminatorToken,
    } = await pullChar();

    if (terminatorToken) {
      yield terminatorToken;
      return null;
    }

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
    const {
      ch: nextCharCode,
      l: nextLine,
      c: nextCol,
      terminatorToken,
    } = await pullChar();
    if (terminatorToken) {
      yield terminatorToken;
      return null;
    }

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
    const {
      ch: nextCharCode,
      l: nextLine,
      c: nextCol,
      terminatorToken,
    } = await pullChar();

    if (terminatorToken) {
      yield terminatorToken;
      return null;
    }

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
      commentContentCodePointStr.length -= 2;

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

  let isNextQuoteCharEscaped = false;

  while (true) {
    const {
      ch: nextCharCode,
      l: nextLine,
      c: nextCol,
      terminatorToken,
    } = await pullChar();

    if (terminatorToken) {
      yield terminatorToken;
      return null;
    }

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    if (unterminatedQuoteCharCode !== null) {
      if (isBackSlash(nextCharCode) && !isNextQuoteCharEscaped) {
        isNextQuoteCharEscaped = true;
      } else if (
        nextCharCode === unterminatedQuoteCharCode &&
        !isNextQuoteCharEscaped
      ) {
        // The quote character is not escaped, so we can now consider the quote as terminated.
        unterminatedQuoteCharCode = null;
        isNextQuoteCharEscaped = false;
      } else {
        isNextQuoteCharEscaped = false;
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
      rawContentCharCodes.length -= closingTagnameMatchStringLength;
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
