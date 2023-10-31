import { test, describe } from "node:test";
import * as assert from "node:assert";

import { parseElements } from "./parseElements.js";

describe("parseTag", () => {
  test("should parse a tag with no attributes", () => {
    assert.deepStrictEqual(parseElements("<div>"), [
      {
        tagName: "div",
        attributes: {},
        renderAttributes: {},
        children: [],
        parent: null,
      },
    ]);

    assert.deepStrictEqual(parseElements("<div  >"), [
      {
        tagName: "div",
        attributes: {},
        renderAttributes: {},
        children: [],
        parent: null,
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
          attributes: {},
          renderAttributes: {},
          children: [],
          parent: null,
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
          attributes: {
            id: "foo",
            bool: true,
            unquoted: "hello",
            "unquoted-2": "hi",
            unterminated: "",
          },
          renderAttributes: {},
          children: [],
          parent: null,
        },
      ]
    );
  });

  test("should parse deeply nested tags", () => {
    /** @type {import("./parseElements.js").TmphElement} */
    const outerDiv = {
      tagName: "div",
      attributes: {
        "aria-label": "Hello",
      },
      renderAttributes: {},
      children: [],
      parent: null,
    };

    /** @type {import("./parseElements.js").TmphElement} */
    const paragraph = {
      tagName: "p",
      attributes: {
        class: "test test2",
        id: "paragraph",
      },
      renderAttributes: {},
      children: [],
      parent: outerDiv,
    };
    outerDiv.children.push(paragraph);

    paragraph.children.push("This is ");

    /** @type {import("./parseElements.js").TmphElement} */
    const span = {
      tagName: "span",
      attributes: {},
      renderAttributes: {},
      children: [],
      parent: paragraph,
    };
    paragraph.children.push(span);

    span.children.push("some ");

    /** @type {import("./parseElements.js").TmphElement} */
    const em = {
      tagName: "em",
      attributes: {},
      renderAttributes: {},
      children: ["text"],
      parent: span,
    };
    span.children.push(em);

    assert.deepStrictEqual(
      parseElements(`
      <div aria-label=Hello>
        <p class="test test2" id="paragraph">
          This is <span>some <em>text</em></span>
        </p>
      </div>
      `),
      [outerDiv]
    );
  });

  test("should parse text content", () => {
    assert.deepStrictEqual(parseElements("hello world"), ["hello world"]);

    assert.deepStrictEqual(
      parseElements(`
    Hey so this is some leading text
    <p>
      But then there's this p
    </p>
    And then a little more trailing text
    `),
      [
        "Hey so this is some leading text\n    ",
        {
          tagName: "p",
          children: ["But then there's this p\n    "],
          attributes: {},
          renderAttributes: {},
          parent: null,
        },
        "And then a little more trailing text\n    ",
      ]
    );
  });

  test("");
});
