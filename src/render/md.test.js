import { test, describe } from "node:test";
import * as assert from "node:assert";

import { md } from "./md.js";

describe("md", () => {
  test("should convert markdown to HTML as expected", async () => {
    const markdownString = await md(`
# Hello, world!

This is a paragraph.

${2} times ${8} is ${2 * 8}

<div>
  <!-- MD syntax is not processed inside HTML tags -->
  *Hello*
</div>
    `);

    const expectedOutput = `<h1>Hello, world!</h1><p>This is a paragraph.</p><p>2 times 8 is 16</p><div> *Hello*</div>`;

    assert.strictEqual(markdownString, expectedOutput);
  });
});
