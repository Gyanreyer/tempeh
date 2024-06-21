import { createReadStream } from "fs";
import {
  asCharCode,
  isAttributeValueQuoteChar,
  isLegalAttributeNameChar,
  isLegalLeadingTagNameChar,
  isLegalTagNameChar,
  isLegalUnquotedAttributeValueChar,
  isNextCharEscapedByPrecedingString,
  isRawTextContentElementTagname,
  isScriptQuoteChar,
  isStyleQuoteChar,
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
  CLOSING_TAG_END: 5,
  ATTRIBUTE_NAME: 6,
  ATTRIBUTE_VALUE: 7,
  COMMENT: 8,
});

/**
 * @typedef LexerTokenWithValue
 * @property {typeof LexerTokenType.ERROR
 *  | typeof LexerTokenType.TEXT_CONTENT
 *  | typeof LexerTokenType.OPENING_TAGNAME
 *  | typeof LexerTokenType.CLOSING_TAGNAME
 *  | typeof LexerTokenType.ATTRIBUTE_NAME
 *  | typeof LexerTokenType.ATTRIBUTE_VALUE
 *  | typeof LexerTokenType.COMMENT
 * } type
 * @property {string} value
 * @property {number} l - Line number
 * @property {number} c - Column number
 */

/**
 * @typedef LexerTokenWithNoValue
 * @property {typeof LexerTokenType.EOF
 *  | typeof LexerTokenType.CLOSING_TAG_END
 * } type
 * @property {never} [value]
 * @property {number} l - Line number
 * @property {number} c - Column number
 */

/**
 * @typedef {LexerTokenWithValue | LexerTokenWithNoValue} LexerToken
 */

/**
 * @typedef LexerContext
 * @property {string|null} lastOpenedTagname
 */

const EOF = Symbol("EOF");

/**
 * @typedef {() => Promise<[string | typeof EOF | Error, number, number]>} PullCharFn

 * @typedef {() => undefined | Error} UnreadCharFn
 */

/**
 * @param {string} filePath
 */
export async function* lex(filePath) {
  const readStream = createReadStream(filePath, { encoding: "utf-8" });

  /** @type {AsyncIterator<string, string>} */
  const streamIterator = readStream[Symbol.asyncIterator]();

  /**
   * @type {string | undefined}
   */
  let lastReadChar = undefined;

  let line = 1;
  let lastReadCharLine = 1;

  let column = 0;
  let lastReadCharColumn = 0;

  /**
   * @type {string[]}
   */
  let bufferedChars = [];

  /**
   * @type {LexerContext}
   */
  const ctx = {
    lastOpenedTagname: null,
  };

  /**
   * @type {PullCharFn}
   */
  const pullChar = async () => {
    while (bufferedChars.length === 0) {
      const { value, done } = await streamIterator.next();
      if (done) {
        return [EOF, line, column];
      }
      bufferedChars.push(...value);
    }

    lastReadCharLine = line;
    lastReadCharColumn = column;

    lastReadChar = bufferedChars.splice(0, 1)[0];
    if (!lastReadChar) {
      return [
        new Error("Unexpectedly failed to read a character from buffer"),
        line,
        column,
      ];
    }

    if (lastReadChar === "\n") {
      ++line;
      column = 0;
    } else {
      ++column;
    }

    return [lastReadChar, line, column];
  };

  /**
   * @type {UnreadCharFn}
   */
  const unreadChar = () => {
    if (lastReadChar) {
      line = lastReadCharLine;
      column = lastReadCharColumn;
      bufferedChars.unshift(lastReadChar);
      lastReadChar = undefined;
    } else {
      return new Error("Cannot unread a character that has not been read");
    }

    return undefined;
  };

  /**
   * @type {LexerStateFunction | null}
   */
  let nextStateFunction = lexTextContent;
  while (nextStateFunction) {
    /**
     * @type {LexerToken[]}
     */
    let parsedTokens;
    [nextStateFunction, ...parsedTokens] = await nextStateFunction(
      pullChar,
      unreadChar,
      ctx
    );
    for (const token of parsedTokens) {
      if (token.type === LexerTokenType.OPENING_TAGNAME) {
        ctx.lastOpenedTagname = token.value;
      }
      yield token;
    }
  }
}

/**
 * @typedef {(
 *  pullChar: PullCharFn,
 *  unreadChar: UnreadCharFn,
 *  ctx: Readonly<LexerContext>,
 * ) => Promise<[LexerStateFunction | null, ...LexerToken[]]>} LexerStateFunction
 */

/**
 * @type {LexerStateFunction}
 */
async function lexTextContent(pullChar, unreadChar) {
  /**
   * @type {number|undefined}
   */
  let startLine;
  /**
   * @type {number|undefined}
   */
  let startColumn;

  let textContent = "";

  while (true) {
    let [nextChar, nextLine, nextCol] = await pullChar();

    if (nextChar === EOF) {
      return [
        null,
        {
          type: LexerTokenType.EOF,
          l: nextLine,
          c: nextCol,
        },
      ];
    } else if (nextChar instanceof Error) {
      return [
        null,
        {
          type: LexerTokenType.ERROR,
          value: nextChar.message,
          l: nextLine,
          c: nextCol,
        },
      ];
    }

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    const nextCharCode = asCharCode(nextChar);

    const textContentLength = textContent.length;

    if (isLegalLeadingTagNameChar(nextCharCode)) {
      if (textContentLength > 0 && textContent[textContentLength - 1] === "<") {
        textContent = textContent.slice(0, textContentLength - 1);

        const unreadErr = unreadChar();
        if (unreadErr) {
          return [
            null,
            {
              type: LexerTokenType.ERROR,
              value: unreadErr.message,
              l: nextLine,
              c: nextCol,
            },
          ];
        }

        return [
          lexOpeningTagName,
          {
            type: LexerTokenType.TEXT_CONTENT,
            value: textContent,
            l: startLine,
            c: startColumn,
          },
        ];
      } else if (textContentLength >= 2 && textContent.slice(-2) === "</") {
        textContent = textContent.slice(0, textContentLength - 2);

        const unreadErr = unreadChar();
        if (unreadErr) {
          return [
            null,
            {
              type: LexerTokenType.ERROR,
              value: unreadErr.message,
              l: nextLine,
              c: nextCol,
            },
          ];
        }

        return [
          lexClosingTagName,
          {
            type: LexerTokenType.TEXT_CONTENT,
            value: textContent,
            l: startLine,
            c: startColumn,
          },
        ];
      }
    } else if (nextChar === "-") {
      if (textContentLength >= 3 && textContent.slice(-3) === "<!-") {
        // Comment start
        textContent = textContent.slice(0, textContentLength - 3);
        return [
          lexCommentTag,
          {
            type: LexerTokenType.TEXT_CONTENT,
            value: textContent,
            l: startLine,
            c: startColumn,
          },
        ];
      }
    }

    textContent += nextChar;
  }
}

/**
 * @type {LexerStateFunction}
 */
async function lexOpeningTagName(pullChar, unreadChar) {
  let tagname = "";

  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  while (true) {
    const [nextChar, nextLine, nextCol] = await pullChar();

    if (nextChar === EOF) {
      return [
        null,
        {
          type: LexerTokenType.EOF,
          l: nextLine,
          c: nextCol,
        },
      ];
    } else if (nextChar instanceof Error) {
      return [
        null,
        {
          type: LexerTokenType.ERROR,
          value: nextChar.message,
          l: nextLine,
          c: nextCol,
        },
      ];
    }

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    const nextCharCode = asCharCode(nextChar);

    if (isLegalTagNameChar(nextCharCode)) {
      tagname += nextChar;
    } else {
      const unreadErr = unreadChar();
      if (unreadErr) {
        return [
          null,
          {
            type: LexerTokenType.ERROR,
            value: unreadErr.message,
            l: nextLine,
            c: nextCol,
          },
        ];
      }

      return [
        lexOpeningTagContents,
        {
          type: LexerTokenType.OPENING_TAGNAME,
          value: tagname,
          l: startLine,
          c: startColumn,
        },
      ];
    }
  }
}

/**
 * @type {LexerStateFunction}
 */
async function lexOpeningTagContents(pullChar, unreadChar, ctx) {
  /**
   * @type {string|null}
   */
  let prevChar = null;

  const tagname = ctx.lastOpenedTagname;
  if (!tagname) {
    return [
      null,
      {
        type: LexerTokenType.ERROR,
        value: "Failed to find opening tagname for opening tag contents",
        l: 0,
        c: 0,
      },
    ];
  }

  const isVoidTag = isVoidElementTagname(tagname);

  while (true) {
    const [nextChar, nextLine, nextCol] = await pullChar();

    if (nextChar === EOF) {
      return [
        null,
        {
          type: LexerTokenType.EOF,
          l: nextLine,
          c: nextCol,
        },
      ];
    } else if (nextChar instanceof Error) {
      return [
        null,
        {
          type: LexerTokenType.ERROR,
          value: nextChar.message,
          l: nextLine,
          c: nextCol,
        },
      ];
    }

    const nextCharCode = asCharCode(nextChar);

    if (!isWhitespace(nextCharCode)) {
      // We hit the end of the opening tag! Now we need to figure out what to do next.
      if (nextChar === ">") {
        // If this is a void tag or the tag was terminated with "/>", consider it a
        // self-closing tag with no content.
        if (isVoidTag || prevChar === "/") {
          return [
            // Return to lexing text content after the tag
            lexTextContent,
            {
              type: LexerTokenType.CLOSING_TAG_END,
              l: nextLine,
              c: nextCol,
            },
          ];
        }

        // If this is a raw text content element,
        // we need to read the raw content inside the element.
        if (isRawTextContentElementTagname(tagname)) {
          return [
            lexRawElementContent,
            {
              type: LexerTokenType.CLOSING_TAG_END,
              l: nextLine,
              c: nextCol,
            },
          ];
        }

        return [
          // This is just the end of the opening tag, we don't have any tokens to emit.
          // So just start lexing the text content inside the element
          lexTextContent,
        ];
      } else if (isLegalAttributeNameChar(nextCharCode)) {
        // We just hit the start of an attribute name. Unread the first char so the next lexer can use it.
        const unreadErr = unreadChar();
        if (unreadErr) {
          return [
            null,
            {
              type: LexerTokenType.ERROR,
              value: unreadErr.message,
              l: nextLine,
              c: nextCol,
            },
          ];
        }

        return [
          // We don't have any tokens to emit, just transition to parsing the attribute.
          lexOpeningTagAttributeName,
        ];
      }
    }

    prevChar = nextChar;
  }
}

/**
 * Read the attribute name until we encounter an illegal attribute name char; usually "=" for an attribute with a value or whitespace for a boolean attribute.
 * @type {LexerStateFunction}
 */
async function lexOpeningTagAttributeName(pullChar, unreadChar) {
  let attributeName = "";

  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  while (true) {
    const [nextChar, nextLine, nextCol] = await pullChar();

    if (nextChar === EOF) {
      return [
        null,
        {
          type: LexerTokenType.EOF,
          l: nextLine,
          c: nextCol,
        },
      ];
    } else if (nextChar instanceof Error) {
      return [
        null,
        {
          type: LexerTokenType.ERROR,
          value: nextChar.message,
          l: nextLine,
          c: nextCol,
        },
      ];
    }

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    const nextCharCode = asCharCode(nextChar);

    if (!isLegalAttributeNameChar(nextCharCode)) {
      if (nextChar === "=") {
        // Looks like this attribute has a value. We need to determine if the value is quoted or not.
        const [quoteOrAttributeValueChar] = await pullChar();

        if (quoteOrAttributeValueChar === EOF) {
          return [
            null,
            {
              type: LexerTokenType.EOF,
              l: nextLine,
              c: nextCol,
            },
          ];
        } else if (quoteOrAttributeValueChar instanceof Error) {
          return [
            null,
            {
              type: LexerTokenType.ERROR,
              value: quoteOrAttributeValueChar.message,
              l: nextLine,
              c: nextCol,
            },
          ];
        }

        // Unread the next char so the next lexer can use it.
        const unreadErr = unreadChar();
        if (unreadErr) {
          return [
            null,
            {
              type: LexerTokenType.ERROR,
              value: unreadErr.message,
              l: nextLine,
              c: nextCol,
            },
          ];
        }

        const attributeNameToken = {
          type: LexerTokenType.ATTRIBUTE_NAME,
          value: attributeName,
          l: startLine,
          c: startColumn,
        };

        const quoteOrAttributeValueCharCode = asCharCode(
          quoteOrAttributeValueChar
        );

        if (isAttributeValueQuoteChar(quoteOrAttributeValueCharCode)) {
          return [lexOpeningTagQuotedAttributeValue, attributeNameToken];
        } else if (
          isLegalUnquotedAttributeValueChar(quoteOrAttributeValueCharCode)
        ) {
          return [lexOpeningTagUnquotedAttributeValue, attributeNameToken];
        } else {
          return [lexOpeningTagContents, attributeNameToken];
        }
      } else {
        // Looks like this is just a boolean attribute with no value,
        // so we'll transition back to lexing the opening tag contents.
        const unreadErr = unreadChar();
        if (unreadErr) {
          return [
            null,
            {
              type: LexerTokenType.ERROR,
              value: unreadErr.message,
              l: nextLine,
              c: nextCol,
            },
          ];
        }

        return [
          lexOpeningTagContents,
          {
            type: LexerTokenType.ATTRIBUTE_NAME,
            value: attributeName,
            l: startLine,
            c: startColumn,
          },
        ];
      }
    }

    attributeName += nextChar;
  }
}

/**
 * Reads a quoted attribute value until the closing quote is encountered.
 * The opening quote will be the first character read.
 * @type {LexerStateFunction}
 */
async function lexOpeningTagQuotedAttributeValue(pullChar, unreadChar) {
  let attributeValue = "";
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
    const [nextChar, nextLine, nextCol] = await pullChar();

    if (nextChar === EOF) {
      return [
        null,
        {
          type: LexerTokenType.EOF,
          l: nextLine,
          c: nextCol,
        },
      ];
    } else if (nextChar instanceof Error) {
      return [
        null,
        {
          type: LexerTokenType.ERROR,
          value: nextChar.message,
          l: nextLine,
          c: nextCol,
        },
      ];
    }

    const nextCharCode = asCharCode(nextChar);

    if (!startLine || !startColumn || !quoteCharCode) {
      quoteCharCode = nextCharCode;
      startLine = nextLine;
      startColumn = nextCol;
    }

    if (
      nextCharCode === quoteCharCode &&
      !isNextCharEscapedByPrecedingString(attributeValue)
    ) {
      const unreadErr = unreadChar();
      if (unreadErr) {
        return [
          null,
          {
            type: LexerTokenType.ERROR,
            value: unreadErr.message,
            l: nextLine,
            c: nextCol,
          },
        ];
      }

      return [
        lexOpeningTagContents,
        {
          type: LexerTokenType.ATTRIBUTE_VALUE,
          value: attributeValue,
          l: startLine,
          c: startColumn,
        },
      ];
    }

    attributeValue += nextChar;
  }
}

/**
 * @type {LexerStateFunction}
 */
async function lexOpeningTagUnquotedAttributeValue(pullChar, unreadChar) {
  let attributeValue = "";

  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  while (true) {
    const [nextChar, nextLine, nextCol] = await pullChar();

    if (nextChar === EOF) {
      return [
        null,
        {
          type: LexerTokenType.EOF,
          l: nextLine,
          c: nextCol,
        },
      ];
    } else if (nextChar instanceof Error) {
      return [
        null,
        {
          type: LexerTokenType.ERROR,
          value: nextChar.message,
          l: nextLine,
          c: nextCol,
        },
      ];
    }

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    const nextCharCode = asCharCode(nextChar);

    if (!isLegalUnquotedAttributeValueChar(nextCharCode)) {
      const unreadErr = unreadChar();
      if (unreadErr) {
        return [
          null,
          {
            type: LexerTokenType.ERROR,
            value: unreadErr.message,
            l: nextLine,
            c: nextCol,
          },
        ];
      }

      return [
        lexOpeningTagContents,
        {
          type: LexerTokenType.ATTRIBUTE_VALUE,
          value: attributeValue,
          l: startLine,
          c: startColumn,
        },
      ];
    }

    attributeValue += nextChar;
  }
}

/**
 * @type {LexerStateFunction}
 */
async function lexClosingTagName(pullChar, unreadChar) {
  let tagname = "";

  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  while (true) {
    const [nextChar, nextLine, nextCol] = await pullChar();

    if (nextChar === EOF) {
      return [
        null,
        {
          type: LexerTokenType.EOF,
          l: nextLine,
          c: nextCol,
        },
      ];
    } else if (nextChar instanceof Error) {
      return [
        null,
        {
          type: LexerTokenType.ERROR,
          value: nextChar.message,
          l: nextLine,
          c: nextCol,
        },
      ];
    }

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    const nextCharCode = asCharCode(nextChar);

    if (!isLegalTagNameChar(nextCharCode)) {
      const unreadErr = unreadChar();
      if (unreadErr) {
        return [
          null,
          {
            type: LexerTokenType.ERROR,
            value: unreadErr.message,
            l: nextLine,
            c: nextCol,
          },
        ];
      }

      return [
        lexClosingTagEnd,
        {
          type: LexerTokenType.CLOSING_TAGNAME,
          value: tagname,
          l: startLine,
          c: startColumn,
        },
      ];
    }

    tagname += nextChar;
  }
}

/**
 * At this point, we are in a closing tag but after the tag name. We just need to read until
 * the closing ">" is encountered.
 * @type {LexerStateFunction}
 */
async function lexClosingTagEnd(pullChar) {
  /**
   * @type {number|undefined}
   */
  let startLine;
  /**
   * @type {number|undefined}
   */
  let startColumn;

  while (true) {
    const [nextChar, nextLine, nextCol] = await pullChar();
    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    if (nextChar === EOF) {
      return [
        null,
        {
          type: LexerTokenType.EOF,
          l: nextLine,
          c: nextCol,
        },
      ];
    } else if (nextChar instanceof Error) {
      return [
        null,
        {
          type: LexerTokenType.ERROR,
          value: nextChar.message,
          l: nextLine,
          c: nextCol,
        },
      ];
    }

    if (nextChar === ">") {
      return [lexTextContent];
    }
  }
}

/**
 * HTML comment tags in form <!-- ... -->
 * This lexer is starting after the opening "<!--" tag, so it just needs to
 * read until the closing "-->" is encountered.
 * @type {LexerStateFunction}
 */
async function lexCommentTag(pullChar) {
  /**
   * @type {number|undefined}
   */
  let startLine;
  /**
   * @type {number|undefined}
   */
  let startColumn;

  let commentContent = "";

  while (true) {
    let [nextChar, nextLine, nextCol] = await pullChar();

    if (nextChar === EOF) {
      return [
        null,
        {
          type: LexerTokenType.EOF,
          l: nextLine,
          c: nextCol,
        },
      ];
    } else if (nextChar instanceof Error) {
      return [
        null,
        {
          type: LexerTokenType.ERROR,
          value: nextChar.message,
          l: nextLine,
          c: nextCol,
        },
      ];
    }

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    if (nextChar === ">" && commentContent.slice(-2) === "--") {
      return [
        lexTextContent,
        {
          type: LexerTokenType.COMMENT,
          value: commentContent.slice(0, -2).trim(),
          l: startLine,
          c: startColumn,
        },
      ];
    }

    commentContent += nextChar;
  }
}

/**
 * Read the raw contents of a script or style tag until the closing tag is encountered.
 * @type {LexerStateFunction}
 */
async function lexRawElementContent(pullChar, unreadChar, ctx) {
  /**
   * @type {number|null}
   */
  let startLine = null;
  /**
   * @type {number|null}
   */
  let startColumn = null;

  let rawContent = "";

  // The tagname which we should keep read raw content until we hit
  const targetClosingTagname = ctx.lastOpenedTagname;

  if (!targetClosingTagname) {
    return [
      null,
      {
        type: LexerTokenType.ERROR,
        value: "Failed to find opening tagname for raw content",
        l: 0,
        c: 0,
      },
    ];
  }

  const closingTagnameMatchString = `</${targetClosingTagname}`;

  const isScript = targetClosingTagname === "script";
  const isStyle = targetClosingTagname === "style";

  /**
   * @type {string | null}
   */
  let unterminatedQuoteChar = null;

  while (true) {
    let [nextChar, nextLine, nextCol] = await pullChar();

    if (nextChar === EOF) {
      return [
        null,
        {
          type: LexerTokenType.EOF,
          l: nextLine,
          c: nextCol,
        },
      ];
    } else if (nextChar instanceof Error) {
      return [
        null,
        {
          type: LexerTokenType.ERROR,
          value: nextChar.message,
          l: nextLine,
          c: nextCol,
        },
      ];
    }

    if (!startLine || !startColumn) {
      startLine = nextLine;
      startColumn = nextCol;
    }

    const nextCharCode = asCharCode(nextChar);

    if (unterminatedQuoteChar !== null) {
      if (nextChar === unterminatedQuoteChar) {
        if (!isNextCharEscapedByPrecedingString(rawContent)) {
          // The quote character is not escaped, so we can now consider the quote as terminated.
          unterminatedQuoteChar = null;
        }
      }
    } else if (
      (isScript && isScriptQuoteChar(nextCharCode)) ||
      (isStyle && isStyleQuoteChar(nextCharCode))
    ) {
      unterminatedQuoteChar = nextChar;
    } else if (
      !isLegalTagNameChar(nextCharCode) &&
      rawContent.endsWith(closingTagnameMatchString)
    ) {
      const closingTagnameMatchStringLength = closingTagnameMatchString.length;
      return [
        lexClosingTagEnd,
        {
          type: LexerTokenType.TEXT_CONTENT,
          value: rawContent.slice(0, -closingTagnameMatchStringLength),
          l: startLine,
          c: startColumn,
        },
        {
          type: LexerTokenType.CLOSING_TAGNAME,
          value: targetClosingTagname,
          l: nextLine,
          c: nextCol - closingTagnameMatchStringLength,
        },
      ];
    }

    rawContent += nextChar;
  }
}
