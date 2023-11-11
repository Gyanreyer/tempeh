import { test, describe } from "node:test";
import * as assert from "node:assert";
import { readFile } from "node:fs/promises";

import { resolveRelativePath } from "../utils/resolveRelativePath.js";
import { parseXML } from "./parseXML.js";

describe("parseXML", () => {
  test("should parse a simple component file as expected", async () => {
    const componentFileBuffer = await readFile(
      resolveRelativePath(
        "../../test/fixtures/simpleComponent.tmph.html",
        import.meta
      )
    );

    const rootNodes = await parseXML(componentFileBuffer);

    assert.deepStrictEqual(rootNodes, [
      { tagName: "div", attributes: null, children: ["Hello, world!"] },
      "Some root-level text",
      {
        tagName: "button",
        attributes: [
          "role",
          "button",
          "aria-disabled",
          true,
          "disabled",
          true,
          "aria-label",
          "My custom label",
        ],
        children: [
          "Click me",
          {
            tagName: "svg",
            attributes: [
              "viewBox",
              "0 0 100 100",
              "xmlns",
              "http://www.w3.org/2000/svg",
              "aria-hidden",
              true,
            ],
            children: [
              {
                tagName: "circle",
                attributes: ["cx", "50", "cy", "50", "r", "50"],
                children: [],
              },
            ],
          },
        ],
      },
    ]);
  });
});
