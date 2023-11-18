import { test, describe } from "node:test";
import * as assert from "node:assert";

import processCSS from "./processCSS.js";

describe("css", () => {
  test("@scope should scope CSS as expected", () => {
    const cssString = processCSS(
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

  test("@scope can take a selector to target specific root elements", () => {
    const cssString = processCSS(
      `
      @scope(header){
        :scope {
          background: none;
        }

        img {
          display: block;
        }
      }

      @scope(header, footer){
        :scope {
          font-weight: bold;
        }

        img {
          display: inline;
        }
      }
      `,
      "my-scid",
      {
        minify: false,
      }
    );

    const expectedOutput = `[data-scid="my-scid"]header {
  background: none;
}

[data-scid="my-scid"]header img {
  display: block;
}

[data-scid="my-scid"]:is(header, footer) {
  font-weight: bold;
}

[data-scid="my-scid"]:is(header, footer) img {
  display: inline;
}
`;

    assert.strictEqual(cssString, expectedOutput);
  });
});
