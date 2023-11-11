const filePrefixLength = "file://".length;

/**
 * @param {string} path
 * @param {ImportMeta} importMeta
 */
export function resolveRelativePath(path, importMeta) {
  return importMeta.resolve(path).slice(filePrefixLength);
}
