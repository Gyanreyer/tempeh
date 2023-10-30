/**
 * @typedef {Object} Cursor
 * @property {() => string} peek - Returns the character at the cursor's current position.
 * @property {() => string} peekNext - Returns the character at the cursor's next position.
 * @property {() => string} peekPrev - Returns the character at the cursor's previous position.
 * @property {() => boolean} isAtEnd - Returns true if the cursor is at the end of the string.
 * @property {() => void} advanceCursor - Advances the cursor forward one character.
 * @property {(predicate: (currentChar: string, nextChar: string, prevChar: string) => boolean, shouldCollectSubstring?: boolean) => string} advanceUntil - Takes a predicate callback and keeps advancing the cursor until the predicate returns true or we hit the end of the string. If optional `shouldCollectSubstring` param is true, we will gather and return the substring from the cursor's initial position to the last character before the predicate returned true. Otherwise, we will return the first character which matched the predicate.
 */

/**
 * @param {string} str
 * @param {number} [initialCursorIndex=0]
 *
 * @returns {Cursor}
 */
export function makeCursor(str, initialCursorIndex = 0) {
  let cursorIndex = initialCursorIndex;

  const peek = () => str[cursorIndex];

  const peekNext = () => str[cursorIndex + 1];

  const peekPrev = () => str[cursorIndex - 1];

  const isAtEnd = () => cursorIndex >= str.length;

  const advanceCursor = () => {
    ++cursorIndex;
  };

  /**
   * @type {Cursor["advanceUntil"]}
   */
  const advanceUntil = (predicate, shouldCollectSubstring = false) => {
    let collectedSubstring = "";

    while (!isAtEnd()) {
      const currentChar = peek();

      if (predicate(currentChar, peekNext(), peekPrev())) {
        if (!shouldCollectSubstring) {
          // If we're not collecting a substring, return the character which matched the predicate
          return currentChar;
        }

        // If we were collecting a substring, we only want to gather the substring up to the point where the predicate matched
        // so we'll just break out of the loop without adding the last character
        break;
      } else if (shouldCollectSubstring) {
        collectedSubstring += currentChar;
      }
      advanceCursor();
    }

    return collectedSubstring;
  };

  return {
    peek,
    peekNext,
    peekPrev,
    isAtEnd,
    advanceCursor,
    advanceUntil,
  };
}
