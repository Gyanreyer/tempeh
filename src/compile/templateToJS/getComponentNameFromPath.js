import { basename } from "node:path";

/**
 * Takes a component file path and extacts a PascalCase component name from it.
 *
 * @param {string} filePath
 *
 * @example
 * ```js
 * const componentName = getComponentNameFromPath("src/components/my-component.tmph.html");
 * console.log(componentName); // MyComponent
 * ```
 */
export function getComponentNameFromPath(filePath) {
  let componentName = basename(filePath, ".tmph.html");
  const componentNameChars = componentName.split("");
  let shouldCapitalizeNextChar = true;
  for (let i = 0, charCount = componentNameChars.length; i < charCount; ++i) {
    const char = componentNameChars[i];
    if (!char) {
      break;
    }

    if (char === "-" || char === "_" || char === " " || char === ".") {
      // When we encounter a separator character, remove it and capitalize the next character
      componentNameChars.splice(i, 1);
      --i;
      shouldCapitalizeNextChar = true;
    } else if (shouldCapitalizeNextChar) {
      componentNameChars[i] = char.toUpperCase();
      shouldCapitalizeNextChar = false;
    }
  }

  return componentNameChars.join("");
}
