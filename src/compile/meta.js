/**
 * @typedef {Object} Meta
 * @property {string} sourceFilePath
 * @property {boolean} usesProps
 * @property {boolean} isAsync
 */

export const cachedMetaCommentStart = "// __tmph_meta=";

/**
 * Takes a full Meta object and converts it into a pared-down CachedMeta object in
 * the form of a comment string which will be placed on the second line of every compiled component file.
 *
 * @param {Meta} meta
 */
export function makeCachedMetaComment(meta) {
  return `${cachedMetaCommentStart}${JSON.stringify(meta)}`;
}
