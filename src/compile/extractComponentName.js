import { basename } from "node:path";

/**
 * Takes a component file path and extracts a component name from it.
 *
 * @param {string} componentPath
 */
export function extractComponentName(componentPath) {
  let componentFileName = basename(componentPath);

  const firstDotIndex = componentFileName.indexOf(".");

  const componentName = componentFileName.slice(
    0,
    firstDotIndex >= 0 ? firstDotIndex : undefined
  );

  // Ensure the first letter is capitalized
  return componentName[0].toUpperCase() + componentName.slice(1);
}
