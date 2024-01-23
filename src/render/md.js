import { parse } from "marked";
import { TmphHTML } from "./html.js";

/**
 * Takes a markdown string and converts it into a minified HTML string.
 *
 * @param {TmphHTML} markdownHTML
 */
export default async function md(markdownHTML) {
  return parse(await markdownHTML.text(), { async: true });
}
