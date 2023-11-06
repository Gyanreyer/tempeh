// Regex matches double quotes that are not escaped with a \
const unescapedQuoteRegex = /(^")|([^\\]")/g;

/** @param {string} attributeValue */
const escapeAttribute = (attributeValue) => {
  return attributeValue.replace(unescapedQuoteRegex, '\\"');
};

/** @typedef {string|boolean|null|undefined} AttributeValue */

/**
 *
 * @param {string} attributeName
 * @param {AttributeValue|(()=>(AttributeValue | Promise<AttributeValue>))} attributeValueOrGetter
 */
export default async function renderAttributeToString(
  attributeName,
  attributeValueOrGetter
) {
  if (!attributeName) {
    return "";
  }

  let attributeValue =
    typeof attributeValueOrGetter === "function"
      ? attributeValueOrGetter()
      : attributeValueOrGetter;

  if (attributeValue instanceof Promise) {
    attributeValue = await attributeValue;
  }

  if (
    typeof attributeValue === "string" ||
    typeof attributeValue === "number"
  ) {
    return ` ${attributeName}="${escapeAttribute(String(attributeValue))}"`;
  } else if (Boolean(attributeValue)) {
    return ` ${attributeName}`;
  }

  return "";
}
