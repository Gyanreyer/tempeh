/**
 * @typedef {Array<number | RenderRange>} RenderRange
 */

/**
 *
 * @param {RenderRange} range
 * @param {(index: number) => Promise<string>} render
 * @returns {Promise<string>}
 */
export default async function renderForRange(range, render) {
  if (!Array.isArray(range)) {
    throw new Error(`Received invalid range array: ${JSON.stringify(range)}`);
  }

  /**
   * @type {Promise<string>[]}
   */
  let outputPromises = [];

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
      outputPromises.push(render(i));
    }
  } else if (Array.isArray(range[0])) {
    for (const subRange of range) {
      outputPromises.push(
        renderForRange(/** @type {RenderRange} */ (subRange), render)
      );
    }
  }

  let outputString = "";

  const results = await Promise.allSettled(outputPromises);

  for (const result of results) {
    if (result.status === "fulfilled") {
      outputString += result.value;
    } else {
      console.error(result.reason);
    }
  }

  return outputString;
}
