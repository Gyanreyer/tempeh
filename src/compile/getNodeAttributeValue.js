/** @typedef {import("./parseXML").TmphNode} TmphNode */

/**
 * Looks up the value of a node's attribute by name.
 *
 * @param {TmphNode} node
 * @param {string} attributeName
 */
export function getNodeAttributeValue(node, attributeName) {
  if (node.attributes) {
    // Attributes are packed into a 1D array where every even index is an attribute name and
    // every odd index is an attribute value.
    for (
      let i = 0, attributeLength = node.attributes.length;
      i < attributeLength;
      i += 2
    ) {
      const name = node.attributes[i];
      const value = node.attributes[i + 1];
      if (name === attributeName) {
        return value;
      }
    }
  }

  return null;
}

/**
 *
 * @param {TmphNode} node
 * @param {string} attributeName
 */
export function removeNodeAttribute(node, attributeName) {
  if (node.attributes) {
    // Attributes are packed into a 1D array where every even index is an attribute name and
    // every odd index is an attribute value.
    for (
      let i = 0, attributeLength = node.attributes.length;
      i < attributeLength;
      i += 2
    ) {
      const name = node.attributes[i];
      if (name === attributeName) {
        node.attributes.splice(i, 2);
        break;
      }
    }
  }
}
