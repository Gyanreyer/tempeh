import escapeText from "./escapeText.js";

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
    return ` ${attributeName}="${escapeText(String(attributeValue))}"`;
  } else if (Boolean(attributeValue)) {
    return ` ${attributeName}`;
  }

  return "";
}
