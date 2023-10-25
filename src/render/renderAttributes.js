import { escapeText } from "./escapeText.js";

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
