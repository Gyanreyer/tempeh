const propsTypedefCommentBlockRegex =
  /\/\*\*\s+\**\s*(@typedef\s*\{.+\}\s*[Pp]rops)(.|\n)*?(?:@typedef|\*\/)/g;

const requiredPropertyRegex =
  /\@prop(?:erty)?\s*\{(?:.|\n)*?\}\s*(?<name>[^\[]+?\b)/g;

const optionalPropertyRegex =
  /@prop(?:erty)?\s*\{(?:.|\n)*?\}\s*\[\s*(?<name>[^=]+)\s*=?\s*(?<defaultValue>.*)\s*\]/g;

/**
 * Takes the string of types from a component's <script #types> tag and
 * fills in any missing jsdoc blocks for the component's render function's types.
 *
 * @param {import("./gatherComponentMeta").Meta} meta
 */
export function makeComponentJSdoc(meta) {
  const usesProps = meta.usesProps;
  const hasDefaultSlot = meta.hasDefaultSlot;
  const namedSlots = meta.namedSlots;

  let jsDocString = meta.jsDoc || "";

  if (!usesProps && !hasDefaultSlot && !namedSlots) {
    return { jsDocString, defaultProps: null };
  }

  let hasRequiredProps = false;

  /** @type {Record<string, any> | null} */
  let defaultProps = null;

  const propsTypedefCommentBlockMatch = jsDocString.match(
    propsTypedefCommentBlockRegex
  );

  if (propsTypedefCommentBlockMatch) {
    const commentBlockString = propsTypedefCommentBlockMatch[0];

    hasRequiredProps = requiredPropertyRegex.test(commentBlockString);

    let match;
    while ((match = optionalPropertyRegex.exec(commentBlockString))) {
      defaultProps ??= {};

      const name = match.groups?.name;
      const defaultValue = match.groups?.defaultValue?.trim();
      if (name) {
        const splitNameParts = name.split(".");

        let previousPartObject = defaultProps;
        for (let i = 0, partCount = splitNameParts.length; i < partCount; ++i) {
          const partName = splitNameParts[i];

          if (i < partCount - 1) {
            const partObject = previousPartObject[partName];
            if (typeof partObject !== "object" || partObject === null) {
              previousPartObject[partName] = {};
            }
            previousPartObject = previousPartObject[partName];
          } else {
            previousPartObject[partName] = defaultValue || null;
          }
        }
      }
    }
  } else {
    jsDocString += `
/**
 * @typedef {Record<string, any> | null | undefined} Props
 */`;
  }

  jsDocString += `
/**
 * @param {Object} ${hasRequiredProps ? "params" : "[params]"}`;

  if (usesProps) {
    jsDocString += `
 * @param {Props} ${hasRequiredProps ? "params.props" : "[params.props]"}`;
  }

  if (hasDefaultSlot) {
    jsDocString += `
 * @param {string|null} [params.slot=""]`;
  }

  if (namedSlots) {
    let slotNamesUnionString = "";
    for (let i = 0, slotCount = namedSlots.length; i < slotCount; ++i) {
      slotNamesUnionString += `"${namedSlots[i]}"${
        i < slotCount - 1 ? "|" : ""
      }`;
    }

    jsDocString += `
 * @param {{ [key in ${slotNamesUnionString}]?: string }} [params.namedSlots=""]`;
  }

  jsDocString += `
*/`;

  return {
    jsDocString,
    defaultProps,
  };
}
