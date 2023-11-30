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
    const parsedTemplateData = await parseTemplate(
      resolveRelativePath(
        "../../test/fixtures/simpleComponent.tmph.html",
        import.meta
      )
    );

    assert.deepStrictEqual(parsedTemplateData, {
      mainComponent: {
        hasDefaultSlot: false,
        rootNode: {
          position: "1:1",
          children: [
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
                  position: "3:75",
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
        },
      },
    });
  });

  test("should parse a component file with inline sub-components", async () => {
    const parsedTemplateData = await parseTemplate(
      resolveRelativePath(
        "../../test/fixtures/inlineSubComponents.tmph.html",
        import.meta
      )
    );

    assert.deepStrictEqual(parsedTemplateData, {
      mainComponent: {
        hasDefaultSlot: false,
        rootNode: {
          position: "1:1",
          children: [
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
        },
      },
      inlineComponents: {
        ListItem: {
          hasDefaultSlot: true,
          rootNode: {
            tagName: "template",
            position: "4:1",
            children: [
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
            renderAttributes: [
              {
                name: "component",
                value: "ListItem",
                position: "4:12",
              },
            ],
          },
        },
        WhackyComponent: {
          hasDefaultSlot: false,
          rootNode: {
            tagName: "template",
            position: "10:1",
            children: [
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
            renderAttributes: [
              {
                name: "component",
                value: "WhackyComponent",
                position: "10:12",
              },
            ],
          },
        },
        NestedComponent: {
          hasDefaultSlot: false,
          rootNode: {
            tagName: "template",
            position: "13:5",
            children: [
              {
                tagName: "slot",
                position: "14:7",
                staticAttributes: [
                  {
                    name: "name",
                    value: "before",
                    position: "14:13",
                  },
                ],
              },
              {
                textContent: " ",
                position: "15:1",
              },
              {
                tagName: "div",
                position: "15:7",
                children: [
                  {
                    textContent: "Why would you do this?!",
                    position: "15:12",
                  },
                ],
              },
              {
                textContent: " ",
                position: "16:1",
              },
              {
                tagName: "slot",
                position: "16:7",
                staticAttributes: [
                  {
                    name: "name",
                    value: "after",
                    position: "16:13",
                  },
                ],
              },
            ],
            renderAttributes: [
              {
                name: "component",
                value: "NestedComponent",
                position: "13:16",
              },
            ],
          },
          namedSlots: {
            before: true,
            after: true,
          },
        },
      },
    });
  });

  test("should parse a component file with styles", async () => {
    const parsedTemplateData = await parseTemplate(
      resolveRelativePath(
        "../../test/fixtures/componentWithStyles.tmph.html",
        import.meta
      )
    );

    assert.deepStrictEqual(parsedTemplateData, {
      mainComponent: {
        hasDefaultSlot: false,
        rootNode: {
          position: "1:1",
          children: [
            {
              tagName: "main",
              position: "1:1",
              children: [
                {
                  tagName: "h1",
                  position: "2:3",
                  children: [
                    {
                      textContent: "Heading",
                      position: "2:7",
                    },
                  ],
                },
                {
                  textContent: " ",
                  position: "3:1",
                },
                {
                  tagName: "p",
                  position: "3:3",
                  children: [
                    {
                      textContent: "Paragraph",
                      position: "3:6",
                    },
                  ],
                },
              ],
            },
            {
              tagName: "style",
              position: "22:1",
              renderAttributes: [
                {
                  name: "raw",
                  position: "22:9",
                },
              ],
              children: [
                {
                  textContent: `main {
    color: red;
  }`,
                  position: "22:13",
                },
              ],
            },
          ],
        },
      },
      assets: {
        default: {
          styles: [
            {
              position: "5:8",
              content: `@scope {
    main {
      font-size: 1.2em;
    }

    h1,
    p {
      margin: 0;
    }
  }`,
            },
          ],
        },
        global: {
          styles: [
            {
              position: "17:25",
              content: `:root {
    --color: #333;
  }`,
            },
          ],
        },
      },
    });
  });

  test("should parse a component file with scripts", async () => {
    const parsedTemplateData = await parseTemplate(
      resolveRelativePath(
        "../../test/fixtures/componentWithScripts.tmph.html",
        import.meta
      )
    );

    assert.deepStrictEqual(parsedTemplateData, {
      mainComponent: {
        hasDefaultSlot: false,
        rootNode: {
          position: "1:1",
          children: [
            {
              tagName: "button",
              position: "1:1",
              children: [
                {
                  textContent: "Click me!",
                  position: "1:9",
                },
              ],
            },
            {
              tagName: "script",
              position: "19:1",
              renderAttributes: [
                {
                  name: "render",
                  position: "19:10",
                },
              ],
              children: [
                {
                  textContent:
                    "export const num = Math.random();\n  export function render() {\n    return `<button>Click me!</button>`;\n  }",
                  position: "19:17",
                },
              ],
            },
          ],
        },
      },
      assets: {
        default: {
          scripts: [
            {
              content:
                "const observer = new IntersectionObserver((entries) => {\n    entries.forEach((entry) => {\n      if (entry.isIntersecting) {\n        entry.target.opacity = 1;\n      }\n    });\n  });",
              scope: "component",
              position: "2:26",
            },
            {
              content:
                'this.addEventListener("click", () => console.log("You clicked me!"));\n\n  observer.observe(this);',
              scope: "instance",
              position: "11:25",
            },
            {
              content: 'console.log("This is a global script!");',
              scope: "global",
              position: "16:9",
            },
            {
              path: "./index.js",
              scope: "global",
              position: "25:1",
            },
          ],
        },
      },
    });
  });
});
