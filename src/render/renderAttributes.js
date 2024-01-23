// Regex matches double quotes that are not escaped with a \
const unescapedQuoteRegex = /(^")|([^\\]")/g;

/** @param {string} attributeValue */
const escapeAttribute = (attributeValue) => {
  return attributeValue.replace(unescapedQuoteRegex, '\\"');
};

/** @typedef {string|boolean|null|undefined} AttributeValue */

/**
 * Takes an attribute name and value and returns a string representing how that
 * attribute should be rendered in HTML
 *
 * @param {string} attributeName
 * @param {AttributeValue} attributeValue
 */
export default function renderHTMLAttribute(attributeName, attributeValue) {
  if (!attributeName) {
    return "";
  }

  const valueType = typeof attributeValue;

  if (
    (valueType === "string" && attributeValue !== "") ||
    valueType === "number"
  ) {
    return ` ${attributeName}="${escapeAttribute(String(attributeValue))}"`;
  } else if (Boolean(attributeValue) || attributeValue === "") {
    return ` ${attributeName}`;
  }

  return "";
}
