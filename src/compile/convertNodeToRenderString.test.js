import { test, describe, after } from "node:test";
import * as assert from "node:assert";

import { parseTemplate } from "./parseTemplate.js";
import { convertNodeToRenderString } from "./convertNodeToRenderString.js";
import { stopTemplateParserServer } from "./templateParserServer.js";
import { resolveRelativePath } from "../utils/resolveRelativePath.js";

describe("convertNodeToRenderString", () => {
  after(() => {
    stopTemplateParserServer();
  });

  test("handles a simple component template as expected", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/simpleComponent.tmph.html",
      import.meta
    );

    const parsedTemplateData = await parseTemplate(templateSourceFilePath);

    const componentRenderStrings = parsedTemplateData.nodes.map((node) =>
      convertNodeToRenderString(
        node,
        {},
        {
          sourceFilePath: parsedTemplateData.src,
        }
      )
    );

    assert.deepStrictEqual(componentRenderStrings, [
      "<div>Hello, world!</div>",
      `Some root-level text
`,
      `<button role="button" aria-disabled disabled aria-label="My custom label">Click me
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden><circle cx="50" cy="50" r="50"></circle></svg></button>`,
      `<p>Spaces should be <em>preserved</em> <strong>but
flattened</strong></p>`,
    ]);
  });

  test("handles a component with slots", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/componentWithSlots.tmph.html",
      import.meta
    );

    const parsedTemplateData = await parseTemplate(templateSourceFilePath);

    const componentRenderStrings = parsedTemplateData.nodes.map((node) =>
      convertNodeToRenderString(
        node,
        {},
        {
          sourceFilePath: parsedTemplateData.src,
        }
      )
    );

    assert.deepStrictEqual(componentRenderStrings, [
      "<div>${slot ?? html`Default slot content`} ${namedSlots?.after ?? html`Named slot content`}</div>",
    ]);
  });

  test("handles a template with dynamically rendered content", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/dynamicContentComponent.tmph.html",
      import.meta
    );

    const parsedTemplateData = await parseTemplate(templateSourceFilePath);

    const componentRenderStrings = parsedTemplateData.nodes.map((node) =>
      convertNodeToRenderString(
        node,
        {},
        {
          sourceFilePath: parsedTemplateData.src,
        }
      )
    );

    assert.deepStrictEqual(componentRenderStrings, [
      `<ul>\${(function* () {
  const __TMPH__for0__count = (6);
  for (let i = 0; i < __TMPH__for0__count; ++i) {
    yield (() => {
  if(!(i % 2 === 0)) {
      return null;
  }
  return html\`<li\${(() => {
  return renderHTMLAttribute("style", (\`--i: \${i}\`));
})()}>\${(() => {
  return escapeText(\`Item \${i}\`);
})()}</li>\`;
})();
  }
})()}</ul>`,
    ]);
  });

  test("handles a template with markdown content", async () => {
    const templateSourceFilePath = resolveRelativePath(
      "../../test/fixtures/markdownComponent.tmph.html",
      import.meta
    );

    const parsedTemplateData = await parseTemplate(templateSourceFilePath);

    const componentRenderStrings = parsedTemplateData.nodes.map((node) =>
      convertNodeToRenderString(
        node,
        {},
        {
          sourceFilePath: parsedTemplateData.src,
        }
      )
    );

    assert.deepStrictEqual(componentRenderStrings, [
      `<article>\${md\`
  # Title

  ## Subheading

  This is a paragraph.

  - list item 1
    - sub-bullet
  \`}</article>`,
    ]);
  });
});
