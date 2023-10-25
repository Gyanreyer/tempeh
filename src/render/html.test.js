import { test, describe } from "node:test";
import * as assert from "node:assert";

import { html } from "./html.js";

describe("html", () => {
  test("should remove whitespace from HTML as expected", () => {
    const htmlString = html`
      <!DOCTYPE html>
      <html lang="en-US">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Hello</title>
        </head>
        <body>
          <h1>Hello, world!</h1>

          <p>This is a paragraph.</p>
          <p>${2} times ${8} is ${2 * 8}</p>
        </body>
      </html>
    `;

    const expectedOutput =
      '<!DOCTYPE html><html lang="en-US"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Hello</title></head><body><h1>Hello, world!</h1><p>This is a paragraph.</p><p>2 times 8 is 16</p></body></html>';

    assert.strictEqual(htmlString, expectedOutput);
  });

  test("should respect whitespace in <pre> tags", () => {
    const htmlString = html`
      <!DOCTYPE html>
      <html lang="en-US">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Hello</title>
        </head>
        <body>
          <h1>Hello, world!</h1>

          <pre>
            This is a preformatted text block.
            It should respect whitespace and line breaks.
          </pre
          >
        </body>
      </html>
    `;

    const expectedOutput =
      '<!DOCTYPE html><html lang="en-US"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Hello</title></head><body><h1>Hello, world!</h1><pre>\n          This is a preformatted text block.\n          It should respect whitespace and line breaks.\n        </pre></body></html>';

    assert.strictEqual(htmlString, expectedOutput);
  });

  test("should respect whitespace in HTML attributes", () => {});
});
