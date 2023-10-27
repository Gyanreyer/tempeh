import { test, describe } from "node:test";
import * as assert from "node:assert";

import { parseTag } from "./parseElements.js";

describe("parseTag", () => {
  test("should parse a tag with no attributes", () => {
    assert.deepStrictEqual(parseTag("<div>", 0, null), {
      tagName: "div",
      children: [],
      attributes: {},
      renderAttributes: {},
      parentElement: null,
    });

    assert.deepStrictEqual(parseTag("<div  >", 0, null), {
      tagName: "div",
      children: [],
      attributes: {},
      renderAttributes: {},
      parentElement: null,
    });

    assert.deepStrictEqual(
      parseTag(
        `<

    div

      >`,
        0,
        null
      ),
      {
        tagName: "div",
        children: [],
        attributes: {},
        renderAttributes: {},
        parentElement: null,
      }
    );
  });
});
