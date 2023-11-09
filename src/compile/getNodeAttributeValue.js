/**
 * Looks up the value of a node's attribute by name.
 *
 * @param {import("./parseXML").TmphNode} node
 * @param {string} attributeName
 */
export function getNodeAttributeValue(node, attributeName) {
  if (node.attributes) {
    for (const [name, value] of node.attributes) {
      if (name === attributeName) {
        return value;
      }
    }
  }

  return null;
}
