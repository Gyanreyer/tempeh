import { execSync } from "node:child_process";
import path from "node:path";

/**
 * @typedef {Object} TmphNode
 * @property {string|null} TagName
 * @property {Array<TmphNode | string>|null} Children
 * @property {Array<[string, string|true]>|null} Attributes
 */

const parserBinaryPath = path.resolve(
  import.meta.url.replace("file://", ""),
  "../../xml-parser/xml-parser"
);

/**
 *
 * @param {string} path
 */
export function parseXML(path) {
  const result = execSync(`${parserBinaryPath} --file="${path}"`);

  /**
   * @type {Array<TmphNode|string>}
   */
  const rootNodes = JSON.parse(result.toString());

  console.log(rootNodes);

  return rootNodes;
}
