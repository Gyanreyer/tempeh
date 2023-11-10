/**
 * @template T
 * @param {T} object
 * @returns {T}
 */
export function deepPreventExtensions(object) {
  if (typeof object === "object" && object !== null) {
    Object.preventExtensions(object);

    for (const key in object) {
      deepPreventExtensions(object[key]);
    }
  }

  return object;
}
