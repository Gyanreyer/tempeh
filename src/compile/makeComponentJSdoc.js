const propsTypedefRegex = /\/\*\*\s+\**\s*@typedef\s*\{.+\}\s*Props[\s\*]*/;

const namedSlotsTypedefRegex =
  /\/\*\*\s+\**\s*@typedef\s*\{.+\}\s*NamedSlots[\s\*]*/;

// Regex matching the final jsdoc block for the component's render function
const paramsDocRegex =
  /\/\*\*\s+\**\s*@param\s*\{.+\}\s*params[\s\*]*.*\*\/\s*$/;

/**
 * Takes the string of types from a component's <script #types> tag and
 * fills in any missing jsdoc blocks for the component's render function's types.
 *
 * @param {string} typesString
 */
export function makeComponentJSdoc(typesString) {
  let jsDocString = typesString;

  if (!propsTypedefRegex.test(typesString)) {
    jsDocString += `
/**
 * @typedef {Record<string, any> | null | undefined} Props
 */`;
  }

  if (!namedSlotsTypedefRegex.test(typesString)) {
    jsDocString += `
/**
 * @typedef {Record<string, string> | null | undefined} NamedSlots
 */`;
  }

  if (!paramsDocRegex.test(typesString)) {
    jsDocString += `
/**
 * @param {Object} params
 * @param {Props} [params.props]
 * @param {NamedSlots} [params.namedSlots]
 * @param {string|null} [params.slot]
 */`;
  } else {
    jsDocString = jsDocString.trimEnd();
  }

  return jsDocString;
}
