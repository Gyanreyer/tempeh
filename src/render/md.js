import { parse } from "marked";
import { html } from "./html.js";

/**
 * Takes a markdown string and converts it into a minified HTML string.
 *
 * @param {string} markdownString
 * @returns {Promise<string>}
 */
export async function md(markdownString) {
  return html(await parse(markdownString));
}
