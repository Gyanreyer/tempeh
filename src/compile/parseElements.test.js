import { test, describe } from "node:test";
import * as assert from "node:assert";

import { parseElements } from "./parseElements.js";

describe("parseTag", () => {
  test("should parse a tag with no attributes", () => {
    assert.deepStrictEqual(parseElements("<div>"), [
      {
        tagName: "div",
        children: [],
        attributes: {},
        renderAttributes: {},
        parentElement: null,
      },
    ]);

    assert.deepStrictEqual(parseElements("<div  >"), [
      {
        tagName: "div",
        children: [],
        attributes: {},
        renderAttributes: {},
        parentElement: null,
      },
    ]);

    assert.deepStrictEqual(
      parseElements(
        `<

    div

      >`
      ),
      [
        {
          tagName: "div",
          children: [],
          attributes: {},
          renderAttributes: {},
          parentElement: null,
        },
      ]
    );
  });

  test("should parse a tag with attributes", () => {
    assert.deepStrictEqual(
      parseElements(
        `<div id="foo" bool
       unquoted=hello
       unquoted-2=
        hi
         unterminated=>`
      ),
      [
        {
          tagName: "div",
          children: [],
          attributes: {
            id: "foo",
            bool: true,
            unquoted: "hello",
            "unquoted-2": "hi",
            unterminated: "",
          },
          renderAttributes: {},
          parentElement: null,
        },
      ]
    );
  });
});
