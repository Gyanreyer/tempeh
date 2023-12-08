/**
 * @param {string} content
 */
export const dynamicStringContent = (content) => "${" + content + "}";

/**
 * @param {string} content
 * @param {boolean} isAsync
 */
export const dynamicContentIIFE = (content, isAsync) =>
  `${isAsync ? "await (async " : "("}() => {
  ${content}
})()`;
