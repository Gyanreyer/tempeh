import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import readline from "node:readline/promises";

import { parseXML } from "./parseXML.js";
import { gatherComponentMeta } from "./gatherComponentMeta.js";
import { makeComponentJSdoc } from "./makeComponentJSdoc.js";
import { convertNodeToRenderString } from "./convertNodeToRenderString.js";
import { deepPreventExtensions } from "../utils/deepPreventExtensions.js";
import { stringifyObjectForRender } from "./stringifyObjectForRender.js";

/** @typedef {import("./parseXML.js").TmphNode} TmphNode */
/** @typedef {import("./gatherComponentMeta.js").Meta} Meta */

// Regex to match whether the render string references a props variable
const propsVariableRegex = /\bprops\b/;

/**
 * @param {string} componentPath
 * @param {boolean} [skipCache=false]
 */
export async function compileComponent(componentPath, skipCache = false) {
  const componentDirectory = path.dirname(componentPath);
  const outputPath = path.resolve(
    componentDirectory,
    `./${path.basename(componentPath, ".html")}.js`
  );

  // Create a hash of the source component file contents which we will embed in
  // the compiled component file. This will allow us to check if the source component
  // file has changed and needs to be re-compiled
  const componentFileBuffer = await readFile(componentPath);
  const integrityHash = createHash("sha256")
    .update(componentFileBuffer)
    .digest("hex");

  const integrityComment = `// __tmph_integrity=${integrityHash}`;

  if (!skipCache) {
    try {
      // Read the first line of the existing compiled component file (if one exists)
      // and check if it matches the source file's integrity hash. If it does, we can skip re-compiling
      const inputStream = createReadStream(outputPath);
      try {
        for await (const line of readline.createInterface(inputStream)) {
          if (line.startsWith(integrityComment)) {
            return outputPath;
          }
          break;
        }
      } finally {
        inputStream.close();
      }
    } catch {}
  }

  const rootNodes = await parseXML(componentFileBuffer);
  const meta = deepPreventExtensions(gatherComponentMeta(rootNodes));

  /** @type {Record<string, string>} */
  const imports = {};

  if (meta.componentImports) {
    const resolveComponentImportPromises = [];

    for (const componentName in meta.componentImports) {
      const filePath = path.resolve(
        componentDirectory,
        meta.componentImports[componentName]
      );

      resolveComponentImportPromises.push(
        compileComponent(filePath).then((path) => {
          imports[`* as ${componentName}`] = path;
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
  meta.usesProps = propsVariableRegex.test(renderString);

  const { jsDocString, defaultProps } = makeComponentJSdoc(meta);

  if (defaultProps) {
    imports.defaultProps = "#tmph/render/defaultProps.js";
  }

  let importsString = "";
  for (const importMethod in imports) {
    importsString += `import ${importMethod} from "${imports[importMethod]}";\n`;
  }

  await writeFile(
    outputPath,
    `${integrityComment}
${importsString}
${inlineComponentsString}
${jsDocString}
export async function render(params) {${
      meta.hasDefaultSlot ? 'const slot = params?.slot ?? "";\n' : ""
    }${
      meta.hasDefaultSlot
        ? "const namedSlots = params?.namedSlots ?? {};\n"
        : ""
    }${
      defaultProps
        ? `const props = defaultProps(params?.props, ${(() => {
            let defaultPropsObjectString = "{";
            for (const key in defaultProps) {
              if (typeof defaultProps[key] === "object") {
                defaultPropsObjectString += `"${key}": ${stringifyObjectForRender(
                  defaultProps[key]
                )},`;
                continue;
              }
              const value = defaultProps[key];
              defaultPropsObjectString += `"${key}": ${value},`;
            }
            defaultPropsObjectString += "}";

            return defaultPropsObjectString;
          })()});\n`
        : "const props = params?.props ?? {};\n"
    }
  return \`${renderString}\`;
}`
  );

  return outputPath;
}
