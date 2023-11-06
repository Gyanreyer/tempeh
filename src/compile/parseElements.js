import { XMLParser } from "fast-xml-parser";
import { extractComponentName } from "./extractComponentName.js";

const parser = new XMLParser({
  // Process tag attributes
  ignoreAttributes: false,
  // Value-less attributes should be treated as booleans
  allowBooleanAttributes: true,
  // Text content should always be set as an `__text` property on an object even if there are no other children or attributes
  alwaysCreateTextNode: true,
  textNodeName: "__text",
  // Parsed elements should be returned as an array of objects to preserve order
  preserveOrder: true,
  // preserveOrder means all attributes will be grouped under a `:@` property, so we don't need
  // any additional prefixes on top of that
  attributeNamePrefix: "",
  // Skip DOCTYPE entities and XML declarations
  processEntities: false,
  ignoreDeclaration: true,
  // Don't remove namespace prefixes from tag names or attributes
  removeNSPrefix: false,
});

/** @typedef {{ tagName: string | null; attributes: Record<string, string|true> | null; children: Array<ParsedElement|string> | null; }} ParsedElement */

/**
 * @typedef {{
 *  [tagName: string]: UnformattedParsedElement[];
 * } & {
 *   ":@"?: Record<string, string|true>;
 *   __text?: string;
 * }} UnformattedParsedElement
 */

/** @param {string} key */
const findTagNameKey = (key) => key !== ":@";

/**
 * @typedef {{
 *  stylesheets?: string[];
 *  scripts?: string[];
 *  componentImports?: { [componentName: string]: string; };
 *  inlineComponents?: { [componentName: string]: Array<ParsedElement | string>; };
 * }} Meta
 */

/**
 * @param {UnformattedParsedElement} unformattedParsedElement
 * @param {Meta} meta
 *
 * @returns {ParsedElement | null}
 */
function formatParsedElement(unformattedParsedElement, meta) {
  /** @type {ParsedElement} */
  const formattedElement = {
    tagName: null,
    attributes: null,
    children: null,
  };

  if ("__text" in unformattedParsedElement) {
    formattedElement.children = [unformattedParsedElement.__text || ""];
    return formattedElement;
  }

  if (":@" in unformattedParsedElement) {
    formattedElement.attributes = unformattedParsedElement[":@"] || null;
  }

  const tagName = Object.keys(unformattedParsedElement).find(findTagNameKey);

  if (tagName) {
    formattedElement.tagName = tagName;

    for (const child of unformattedParsedElement[tagName]) {
      const formattedChildElement = formatParsedElement(child, meta);
      if (formattedChildElement) {
        (formattedElement.children ??= []).push(formattedChildElement);
      }
    }
  }

  if (tagName === "link") {
    if (!formattedElement.attributes) {
      throw new Error("Received invalid <link> element without attributes");
    }

    const rel = formattedElement.attributes.rel;

    if (typeof rel !== "string") {
      throw new Error(`Received invalid rel "${rel}" for <link> element`);
    }

    const importPath = formattedElement.attributes.href;

    if (typeof importPath !== "string") {
      throw new Error(
        `Received invalid href "${importPath}" for <link rel="${rel}"> element`
      );
    }

    switch (rel) {
      case "stylesheet":
        (meta.stylesheets ??= []).push(importPath);
        return null;
      case "import":
        let componentName = formattedElement.attributes.as;

        if (!componentName || typeof componentName !== "string") {
          componentName = extractComponentName(importPath);
        }

        // Ensure the component name is capitalized
        componentName = componentName[0].toUpperCase() + componentName.slice(1);

        (meta.componentImports ??= {})[componentName] = importPath;
        return null;
    }
  } else if (
    tagName === "template" &&
    typeof formattedElement.attributes?.["#component"] === "string"
  ) {
    const componentName = formattedElement.attributes["#component"];

    if (!formattedElement.children) {
      throw new Error(
        `Received invalid <template #component="${componentName}"> element without children`
      );
    }

    (meta.inlineComponents ??= {})[componentName] = formattedElement.children;
    return null;
  }

  return formattedElement;
}

/**
 *
 * @param {string} componentString
 */
export const parseElements = (componentString) => {
  /** @type {UnformattedParsedElement[]} */
  const unformattedParsedElements = parser.parse(componentString);

  /** @type {ParsedElement[]} */
  const parsedElements = [];

  /** @type {Meta} */
  const meta = {};

  for (const element of unformattedParsedElements) {
    const formattedElement = formatParsedElement(element, meta);

    if (formattedElement) {
      parsedElements.push(formattedElement);
    }
  }

  return { parsedElements, meta };
};
