const whiteSpaceGroupRegex = /\s+/g;
const spaceBetweenTagsRegex = / *[<>] */g;
const selfClosingTagEndRegex = / *\/ *>/g;

/**
 * @param {string} match
 */
const trimWhitespace = (match) => match.trim();

/**
 * Template literal string tag which performs basic HTML minification on the string.
 *
 * @param {TemplateStringsArray} strings
 * @param {...*} values
 */
export function html(strings, ...values) {
  const rawString = String.raw({ raw: strings }, ...values);

  return rawString
    .replace(
      // Flatten all whitespace groups into a single space
      whiteSpaceGroupRegex,
      " "
    )
    .replace(
      // Any leading or trailing spaces on tag delimiters can be removed entirely
      spaceBetweenTagsRegex,
      trimWhitespace
    )
    .replace(
      // Slashes for self-closing tags aren't necessary in HTML, so remove the
      // slash character
      selfClosingTagEndRegex,
      ">"
    );
}
