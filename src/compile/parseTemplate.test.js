import { test, describe, after } from "node:test";
import * as assert from "node:assert";

import { resolveRelativePath } from "../utils/resolveRelativePath.js";
import { parseTemplate } from "./parseTemplate.js";
import { stopTemplateParserServer } from "./templateParserServer.js";

describe("parseTemplate", () => {
  after(() => {
    stopTemplateParserServer();
  });

  test("should parse a simple component file as expected", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/simpleComponent.tmph.html",
      import.meta
    );

    const parsedTemplateData = await parseTemplate(templateSourceFilePath);

    assert.deepStrictEqual(parsedTemplateData, {
      src: "/Users/ryangeyer/Projects/tempeh/test/fixtures/simpleComponent.tmph.html",
      nodes: [
        {
          tagName: "div",
          attributes: [
            {
              name: "data-this",
              value: "attr_value_has_no_quotes",
              l: 1,
              c: 6,
            },
          ],
          children: [
            {
              textContent: "Hello, world!",
              l: 1,
              c: 41,
            },
          ],
          l: 1,
          c: 2,
        },
        {
          textContent: "\nSome root-level text\n",
          l: 1,
          c: 60,
        },
        {
          tagName: "button",
          attributes: [
            {
              name: "role",
              value: "button",
              l: 3,
              c: 9,
            },
            {
              name: "aria-disabled",
              value: "",
              l: 3,
              c: 23,
            },
            {
              name: "disabled",
              value: "",
              l: 3,
              c: 37,
            },
            {
              name: "aria-label",
              value: "My custom label",
              l: 3,
              c: 46,
            },
          ],
          children: [
            {
              textContent: "\n  Click me\n  ",
              l: 3,
              c: 75,
            },
            {
              tagName: "svg",
              attributes: [
                {
                  name: "viewBox",
                  value: "0 0 100 100",
                  l: 5,
                  c: 8,
                },
                {
                  name: "xmlns",
                  value: "http://www.w3.org/2000/svg",
                  l: 5,
                  c: 30,
                },
                {
                  name: "aria-hidden",
                  value: "",
                  l: 5,
                  c: 65,
                },
              ],
              children: [
                {
                  textContent: "\n    ",
                  l: 5,
                  c: 77,
                },
                {
                  tagName: "circle",
                  attributes: [
                    {
                      name: "cx",
                      value: "50",
                      l: 6,
                      c: 13,
                    },
                    {
                      name: "cy",
                      value: "50",
                      l: 6,
                      c: 21,
                    },
                    {
                      name: "r",
                      value: "50",
                      l: 6,
                      c: 29,
                    },
                  ],
                  l: 6,
                  c: 6,
                },
                {
                  textContent: "\n  ",
                  l: 6,
                  c: 45,
                },
              ],
              l: 5,
              c: 4,
            },
            {
              textContent: "\n",
              l: 7,
              c: 9,
            },
          ],
          l: 3,
          c: 2,
        },
        {
          textContent: "\n",
          l: 8,
          c: 10,
        },
        {
          tagName: "p",
          children: [
            {
              textContent: "Spaces should ",
              l: 9,
              c: 4,
            },
            {
              tagName: "_",
              children: [
                {
                  textContent: "be",
                  l: 9,
                  c: 21,
                },
              ],
              l: 9,
              c: 19,
            },
            {
              textContent: " ",
              l: 9,
              c: 27,
            },
            {
              tagName: "em",
              children: [
                {
                  textContent: "preserved",
                  l: 9,
                  c: 32,
                },
              ],
              l: 9,
              c: 29,
            },
            {
              textContent: "    ",
              l: 9,
              c: 46,
            },
            {
              tagName: "strong",
              children: [
                {
                  textContent: "between\n    tags\n  ",
                  l: 9,
                  c: 58,
                },
              ],
              l: 9,
              c: 51,
            },
            {
              textContent: "\n",
              l: 11,
              c: 12,
            },
          ],
          l: 9,
          c: 2,
        },
        {
          textContent: "\n",
          l: 12,
          c: 5,
        },
      ],
    });
  });

  test("should parse a component file with inline sub-components", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/inlineSubComponents.tmph.html",
      import.meta
    );
    const parsedTemplateData = await parseTemplate(templateSourceFilePath);

    assert.deepStrictEqual(parsedTemplateData, {
      src: "/Users/ryangeyer/Projects/tempeh/test/fixtures/inlineSubComponents.tmph.html",
      nodes: [
        {
          tagName: "ul",
          children: [
            {
              textContent: "\n  ",
              l: 1,
              c: 5,
            },
            {
              tagName: "ListItem",
              attributes: [
                {
                  name: "#for:item",
                  value: "items",
                  l: 2,
                  c: 13,
                },
                {
                  name: ":name",
                  value: "item.name",
                  l: 2,
                  c: 31,
                },
                {
                  name: "#text",
                  value: "item.value",
                  l: 2,
                  c: 49,
                },
              ],
              l: 2,
              c: 4,
            },
            {
              textContent: "\n",
              l: 2,
              c: 79,
            },
          ],
          l: 1,
          c: 2,
        },
        {
          textContent: "\n",
          l: 3,
          c: 6,
        },
        {
          textContent: "\n",
          l: 4,
          c: 40,
        },
        {
          tagName: "template",
          attributes: [
            {
              name: "id",
              value: "ListItem",
              l: 5,
              c: 11,
            },
            {
              name: "#component",
              value: "",
              l: 5,
              c: 25,
            },
          ],
          children: [
            {
              textContent: "\n  ",
              l: 5,
              c: 36,
            },
            {
              tagName: "li",
              children: [
                {
                  textContent: "\n    ",
                  l: 6,
                  c: 7,
                },
                {
                  tagName: "strong",
                  attributes: [
                    {
                      name: "#text",
                      value: "`${name}:`",
                      l: 7,
                      c: 13,
                    },
                  ],
                  l: 7,
                  c: 6,
                },
                {
                  textContent: "\n    ",
                  l: 7,
                  c: 41,
                },
                {
                  tagName: "slot",
                  l: 8,
                  c: 6,
                },
                {
                  textContent: "\n  ",
                  l: 8,
                  c: 18,
                },
              ],
              l: 6,
              c: 4,
            },
            {
              textContent: "\n",
              l: 9,
              c: 8,
            },
          ],
          l: 5,
          c: 2,
        },
        {
          textContent: "\n",
          l: 10,
          c: 12,
        },
        {
          tagName: "template",
          attributes: [
            {
              name: "id",
              value: "WhackyComponent",
              l: 11,
              c: 11,
            },
            {
              name: "#component",
              value: "",
              l: 11,
              c: 32,
            },
          ],
          children: [
            {
              textContent: "\n  ",
              l: 11,
              c: 43,
            },
            {
              tagName: "div",
              children: [
                {
                  textContent: "\n    ",
                  l: 12,
                  c: 8,
                },
                {
                  tagName: "InnerComponent",
                  l: 13,
                  c: 6,
                },
                {
                  textContent: "\n    ",
                  l: 13,
                  c: 38,
                },
                {
                  tagName: "template",
                  attributes: [
                    {
                      name: "id",
                      value: "NestedComponent",
                      l: 14,
                      c: 15,
                    },
                    {
                      name: "#component",
                      value: "",
                      l: 14,
                      c: 36,
                    },
                  ],
                  children: [
                    {
                      textContent: "\n      ",
                      l: 14,
                      c: 47,
                    },
                    {
                      tagName: "slot",
                      attributes: [
                        {
                          name: "name",
                          value: "before",
                          l: 15,
                          c: 13,
                        },
                      ],
                      l: 15,
                      c: 8,
                    },
                    {
                      textContent: "\n      ",
                      l: 15,
                      c: 34,
                    },
                    {
                      tagName: "div",
                      children: [
                        {
                          textContent: "Why would you do this?!",
                          l: 16,
                          c: 12,
                        },
                      ],
                      l: 16,
                      c: 8,
                    },
                    {
                      textContent: "\n      ",
                      l: 16,
                      c: 41,
                    },
                    {
                      tagName: "slot",
                      attributes: [
                        {
                          name: "name",
                          value: "after",
                          l: 17,
                          c: 13,
                        },
                      ],
                      l: 17,
                      c: 8,
                    },
                    {
                      textContent: "\n    ",
                      l: 17,
                      c: 33,
                    },
                  ],
                  l: 14,
                  c: 6,
                },
                {
                  textContent: "\n  ",
                  l: 18,
                  c: 16,
                },
              ],
              l: 12,
              c: 4,
            },
            {
              textContent: "\n",
              l: 19,
              c: 9,
            },
          ],
          l: 11,
          c: 2,
        },
        {
          textContent: "\n",
          l: 20,
          c: 12,
        },
      ],
    });
  });

  test("should parse a component file with styles", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/componentWithStyles.tmph.html",
      import.meta
    );
    const parsedTemplateData = await parseTemplate(templateSourceFilePath);

    assert.deepStrictEqual(parsedTemplateData, {
      src: "/Users/ryangeyer/Projects/tempeh/test/fixtures/componentWithStyles.tmph.html",
      nodes: [
        {
          tagName: "main",
          children: [
            {
              textContent: "\n  ",
              l: 1,
              c: 7,
            },
            {
              tagName: "h1",
              children: [
                {
                  textContent: "Heading",
                  l: 2,
                  c: 7,
                },
              ],
              l: 2,
              c: 4,
            },
            {
              textContent: "\n  ",
              l: 2,
              c: 19,
            },
            {
              tagName: "p",
              children: [
                {
                  textContent: "Paragraph",
                  l: 3,
                  c: 6,
                },
              ],
              l: 3,
              c: 4,
            },
            {
              textContent: "\n",
              l: 3,
              c: 19,
            },
          ],
          l: 1,
          c: 2,
        },
        {
          textContent: "\n",
          l: 4,
          c: 8,
        },
        {
          tagName: "style",
          children: [
            {
              textContent:
                "\n  @scope {\n    main {\n      font-size: 1.2em;\n    }\n\n    h1,\n    p {\n      margin: 0;\n    }\n  }\n",
              l: 5,
              c: 8,
            },
          ],
          l: 5,
          c: 2,
        },
        {
          textContent: "\n",
          l: 16,
          c: 9,
        },
        {
          tagName: "style",
          attributes: [
            {
              name: "#bucket:global",
              value: "",
              l: 17,
              c: 8,
            },
          ],
          children: [
            {
              textContent: "\n  :root {\n    --color: #333;\n  }\n",
              l: 17,
              c: 23,
            },
          ],
          l: 17,
          c: 2,
        },
        {
          textContent: "\n",
          l: 21,
          c: 9,
        },
        {
          tagName: "style",
          attributes: [
            {
              name: "#raw",
              value: "",
              l: 22,
              c: 8,
            },
          ],
          children: [
            {
              textContent: "\n  main {\n    color: red;\n  }\n",
              l: 22,
              c: 13,
            },
          ],
          l: 22,
          c: 2,
        },
        {
          textContent: "\n",
          l: 26,
          c: 9,
        },
      ],
    });
  });

  test("should parse a component file with scripts", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/componentWithScripts.tmph.html",
      import.meta
    );
    const parsedTemplateData = await parseTemplate(templateSourceFilePath);

    assert.deepStrictEqual(parsedTemplateData, {
      src: "/Users/ryangeyer/Projects/tempeh/test/fixtures/componentWithScripts.tmph.html",
      nodes: [
        {
          tagName: "button",
          children: [
            {
              textContent: "Click me!",
              l: 1,
              c: 9,
            },
          ],
          l: 1,
          c: 2,
        },
        {
          textContent: "\n",
          l: 1,
          c: 27,
        },
        {
          tagName: "script",
          attributes: [
            {
              name: "#scope:component",
              value: "",
              l: 2,
              c: 9,
            },
          ],
          children: [
            {
              textContent:
                "\n  const observer = new IntersectionObserver((entries) => {\n    entries.forEach((entry) => {\n      if (entry.isIntersecting) {\n        entry.target.opacity = 1;\n      }\n    });\n  });\n",
              l: 2,
              c: 26,
            },
          ],
          l: 2,
          c: 2,
        },
        {
          textContent: "\n",
          l: 10,
          c: 10,
        },
        {
          tagName: "script",
          attributes: [
            {
              name: "#scope:instance",
              value: "",
              l: 11,
              c: 9,
            },
          ],
          children: [
            {
              textContent:
                '\n  this.addEventListener("click", () => console.log("You clicked me!"));\n\n  observer.observe(this);\n',
              l: 11,
              c: 25,
            },
          ],
          l: 11,
          c: 2,
        },
        {
          textContent: "\n",
          l: 15,
          c: 10,
        },
        {
          tagName: "script",
          children: [
            {
              textContent: '\n  console.log("This is a global script!");\n',
              l: 16,
              c: 9,
            },
          ],
          l: 16,
          c: 2,
        },
        {
          textContent: "\n",
          l: 18,
          c: 10,
        },
        {
          tagName: "script",
          attributes: [
            {
              name: "#render",
              value: "",
              l: 19,
              c: 9,
            },
            {
              name: "#",
              value: "this is a comment!",
              l: 19,
              c: 17,
            },
          ],
          children: [
            {
              textContent:
                "\n  export const num = Math.random();\n  export function render() {\n    return `<button>\\`Click me!\\`</button>`;\n  }\n",
              l: 19,
              c: 40,
            },
          ],
          l: 19,
          c: 2,
        },
        {
          textContent: "\n",
          l: 24,
          c: 10,
        },
        {
          tagName: "script",
          attributes: [
            {
              name: "src",
              value: "./index.js",
              l: 25,
              c: 9,
            },
          ],
          l: 25,
          c: 2,
        },
        {
          textContent: "\n",
          l: 25,
          c: 35,
        },
      ],
    });
  });
});
