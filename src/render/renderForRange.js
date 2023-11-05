/**
 * @typedef {Array<number | RenderRange>} RenderRange
 */

/**
 *
 * @param {RenderRange} range
 * @param {(index: number) => string} render
 * @returns {string}
 */
export function renderForRange(range, render) {
  if (!Array.isArray(range)) {
    throw new Error(`Received invalid range array: ${JSON.stringify(range)}`);
  }

  let outputString = "";

  if (typeof range[0] === "number") {
    /** @type {number} */
    let rangeStart;
    /** @type {number} */
    let rangeEnd;

    if (range.length === 1) {
      rangeStart = 0;
      rangeEnd = range[0];
    } else if (range.length === 2 && typeof range[1] === "number") {
      rangeStart = range[0];
      rangeEnd = range[1];
    } else {
      throw new Error(`Received invalid range array: ${JSON.stringify(range)}`);
    }

    const incrementValue = Math.sign(rangeEnd - rangeStart);
    for (
      let i = rangeStart;
      incrementValue > 0 ? i <= rangeEnd : i >= rangeEnd;
      i += incrementValue
    ) {
      outputString += render(i);
    }
  } else if (Array.isArray(range[0])) {
    for (const subRange of range) {
      outputString += renderForRange(
        /** @type {RenderRange} */ (subRange),
        render
      );
    }
  }

  return outputString;
}
