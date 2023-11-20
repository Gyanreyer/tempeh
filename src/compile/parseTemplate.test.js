import { test, describe } from "node:test";
import * as assert from "node:assert";
import { readFile, writeFile } from "node:fs/promises";

import { resolveRelativePath } from "../utils/resolveRelativePath.js";
import { parseTemplate } from "./parseTemplate.js";

describe("parseTemplate", () => {
  test("should parse a simple component file as expected", async () => {
    const componentFileBuffer = await readFile(
      resolveRelativePath(
        "../../test/fixtures/simpleComponent.tmph.html",
        import.meta
      )
    );

    const parsedTemplateData = await parseTemplate(componentFileBuffer);

    assert.deepStrictEqual(parsedTemplateData, {
      hasDefaultSlot: false,
      nodes: [
        {
          tagName: "div",
          children: [
            {
              textContent: "Hello, world!",
            },
          ],
        },
        {
          textContent: "Some root-level text ",
        },
        {
          tagName: "button",
          staticAttributes: [
            {
              name: "role",
              value: "button",
            },
            {
              name: "aria-disabled",
            },
            {
              name: "disabled",
            },
            {
              name: "aria-label",
              value: "My custom label",
            },
          ],
          children: [
            {
              textContent: "Click me ",
            },
            {
              tagName: "svg",
              staticAttributes: [
                {
                  name: "viewBox",
                  value: "0 0 100 100",
                },
                {
                  name: "xmlns",
                  value: "http://www.w3.org/2000/svg",
                },
                {
                  name: "aria-hidden",
                },
              ],
              children: [
                {
                  tagName: "circle",
                  staticAttributes: [
                    {
                      name: "cx",
                      value: "50",
                    },
                    {
                      name: "cy",
                      value: "50",
                    },
                    {
                      name: "r",
                      value: "50",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          tagName: "p",
          children: [
            {
              textContent: "Spaces should ",
            },
            {
              tagName: "_",
              children: [
                {
                  textContent: "be",
                },
              ],
            },
            {
              textContent: " ",
            },
            {
              tagName: "em",
              children: [
                {
                  textContent: "preserved",
                },
              ],
            },
            {
              textContent: " ",
            },
            {
              tagName: "strong",
              children: [
                {
                  textContent: "but flattened",
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test("should parse a component file with inline sub-components", async () => {
    const componentFileBuffer = await readFile(
      resolveRelativePath(
        "../../test/fixtures/inlineSubComponents.tmph.html",
        import.meta
      )
    );

    const parsedTemplateData = await parseTemplate(componentFileBuffer);

    writeFile("./test.json", JSON.stringify(parsedTemplateData, null, 2));

    assert.deepStrictEqual(parsedTemplateData, {
      hasDefaultSlot: false,
      nodes: [
        {
          tagName: "ul",
          children: [
            {
              tagName: "ListItem",
              renderAttributes: [
                {
                  name: "for",
                  modifier: "item",
                  value: "items",
                },
                {
                  name: "attr",
                  modifier: "name",
                  value: "item.name",
                },
                {
                  name: "text",
                  value: "item.value",
                },
              ],
            },
          ],
        },
      ],
      inlineComponents: {
        ListItem: {
          hasDefaultSlot: true,
          nodes: [
            {
              tagName: "li",
              children: [
                {
                  tagName: "strong",
                  renderAttributes: [
                    {
                      name: "text",
                      value: "`${name}:`",
                    },
                  ],
                },
                {
                  textContent: " ",
                },
                {
                  tagName: "slot",
                },
              ],
            },
          ],
        },
        WhackyComponent: {
          hasDefaultSlot: false,
          nodes: [
            {
              tagName: "div",
              children: [
                {
                  tagName: "InnerComponent",
                },
                {
                  textContent: " ",
                },
              ],
            },
          ],
        },
        NestedComponent: {
          hasDefaultSlot: false,
          nodes: [
            {
              tagName: "div",
              children: [
                {
                  textContent: "Why would you do this?!",
                },
              ],
            },
          ],
        },
      },
    });
  });
});
