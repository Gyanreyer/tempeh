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

    writeFile("./test.json", JSON.stringify(parsedTemplateData, null, 2));

    assert.deepStrictEqual(parsedTemplateData, {
      hasDefaultSlot: false,
      position: "1:1",
      nodes: [
        {
          tagName: "div",
          children: [
            {
              textContent: "Hello, world!",
              position: "1:6",
            },
          ],
          position: "1:1",
        },
        {
          textContent: "Some root-level text ",
          position: "2:1",
        },
        {
          tagName: "button",
          position: "3:1",
          staticAttributes: [
            {
              name: "role",
              value: "button",
              position: "3:9",
            },
            {
              name: "aria-disabled",
              position: "3:23",
            },
            {
              name: "disabled",
              position: "3:37",
            },
            {
              name: "aria-label",
              value: "My custom label",
              position: "3:46",
            },
          ],
          children: [
            {
              textContent: "Click me ",
              position: "4:0",
            },
            {
              tagName: "svg",
              position: "5:3",
              staticAttributes: [
                {
                  name: "viewBox",
                  value: "0 0 100 100",
                  position: "5:8",
                },
                {
                  name: "xmlns",
                  value: "http://www.w3.org/2000/svg",
                  position: "5:30",
                },
                {
                  name: "aria-hidden",
                  position: "5:65",
                },
              ],
              children: [
                {
                  tagName: "circle",
                  position: "6:5",
                  staticAttributes: [
                    {
                      name: "cx",
                      value: "50",
                      position: "6:13",
                    },
                    {
                      name: "cy",
                      value: "50",
                      position: "6:21",
                    },
                    {
                      name: "r",
                      value: "50",
                      position: "6:29",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          tagName: "p",
          position: "9:1",
          children: [
            {
              textContent: "Spaces should ",
              position: "9:4",
            },
            {
              tagName: "_",
              position: "9:18",
              children: [
                {
                  textContent: "be",
                  position: "9:21",
                },
              ],
            },
            {
              textContent: " ",
              position: "9:27",
            },
            {
              tagName: "em",
              position: "9:28",
              children: [
                {
                  textContent: "preserved",
                  position: "9:32",
                },
              ],
            },
            {
              textContent: " ",
              position: "9:46",
            },
            {
              tagName: "strong",
              position: "9:50",
              children: [
                {
                  textContent: "but flattened",
                  position: "9:58",
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

    assert.deepStrictEqual(parsedTemplateData, {
      hasDefaultSlot: false,
      position: "1:1",
      nodes: [
        {
          tagName: "ul",
          position: "1:1",
          children: [
            {
              tagName: "ListItem",
              position: "2:3",
              renderAttributes: [
                {
                  name: "for",
                  modifier: "item",
                  value: "items",
                  position: "2:14",
                },
                {
                  name: "attr",
                  modifier: "name",
                  value: "item.name",
                  position: "2:32",
                },
                {
                  name: "text",
                  value: "item.value",
                  position: "2:50",
                },
              ],
            },
          ],
        },
      ],
      inlineComponents: {
        ListItem: {
          position: "4:1",
          hasDefaultSlot: true,
          nodes: [
            {
              tagName: "li",
              position: "5:3",
              children: [
                {
                  tagName: "strong",
                  position: "6:5",
                  renderAttributes: [
                    {
                      name: "text",
                      value: "`${name}:`",
                      position: "6:14",
                    },
                  ],
                },
                {
                  textContent: " ",
                  position: "7:1",
                },
                {
                  tagName: "slot",
                  position: "7:5",
                },
              ],
            },
          ],
        },
        WhackyComponent: {
          hasDefaultSlot: false,
          position: "10:1",
          nodes: [
            {
              tagName: "div",
              position: "11:3",
              children: [
                {
                  tagName: "InnerComponent",
                  position: "12:5",
                },
                {
                  textContent: " ",
                  position: "13:1",
                },
              ],
            },
          ],
        },
        NestedComponent: {
          hasDefaultSlot: false,
          position: "13:5",
          nodes: [
            {
              tagName: "div",
              position: "14:7",
              children: [
                {
                  textContent: "Why would you do this?!",
                  position: "14:12",
                },
              ],
            },
          ],
        },
      },
    });
  });
});
