import { escapeText } from "./escapeText.js";

/**
 *
 * @param {string} attributeName
 * @param {string|boolean|null|undefined} attributeValue
 * @returns {string}
 */
export function renderAttributeToString(attributeName, attributeValue) {
  if (attributeName) {
    if (typeof attributeValue === "string") {
      return ` ${attributeName}="${escapeText(attributeValue)}"`;
    } else if (attributeValue === true) {
      return ` ${attributeName}`;
    } else if (attributeValue !== false) {
      console.error(
        `Invalid attribute value ${JSON.stringify(
          attributeValue
        )} provided for attribute ${attributeName}`
      );
    }
  }

  return "";
}

/**
 * @param {Record<string, string | boolean | null | undefined>} attributesObject
 */
export function renderAttributes(attributesObject) {
  let attributeString = "";

  for (const [key, value] of Object.entries(attributesObject)) {
    if (value === null || value === undefined || value === false) {
      // Strip attributes with null, undefined, and false values
      continue;
    }

    if (value === true) {
      // Boolean attributes don't need a value
      attributeString += ` ${key}`;
    } else {
      attributeString += ` ${key}="${escapeText(value)}"`;
    }
  }

  return attributeString;
}
