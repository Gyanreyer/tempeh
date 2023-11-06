import { basename } from "node:path";

/**
 * Takes a component file path and extracts a component name from it.
 *
 * @param {string} componentPath
 */
export function extractComponentName(componentPath) {
  let componentFileName = basename(componentPath);

  const firstDotIndex = componentFileName.indexOf(".");

  return componentFileName.slice(
    0,
    firstDotIndex >= 0 ? firstDotIndex : undefined
  );
}
