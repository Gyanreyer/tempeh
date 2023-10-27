/**
 * Cache maps component paths to compiled code paths.
 * @type {Record<string, string>}
 */
const cache = {};

/**
 * @param {string} componentPath
 */
export function compileComponent(componentPath) {
  if (cache[componentPath]) {
    return cache[componentPath];
  }
}
