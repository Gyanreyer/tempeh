import { deepFreeze } from "../utils/deepFreeze.js";
import { startTemplateParserServer } from "./templateParserServer.js";

/**
 * Takes the path to a .tmph.html file and parses it into a JSON object
 * that can be used by the compiler.
 * @param {string} filePath
 */
export async function parseTemplate(filePath) {
  const parserServerOrigin = await startTemplateParserServer();

  if (!parserServerOrigin) {
    throw new Error("Template parser server not running");
  }

  const requestURL = new URL("/parse", parserServerOrigin);
  requestURL.searchParams.set("path", filePath);

  // Freeze all content in the parsed template AST.
  return deepFreeze(
    /** @type {Promise<import("./types.js").TmphTemplateData>} */ (
      await fetch(requestURL).then((res) => res.json())
    )
  );
}
