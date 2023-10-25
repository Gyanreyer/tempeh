import { test, describe } from "node:test";
import * as assert from "node:assert";

import { renderAttributes } from "./renderAttributes.js";

describe("renderAttributes", () => {
  test("renders attributes with string values as expected", () => {
    assert.strictEqual(
      renderAttributes({
        class: "foo",
        id: "bar",
        "aria-label": "baz",
        test: "",
      }),
      ' class="foo" id="bar" aria-label="baz" test=""'
    );
  });

  test("renders attributes with boolean values as expected", () => {
    assert.strictEqual(
      renderAttributes({
        disabled: true,
        "aria-hidden": true,
      }),
      " disabled aria-hidden"
    );

    assert.strictEqual(
      renderAttributes({
        disabled: true,
        "aria-hidden": false,
      }),
      " disabled"
    );

    assert.strictEqual(
      renderAttributes({
        disabled: false,
        "aria-hidden": false,
      }),
      ""
    );
  });

  test("escapes attribute values to prevent XSS attacks", () => {
    assert.strictEqual(
      renderAttributes({
        class: 'foo" onmouseover="alert(\'Gotcha!\')"',
      }),
      ' class="foo&quot; onmouseover=&quot;alert(&#x27;Gotcha!&#x27;)&quot;"'
    );
  });
});
