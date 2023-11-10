import { writeFileSync } from "node:fs";
import path from "node:path";

import { parseXML } from "./parseXML.js";
import { gatherComponentMeta } from "./gatherComponentMeta.js";
import { makeComponentJSdoc } from "./makeComponentJSdoc.js";
import { convertNodeToRenderString } from "./convertNodeToRenderString.js";
import { deepPreventExtensions } from "../utils/deepPreventExtensions.js";

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
  const meta = deepPreventExtensions(gatherComponentMeta(rootNodes, {}));

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

  const rootNodeCount = rootNodes.length;
  const rootNodeRenderStrings = new Array(rootNodeCount);

  for (let i = 0; i < rootNodeCount; ++i) {
    const node = rootNodes[i];
    if (typeof node === "string") {
      rootNodeRenderStrings[i] = node;
      continue;
    } else {
      renderPromises.push(
        convertNodeToRenderString(node, imports, meta).then(
          (renderString) => (rootNodeRenderStrings[i] = renderString)
        )
      );
    }
  }

  let inlineComponentsString = "";

  if (meta.inlineComponents) {
    for (const componentName in meta.inlineComponents) {
      const componentNodeRenderPromises = [];

      const componentNodes = meta.inlineComponents[componentName];
      const componentNodeCount = componentNodes.length;
      const componentNodeRenderStrings = new Array(componentNodeCount);

      for (let i = 0; i < componentNodeCount; ++i) {
        const node = componentNodes[i];
        if (typeof node === "string") {
          componentNodeRenderStrings[i] = node;
          continue;
        } else {
          componentNodeRenderPromises.push(
            convertNodeToRenderString(node, imports, meta).then(
              (renderString) => (componentNodeRenderStrings[i] = renderString)
            )
          );
        }
      }

      renderPromises.push(
        Promise.all(componentNodeRenderPromises).then(() => {
          inlineComponentsString += `const ${componentName} = { render: async ({ props, slot, namedSlots }) => {
    return \`${componentNodeRenderStrings.join("\n")}\`;
  }
};\n`;
        })
      );
    }
  }

  // Wait for all renders to resolve
  await Promise.all(renderPromises);
  // Now that all nodes are done rendering, we can combine the root node
  // render strings into a single string
  const renderString = rootNodeRenderStrings.join("\n");

  let importsString = "";
  for (const importMethod in imports) {
    importsString += `import ${importMethod} from "${imports[importMethod]}";\n`;
  }

  const outputPath = path.resolve(
    componentDirectory,
    `./${path.basename(componentPath, ".html")}.js`
  );

  writeFileSync(
    outputPath,
    `${importsString}
${inlineComponentsString}
${makeComponentJSdoc(meta.jsDoc ?? "")}
export async function render({ props, slot, namedSlots }) {
  return \`${renderString}\`;
}`
  );

  return outputPath;
}
