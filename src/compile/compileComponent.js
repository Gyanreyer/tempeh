import { writeFileSync } from "node:fs";
import path from "node:path";

import { parseXML } from "./parseXML.js";
import { gatherComponentMeta } from "./gatherComponentMeta.js";
import { makeComponentJSdoc } from "./makeComponentJSdoc.js";
import { convertNodeToRenderString } from "./convertNodeToRenderString.js";

/** @typedef {import("./parseXML.js").TmphNode} TmphNode */
/** @typedef {import("./gatherComponentMeta.js").Meta} Meta */

/**
 * Cache maps component paths to compiled code paths.
 * @type {Record<string, string>}
 */
const cache = {};

/**
 * @param {string} componentPath
 */
export async function compileComponent(componentPath) {
  if (cache[componentPath]) {
    return cache[componentPath];
  }

  const rootNodes = await parseXML(componentPath);
  /** @type {Meta} */
  const meta = gatherComponentMeta(rootNodes, {});

  /** @type {Record<string, string>} */
  const imports = {};

  const componentDirectory = path.dirname(componentPath);

  if (meta.componentImports) {
    const resolveComponentImportPromises = [];

    for (const componentName in meta.componentImports) {
      const filePath = path.resolve(
        componentDirectory,
        meta.componentImports[componentName]
      );

      resolveComponentImportPromises.push(
        compileComponent(filePath).then((outputPath) => {
          imports[`* as ${componentName}`] = outputPath;
        })
      );
    }

    await Promise.all(resolveComponentImportPromises);
  }

  const renderPromises = [];

  for (const node of rootNodes) {
    renderPromises.push(convertNodeToRenderString(node, imports, meta));
  }

  const renderString = (await Promise.all(renderPromises)).join("\n");

  let inlineComponentsString = "";

  if (meta.inlineComponents) {
    for (const componentName in meta.inlineComponents) {
      const subComponentRenderPromises = [];

      for (const element of meta.inlineComponents[componentName]) {
        if (typeof element === "string") {
          subComponentRenderPromises.push(element);
        } else {
          subComponentRenderPromises.push(
            convertNodeToRenderString(element, imports, meta)
          );
        }
      }

      inlineComponentsString += `
        const ${componentName} = { render: async ({ props, slot, namedSlots }) => {
          return \`${(await Promise.all(subComponentRenderPromises)).join(
            "\n"
          )}\`;
        }};
      `;
    }
  }

  let importsString = "";
  for (const importMethod in imports) {
    importsString += `import ${importMethod} from "${imports[importMethod]}";`;
  }

  const outputPath = path.resolve(
    componentDirectory,
    `./${path.basename(componentPath, ".html")}.js`
  );

  writeFileSync(
    outputPath,
    `
    ${importsString}
    ${inlineComponentsString}
    ${makeComponentJSdoc(meta.jsDoc ?? "")}
    export async function render({ props, slot, namedSlots }) {
      return \`${renderString}\`;
    }`
  );

  return outputPath;
}
