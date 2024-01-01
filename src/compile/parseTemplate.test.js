import { test, describe, after } from "node:test";
import * as assert from "node:assert";

import { resolveRelativePath } from "../utils/resolveRelativePath.js";
import { parseTemplate } from "./parseTemplate.js";
import { stopTemplateParserServer } from "./templateParserServer.js";
import { writeFileSync } from "node:fs";

/** @typedef {import("./types.js").TmphTemplateData} TmphTemplateData */

describe("parseTemplate", () => {
  after(() => {
    stopTemplateParserServer();
  });

  test("should parse a simple component file as expected", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/simpleComponent.tmph.html",
      import.meta
    );

    const parsedTemplateNodes = await parseTemplate(templateSourceFilePath);

    assert.deepStrictEqual(parsedTemplateNodes, [
      {
        tagName: "div",
        children: [
          {
            textContent: "Hello, world!",
            line: 1,
            column: 6,
          },
        ],
        line: 1,
        column: 1,
      },
      {
        textContent: "Some root-level text ",
        line: 2,
        column: 1,
      },
      {
        tagName: "button",
        staticAttributes: [
          {
            name: "role",
            value: "button",
            line: 3,
            column: 9,
          },
          {
            name: "aria-disabled",
            line: 3,
            column: 23,
          },
          {
            name: "disabled",
            line: 3,
            column: 37,
          },
          {
            name: "aria-label",
            value: "My custom label",
            line: 3,
            column: 46,
          },
        ],
        children: [
          {
            textContent: "Click me ",
            line: 3,
            column: 75,
          },
          {
            tagName: "svg",
            staticAttributes: [
              {
                name: "viewBox",
                value: "0 0 100 100",
                line: 5,
                column: 8,
              },
              {
                name: "xmlns",
                value: "http://www.w3.org/2000/svg",
                line: 5,
                column: 30,
              },
              {
                name: "aria-hidden",
                line: 5,
                column: 65,
              },
            ],
            children: [
              {
                tagName: "circle",
                staticAttributes: [
                  {
                    name: "cx",
                    value: "50",
                    line: 6,
                    column: 13,
                  },
                  {
                    name: "cy",
                    value: "50",
                    line: 6,
                    column: 21,
                  },
                  {
                    name: "r",
                    value: "50",
                    line: 6,
                    column: 29,
                  },
                ],
                line: 6,
                column: 5,
              },
            ],
            line: 5,
            column: 3,
          },
        ],
        line: 3,
        column: 1,
      },
      {
        tagName: "p",
        children: [
          {
            textContent: "Spaces should ",
            line: 9,
            column: 4,
          },
          {
            tagName: "_",
            children: [
              {
                textContent: "be",
                line: 9,
                column: 21,
              },
            ],
            line: 9,
            column: 18,
          },
          {
            textContent: " ",
            line: 9,
            column: 27,
          },
          {
            tagName: "em",
            children: [
              {
                textContent: "preserved",
                line: 9,
                column: 32,
              },
            ],
            line: 9,
            column: 28,
          },
          {
            textContent: " ",
            line: 9,
            column: 46,
          },
          {
            tagName: "strong",
            children: [
              {
                textContent: "but flattened",
                line: 9,
                column: 58,
              },
            ],
            line: 9,
            column: 50,
          },
        ],
        line: 9,
        column: 1,
      },
    ]);
  });

  test("should parse a component file with inline sub-components", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/inlineSubComponents.tmph.html",
      import.meta
    );
    const parsedTemplateNodes = await parseTemplate(templateSourceFilePath);

    assert.deepStrictEqual(parsedTemplateNodes, [
      {
        tagName: "ul",
        children: [
          {
            tagName: "ListItem",
            renderAttributes: [
              {
                name: "#for",
                modifier: "item",
                expressionValue: "items",
                line: 2,
                column: 14,
              },
              {
                name: "#attr",
                modifier: "name",
                expressionValue: "item.name",
                line: 2,
                column: 32,
              },
              {
                name: "#text",
                expressionValue: "item.value",
                line: 2,
                column: 50,
              },
            ],
            line: 2,
            column: 3,
          },
        ],
        line: 1,
        column: 1,
      },
      {
        tagName: "template",
        staticAttributes: [
          {
            name: "id",
            value: "ListItem",
            line: 4,
            column: 11,
          },
        ],
        renderAttributes: [
          {
            name: "#component",
            line: 4,
            column: 26,
          },
        ],
        children: [
          {
            tagName: "li",
            children: [
              {
                tagName: "strong",
                renderAttributes: [
                  {
                    name: "#text",
                    expressionValue: "`${name}:`",
                    line: 6,
                    column: 14,
                  },
                ],
                line: 6,
                column: 5,
              },
              {
                textContent: " ",
                line: 7,
                column: 1,
              },
              {
                tagName: "slot",
                line: 7,
                column: 5,
              },
            ],
            line: 5,
            column: 3,
          },
        ],
        line: 4,
        column: 1,
      },
      {
        tagName: "template",
        staticAttributes: [
          {
            name: "id",
            value: "WhackyComponent",
            line: 10,
            column: 11,
          },
        ],
        renderAttributes: [
          {
            name: "#component",
            line: 10,
            column: 33,
          },
        ],
        children: [
          {
            tagName: "div",
            children: [
              {
                tagName: "InnerComponent",
                line: 12,
                column: 5,
              },
              {
                textContent: " ",
                line: 13,
                column: 1,
              },
              {
                tagName: "template",
                staticAttributes: [
                  {
                    name: "id",
                    value: "NestedComponent",
                    line: 13,
                    column: 15,
                  },
                ],
                renderAttributes: [
                  {
                    name: "#component",
                    line: 13,
                    column: 37,
                  },
                ],
                children: [
                  {
                    tagName: "slot",
                    staticAttributes: [
                      {
                        name: "name",
                        value: "before",
                        line: 14,
                        column: 13,
                      },
                    ],
                    line: 14,
                    column: 7,
                  },
                  {
                    textContent: " ",
                    line: 15,
                    column: 1,
                  },
                  {
                    tagName: "div",
                    children: [
                      {
                        textContent: "Why would you do this?!",
                        line: 15,
                        column: 12,
                      },
                    ],
                    line: 15,
                    column: 7,
                  },
                  {
                    textContent: " ",
                    line: 16,
                    column: 1,
                  },
                  {
                    tagName: "slot",
                    staticAttributes: [
                      {
                        name: "name",
                        value: "after",
                        line: 16,
                        column: 13,
                      },
                    ],
                    line: 16,
                    column: 7,
                  },
                ],
                line: 13,
                column: 5,
              },
            ],
            line: 11,
            column: 3,
          },
        ],
        line: 10,
        column: 1,
      },
    ]);
  });

  test("should parse a component file with styles", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/componentWithStyles.tmph.html",
      import.meta
    );
    const parsedTemplateNodes = await parseTemplate(templateSourceFilePath);

    assert.deepStrictEqual(parsedTemplateNodes, [
      {
        tagName: "main",
        children: [
          {
            tagName: "h1",
            children: [
              {
                textContent: "Heading",
                line: 2,
                column: 7,
              },
            ],
            line: 2,
            column: 3,
          },
          {
            textContent: " ",
            line: 3,
            column: 1,
          },
          {
            tagName: "p",
            children: [
              {
                textContent: "Paragraph",
                line: 3,
                column: 6,
              },
            ],
            line: 3,
            column: 3,
          },
        ],
        line: 1,
        column: 1,
      },
      {
        tagName: "style",
        children: [
          {
            textContent:
              "@scope {\n    main {\n      font-size: 1.2em;\n    }\n\n    h1,\n    p {\n      margin: 0;\n    }\n  }",
            line: 5,
            column: 8,
          },
        ],
        line: 5,
        column: 1,
      },
      {
        tagName: "style",
        renderAttributes: [
          {
            name: "#bucket",
            modifier: "global",
            line: 17,
            column: 9,
          },
        ],
        children: [
          {
            textContent: ":root {\n    --color: #333;\n  }",
            line: 17,
            column: 23,
          },
        ],
        line: 17,
        column: 1,
      },
      {
        tagName: "style",
        renderAttributes: [
          {
            name: "#raw",
            line: 22,
            column: 9,
          },
        ],
        children: [
          {
            textContent: "main {\n    color: red;\n  }",
            line: 22,
            column: 13,
          },
        ],
        line: 22,
        column: 1,
      },
    ]);
  });

  test("should parse a component file with scripts", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/componentWithScripts.tmph.html",
      import.meta
    );
    const parsedTemplateNodes = await parseTemplate(templateSourceFilePath);

    assert.deepStrictEqual(parsedTemplateNodes, [
      {
        tagName: "button",
        children: [
          {
            textContent: "Click me!",
            line: 1,
            column: 9,
          },
        ],
        line: 1,
        column: 1,
      },
      {
        tagName: "script",
        renderAttributes: [
          {
            name: "#scope",
            modifier: "component",
            line: 2,
            column: 10,
          },
        ],
        children: [
          {
            textContent:
              "const observer = new IntersectionObserver((entries) => {\n    entries.forEach((entry) => {\n      if (entry.isIntersecting) {\n        entry.target.opacity = 1;\n      }\n    });\n  });",
            line: 2,
            column: 26,
          },
        ],
        line: 2,
        column: 1,
      },
      {
        tagName: "script",
        renderAttributes: [
          {
            name: "#scope",
            modifier: "instance",
            line: 11,
            column: 10,
          },
        ],
        children: [
          {
            textContent:
              'this.addEventListener("click", () => console.log("You clicked me!"));\n\n  observer.observe(this);',
            line: 11,
            column: 25,
          },
        ],
        line: 11,
        column: 1,
      },
      {
        tagName: "script",
        children: [
          {
            textContent: 'console.log("This is a global script!");',
            line: 16,
            column: 9,
          },
        ],
        line: 16,
        column: 1,
      },
      {
        tagName: "script",
        renderAttributes: [
          {
            name: "#render",
            line: 19,
            column: 10,
          },
          {
            name: "#",
            expressionValue: "this is a comment!",
            line: 19,
            column: 18,
          },
        ],
        children: [
          {
            textContent:
              "export const num = Math.random();\n  export function render() {\n    return `<button>Click me!</button>`;\n  }",
            line: 19,
            column: 40,
          },
        ],
        line: 19,
        column: 1,
      },
      {
        tagName: "script",
        staticAttributes: [
          {
            name: "src",
            value: "./index.js",
            line: 25,
            column: 9,
          },
        ],
        children: [
          {
            line: 25,
            column: 26,
          },
        ],
        line: 25,
        column: 1,
      },
    ]);
  });
});
