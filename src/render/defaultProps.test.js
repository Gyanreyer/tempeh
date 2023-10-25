import { test, describe } from "node:test";
import * as assert from "node:assert";

import { defaultProps } from "./defaultProps.js";

describe("defaultProps", () => {
  test("should merge default props as expected", () => {
    const props = {
      foo: "bar",
      baz: undefined,
      nestedObj: {
        hello: "world",
        nullValue: null,
      },
    };

    const defaults = {
      baz: "qux",
      zip: "zap",
      nestedObj: {
        hello: "universe",
        one: 23,
        nullValue: "not null",
      },
    };

    defaultProps(props, defaults);

    assert.deepStrictEqual(props, {
      foo: "bar",
      baz: "qux",
      zip: "zap",
      nestedObj: {
        hello: "world",
        one: 23,
        nullValue: null,
      },
    });
  });
});
