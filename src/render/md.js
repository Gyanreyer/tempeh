import { parse } from "marked";
import { html } from "./html.js";

/**
 * Takes a markdown string and converts it into a minified HTML string.
 *
 * @param {string} markdownString
 * @returns {string}
 */
export function md(markdownString) {
  return html(
    parse(markdownString, {
      async: false,
    })
  );
}
