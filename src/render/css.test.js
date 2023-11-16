import { test, describe } from "node:test";
import * as assert from "node:assert";

import css from "./css.js";

describe("css", () => {
  test("@scope should scope CSS as expected", () => {
    const cssString = css(
      `
      @scope {
        .foo {
          padding: 4px;
        }

        .bar :scope {
          font-weight: bold;
        }

        :scope {
          background: none;
        }

        p.baz:scope {
          font-size: 2rem;
        }

        :is(:scope, .foo) {
          display: flex;
        }
      }

      body {
        margin: 0;
      }

      :root {
        --my-var: 1px;
      }
    `,
      "my-scid",
      {
        scope: true,
        minify: false,
      }
    );

    const expectedOutput = `[data-scid="my-scid"] .foo {
  padding: 4px;
}

.bar [data-scid="my-scid"] {
  font-weight: bold;
}

[data-scid="my-scid"] {
  background: none;
}

p.baz[data-scid="my-scid"] {
  font-size: 2rem;
}

:is([data-scid="my-scid"], .foo) {
  display: flex;
}

body {
  margin: 0;
}

:root {
  --my-var: 1px;
}
`;

    assert.strictEqual(cssString, expectedOutput);
  });
});
