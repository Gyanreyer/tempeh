import { test, describe } from "node:test";
import * as assert from "node:assert";

import { unorderedPromiseIterator } from "./unorderedPromiseIterator.js";

/**
 * @param {number} ms
 */
const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("unorderedPromiseIterator", () => {
  test("should yield promises in the order they resolve", async () => {
    const promises = [
      waitFor(100).then(() => "first"),
      waitFor(150).then(() => "second"),
      waitFor(50).then(() => "third"),
    ];

    const yieldedValues = [];

    for await (const value of unorderedPromiseIterator(promises)) {
      yieldedValues.push(value);
    }

    assert.deepStrictEqual(yieldedValues, ["third", "first", "second"]);
  });

  test("handles when promises throw", async () => {
    const promises = [
      waitFor(100).then(() => "first"),
      Promise.reject(new Error("second")),
      waitFor(50).then(() => "third"),
    ];

    const yieldedValues = [];

    for await (const value of unorderedPromiseIterator(promises)) {
      yieldedValues.push(value);
    }

    assert.deepEqual(yieldedValues, [
      new Error("unorderedPromiseIterator: An unexpected error occurred.", {
        cause: new Error("second"),
      }),
      "third",
      "first",
    ]);
  });
});
