/**
 * @param {*} value
 * @returns {value is Record<string, any>}
 */
const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * @param {Record<string, any>} obj
 * @param {Record<string, any>} defaults
 */
const mergeDefaults = (obj, defaults) => {
  for (const key in defaults) {
    if (obj[key] === undefined) {
      // If the key doesn't exist in the output object, apply the default value
      obj[key] = defaults[key];
    } else if (isObject(obj[key]) && isObject(defaults[key])) {
      // If the key exists in both objects, and both values are objects,
      // continue recursively to merge the sub-objects
      mergeDefaults(obj[key], defaults[key]);
    }
  }
  return obj;
};

/**
 * Takes a props object and a defaultProps object, and merges any missing default values
 * into the props object. Be aware that this transforms the original props object instead of making a copy
 * for performance purposes.
 *
 * @param {Record<string, any>|null|undefined} props
 * @param {Record<string, any>} defaultProps
 */
export default function defaultProps(props, defaultProps) {
  if (!props) {
    return defaultProps;
  }
  return mergeDefaults(structuredClone(props), defaultProps);
}
