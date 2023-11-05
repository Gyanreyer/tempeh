import { escapeText } from "./escapeText.js";

/**
 *
 * @param {string} attributeName
 * @param {string|boolean|null|undefined} attributeValue
 * @returns {string}
 */
export function renderAttributeToString(attributeName, attributeValue) {
  if (attributeName) {
    if (
      typeof attributeValue === "string" ||
      typeof attributeValue === "number"
    ) {
      return ` ${attributeName}="${escapeText(String(attributeValue))}"`;
    } else if (Boolean(attributeValue)) {
      return ` ${attributeName}`;
    }
  }

  return "";
}
