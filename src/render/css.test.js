import { test, describe } from "node:test";
import * as assert from "node:assert";

import { css } from "./css.js";

describe("css", () => {
  test("should scope CSS as expected", () => {
    const cssString = css(
      `
      .foo {
        color: red;
      }

      .bar :host {
        color: blue;
      }

      :host {
        color: green;
      }

      :host(p.baz) {
        color: yellow;
      }

      :is(:host, .foo) {
        color: purple;
      }
    `,
      "my-scid",
      {
        scope: true,
        minify: false,
      }
    );

    const expectedOutput = `[data-scid="my-scid"] .foo {
  color: red;
}

.bar [data-scid="my-scid"] {
  color: #00f;
}

[data-scid="my-scid"] {
  color: green;
}

[data-scid="my-scid"]p.baz {
  color: #ff0;
}

:is([data-scid="my-scid"], .foo) {
  color: purple;
}
`;

    assert.strictEqual(cssString, expectedOutput);
  });
});
