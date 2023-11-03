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
  let outputString = "";

  if (typeof range[0] === "number" && typeof range[1] === "number") {
    const incrementValue = Math.sign(range[1] - range[0]);
    for (
      let i = range[0];
      incrementValue > 0 ? i <= range[1] : i >= range[1];
      i += incrementValue
    ) {
      outputString += render(i);
    }
  } else {
    for (const subRange of range) {
      if (typeof subRange === "number") {
        throw new Error(
          "Received invalid range array mixing numbers and range tuples."
        );
      }

      outputString += renderForRange(subRange, render);
    }
  }

  return outputString;
}
