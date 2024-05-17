import { startTemplateParserServer } from "./templateParserServer.js";

/**
 * @typedef TmphElementAttribute
 * @property {number} l - Line number
 * @property {number} c - Column number
 * @property {string} name
 * @property {string} value
 */

/**
 * @typedef TmphElementNode
 * @property {number} l - Line number
 * @property {number} c - Column number
 * @property {string} tagName
 * @property {TmphElementAttribute[]} [attributes]
 * @property {TmphNode[]} childNodes
 */

/**
 * @typedef TmphTextNode
 * @property {number} l - Line number
 * @property {number} c - Column number
 * @property {string} textContent
 */

/**
 * @typedef {TmphElementNode| TmphTextNode} TmphNode
 */

/**
 * @typedef TemplateDataAST
 * @property {string} src - Path to the parsed template file
 * @property {TmphNode[]} nodes - The root nodes of the template
 */

/**
 * Takes the path to a .tmph.html file and parses it into a JSON object
 * that can be used by the compiler.
 * @param {string} filePath
 * @returns {Promise<TemplateDataAST>}
 */
export async function parseTemplate(filePath) {
  const parserServerOrigin = await startTemplateParserServer();

  if (!parserServerOrigin) {
    throw new Error("Template parser server not running");
  }

  const requestURL = new URL("/parse", parserServerOrigin);
  requestURL.searchParams.set("path", filePath);

  return fetch(requestURL).then(async (res) => {
    if (!res.ok) {
      return res.text().then((responseText) => {
        throw new Error(
          `Failed to parse template "${filePath}": ${responseText}`
        );
      });
    }

    return res.json().then((nodes) => ({
      src: filePath,
      nodes,
    }));
  });
}
