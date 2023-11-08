/**
 * Looks up the value of a node's attribute by name.
 *
 * @param {import("./parseXML").TmphNode} node
 * @param {string} attributeName
 */
export function getNodeAttributeValue(node, attributeName) {
  if (node.Attributes) {
    for (const [name, value] of node.Attributes) {
      if (name === attributeName) {
        return value;
      }
    }
  }

  return null;
}
