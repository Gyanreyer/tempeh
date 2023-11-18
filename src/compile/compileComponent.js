import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import readline from "node:readline/promises";

import { parseXML } from "./parseXML.js";
import {
  gatherComponentMeta,
  cachedMetaCommentStart,
  makeCachedMetaComment,
} from "./gatherComponentMeta.js";
import { makeComponentJSdoc } from "./makeComponentJSdoc.js";
import { convertNodeToRenderString } from "./convertNodeToRenderString.js";
import { stringifyObjectForRender } from "./stringifyObjectForRender.js";
import { extractComponentName } from "./extractComponentName.js";
import processCSS from "./processCSS.js";

/** @typedef {import("./parseXML.js").TmphNode} TmphNode */
/**
 * @typedef {import("./gatherComponentMeta.js").Meta} Meta
 * @typedef {import("./gatherComponentMeta.js").ComponentAssets} ComponentAssets
 */

// Regex to match whether the render string references a props variable
const propsVariableRegex = /\bprops\b/;

const integrityCommentStart = "// __tmph_integrity=";
// If we have a __tmph_integrity=SKIP comment at the top of the file, that means we should skip compilation and use the
// existing compiled component file, even if it is out of date compared to the source file.
const skipIntegrityComment = `${integrityCommentStart}SKIP`;

/**
 * @param {string} componentPath
 * @param {boolean} [skipCache=false]
 * @returns {Promise<{ outputPath: string; meta: Meta; }>}
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

  const integrityComment = `${integrityCommentStart}${integrityHash}`;

  if (!skipCache) {
    try {
      // Read the first line of the existing compiled component file (if one exists)
      // and check if it matches the source file's integrity hash. If it does, we can skip re-compiling
      const inputStream = createReadStream(outputPath);
      const readlineInterface = readline.createInterface(inputStream);
      try {
        const firstLine = await readlineInterface[
          Symbol.asyncIterator
        ]().next();
        const firstLineString = firstLine.value;
        if (
          !firstLine.done &&
          (firstLineString.startsWith(integrityComment) ||
            firstLineString.startsWith(skipIntegrityComment))
        ) {
          const secondLine = await readlineInterface[
            Symbol.asyncIterator
          ]().next();
          if (
            !secondLine.done &&
            secondLine.value.startsWith(cachedMetaCommentStart)
          ) {
            try {
              const meta = JSON.parse(
                secondLine.value.slice(cachedMetaCommentStart.length)
              );
              return { outputPath, meta };
            } catch {
              console.warn(
                `Failed to parse metadata from ${outputPath}. Re-compiling...`
              );
            }
          }
        }
      } finally {
        inputStream.close();
      }
    } catch {}
  }

  const componentName = extractComponentName(componentPath);
  const scopedComponentID = `${componentName.slice(0, 8)}${integrityHash.slice(
    0,
    4
  )}`;

  const rootNodes = await parseXML(componentFileBuffer);

  for (const node of rootNodes) {
    if (typeof node !== "string") {
      node.attributes ??= [];
      node.attributes.push("data-scid", scopedComponentID);
    }
  }

  /** @type {Meta} */
  const meta = Object.preventExtensions({
    sourceFilePath: componentPath,
    usesProps: false,
    isAsync: false,
    hasDefaultSlot: false,
    namedSlots: null,
  });
  /** @type {ComponentAssets} */
  const componentAssets = Object.preventExtensions({
    componentImports: null,
    inlineComponents: null,
    propTypesJsDoc: null,
    assetBuckets: null,
    inlineStylesheets: null,
    inlineScripts: null,
  });

  gatherComponentMeta(rootNodes, meta, componentAssets);

  /** @type {Record<string, string>} */
  const imports = {};

  const componentImports = componentAssets.componentImports;
  if (componentImports) {
    const resolveComponentImportPromises = [];

    for (const componentName in componentImports) {
      const filePath = path.resolve(
        componentDirectory,
        componentImports[componentName].importPath
      );

      resolveComponentImportPromises.push(
        compileComponent(filePath, skipCache).then(
          ({ outputPath, meta: componentMeta }) => {
            imports[`* as ${componentName}`] = outputPath;
            componentImports[componentName].meta = componentMeta;
          }
        )
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

  const inlineComponents = componentAssets.inlineComponents;
  if (inlineComponents) {
    for (const componentName in inlineComponents) {
      const inlineComponentMeta = {
        ...meta,
        ...inlineComponents[componentName].meta,
      };

      const componentNodeRenderPromises = [];

      const componentNodes = inlineComponents[componentName].nodes;
      const componentNodeCount = componentNodes.length;
      const componentNodeRenderStrings = new Array(componentNodeCount);

      for (let i = 0; i < componentNodeCount; ++i) {
        const node = componentNodes[i];
        if (typeof node === "string") {
          componentNodeRenderStrings[i] = node;
          continue;
        } else {
          componentNodeRenderPromises.push(
            convertNodeToRenderString(node, imports, inlineComponentMeta).then(
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

  let inlineStyles = null;
  if (componentAssets.inlineStylesheets) {
    inlineStyles = processCSS(
      componentAssets.inlineStylesheets.join("\n"),
      scopedComponentID
    );
  }

  await writeFile(
    outputPath,
    `${integrityComment}
${makeCachedMetaComment(meta)}
${importsString}
${
  componentAssets.assetBuckets
    ? `export const assets = ${JSON.stringify(componentAssets.assetBuckets)};`
    : ""
}
${inlineComponentsString}
${jsDocString}
export ${meta.isAsync ? " async " : " "}function render(params) {${
      meta.hasDefaultSlot ? 'const slot = params?.slot ?? "";\n' : ""
    }${
      meta.namedSlots ? "const namedSlots = params?.namedSlots ?? {};\n" : ""
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
  return \`${renderString}${
      inlineStyles ? `<style>${inlineStyles}</style>` : ""
    }\`;
}`
  );

  return {
    outputPath,
    meta,
  };
}
