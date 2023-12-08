/**
 * @template T
 * @param {T} object
 * @returns {T}
 */
export function deepFreeze(object) {
  if (typeof object === "object" && object !== null) {
    Object.freeze(object);

    for (const key in object) {
      deepFreeze(object[key]);
    }
  }

  return object;
}
