import { parse } from "marked";
import { html } from "./html.js";

/**
 * Takes a markdown string and converts it into a minified HTML string.
 *
 * @param {TemplateStringsArray} strings
 * @param  {...any} exps
 */
export const md = (strings, ...exps) =>
  html(strings, ...exps)
    .text()
    .then((htmlString) => parse(htmlString, { async: true }));
