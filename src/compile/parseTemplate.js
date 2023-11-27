import { spawn } from "node:child_process";

import { deepPreventExtensions } from "../utils/deepPreventExtensions.js";
import { resolveRelativePath } from "../utils/resolveRelativePath.js";

/**
 * @typedef {Object} TmphAttribute
 * @property {string} name
 * @property {string} [value]
 */

/**
 * @typedef {Object} TmphRenderAttribute
 * @property {string} name
 * @property {string} [value]
 * @property {string} [modifier]
 */

/**
 * @typedef {Object} TmphTextNode
 * @property {string} textContent
 */

/**
 * @typedef {Object} TmphElementNode
 * @property {string} tagName
 * @property {TmphAttribute[]} [staticAttributes]
 * @property {TmphRenderAttribute[]} [renderAttributes]
 * @property {TmphNode[]} [children]
 */

/**
 * @typedef {TmphTextNode | TmphElementNode} TmphNode
 */

/**
 * @typedef {Object} ComponentImport
 * @property {string} [importName] - The name that the component is imported as, if a #as attribute was set
 * @property {string} importPath - The path to the component file
 */

/**
 * @typedef {Object} AssetBucket
 * @property {string[]} [scripts]
 * @property {string[]} [styles]
 */

/**
 * @typedef {Object} ParsedTemplateResponse
 * @property {TmphNode[]} nodes
 * @property {Record<string, AssetBucket>} assets
 * @property {boolean} hasDefaultSlot
 * @property {string[]} [namedSlots]
 * @property {ComponentImport[]} [componentImports]
 * @property {string} [propTypesJSDoc]
 * @property {Record<string, Omit<ParsedTemplateResponse, "inlineComponents">>} [inlineComponents]
 */

// const parserBinaryPath = resolveRelativePath(
//   "../../bin/parse-template",
//   import.meta
// );

// /** @type {import("node:child_process").ChildProcessWithoutNullStreams | null} */
// let parserProcess = null;

/**
 * Takes the path to a .tmph.html file and parses it into a JSON object
 * that can be used by the compiler.
 * @param {string} filePath
 */
export async function parseTemplate(filePath) {
  // if (!parserProcess) {
  //   parserProcess = spawn(parserBinaryPath);
  // }

  const requestURL = new URL("http://localhost:8674/parse");
  requestURL.searchParams.set("path", filePath);

  // Prevent extension on all items in the node tree. This means that items can be deleted
  // or modified, but never added. This should hopefully reduce memory usage.
  return deepPreventExtensions(
    /** @type {Promise<ParsedTemplateResponse>} */ (
      await fetch(requestURL).then((res) => res.json())
    )
  );
}
