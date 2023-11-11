/**
 * @param {Record<string, any>} object
 */
export function stringifyObjectForRender(object) {
  let objString = "{";

  const keys = Object.keys(object);

  for (let i = 0, keyCount = keys.length; i < keyCount; ++i) {
    const key = keys[i];

    const value = object[key];
    if (typeof value === "object" && value !== null) {
      objString += `${key}: ${stringifyObjectForRender(value)}`;
    } else {
      objString += `${key}: ${value}`;
    }
    if (i < keyCount - 1) {
      // Add a comma if this isn't the last key
      objString += ",";
    }
  }
  objString += "}";
  return objString;
}
