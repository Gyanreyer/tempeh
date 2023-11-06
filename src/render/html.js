import minifyHTML from "@minify-html/node";

const minifyHTMLOptions = {
  do_not_minify_doctype: true,
  keep_spaces_between_attributes: true,
  ensure_spec_compliant_unquoted_attribute_values: true,
  keep_html_and_head_opening_tags: true,
  keep_closing_tags: true,
};

/**
 * Template literal string tag which performs basic HTML minification on the string.
 *
 * @param {unknown} htmlString
 */
export default function html(htmlString) {
  if (typeof htmlString !== "string") {
    return "";
  }

  const minifiedHTML = minifyHTML.minify(
    Buffer.from(htmlString),
    minifyHTMLOptions
  );

  return minifiedHTML.toString("utf8");
}
