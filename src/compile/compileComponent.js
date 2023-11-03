import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import esbuild from "esbuild";
import { renderAttributeToString } from "../render/renderAttributes.js";
import { md } from "../render/md.js";

// HTML tag names that don't have closing tags
const voidTagNames = {
  area: true,
  base: true,
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true,
};

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

/** @typedef {{ __text: string }} TextNode */

/** @typedef {{ [key: string]: Array<ParsedTag | TextNode>; } & { ":@"?: Record<string, string|true>; }} ParsedTag */

/**
 * @param {ParsedTag | TextNode} element
 * @returns {element is TextNode}
 */
const isTextNode = (element) => "__text" in element;

/**
 *
 * @param {string} componentString
 * @returns {Array<ParsedTag | TextNode>}
 */
const parseElements = (componentString) => parser.parse(componentString);

const dynamicModifierAttributeNameRegex = /^#(for|for-range|if|attr|with)/;

const getRandomString = () => Math.random().toString(36).slice(2);

/**
 * @param {unknown} expressionString
 */
const processExpressionString = (expressionString) => {
  if (typeof expressionString !== "string") {
    throw new Error("Received invalid expression value");
  }

  const expressionLines = expressionString.split(";");
  let lastExpressionLine = expressionLines.pop();
  while (expressionLines.length > 0 && !lastExpressionLine?.trim()) {
    lastExpressionLine = expressionLines.pop();
  }

  if (!lastExpressionLine) {
    throw new Error("Received empty expression");
  }

  const evaluatedVariableName = `expr__${getRandomString()}`;

  return {
    code: `${
      expressionLines.length > 0 ? expressionLines.join(";") + ";" : ""
    }const ${evaluatedVariableName} = (${lastExpressionLine});`,
    evaluatedVariableName,
  };
};

/**
 * @param {ParsedTag | TextNode} element
 * @param {Record<string, string>} imports
 */
const render = (element, imports) => {
  if (isTextNode(element)) {
    return element.__text;
  }

  /** @type {string | null} */
  let tagName = null;

  /** @type {Array<ParsedTag | TextNode> | null} */
  let elementChildren = null;

  for (const key in element) {
    if (key !== ":@") {
      tagName = key;
      elementChildren = element[key];
      break;
    }
  }

  if (!tagName || !elementChildren) {
    throw new Error("Failed to find tag name for element");
  }

  /**
   * @type {Record<string, string | true | Record<string, string>>}
   */
  const attributes = element[":@"] || {};

  let openingTagContents = tagName;

  let wrappingContentStart = "";
  let wrappingContentEnd = "";

  for (const attributeName in element[":@"]) {
    const attributeValue = element[":@"][attributeName];
    if (attributeName[0] === "#" || attributeName[0] === ":") {
      if (attributeName === "#") {
        // Skip comment attributes
        continue;
      } else if (attributeName.startsWith("#if")) {
        const { code, evaluatedVariableName } =
          processExpressionString(attributeValue);

        wrappingContentStart = `\$\{(()=>{ ${code} return ${evaluatedVariableName} ? \``;
        wrappingContentEnd = `\` : ""; })()\}`;
      } else if (
        // `:attrName` is a shorthand for `#attr:attrName`
        attributeName[0] === ":" ||
        attributeName.startsWith("#attr")
      ) {
        let modiferAttributeName = attributeName.split(":")[1];

        const { code, evaluatedVariableName } =
          processExpressionString(attributeValue);

        openingTagContents += `\$\{(()=>{
          ${code}
          if(typeof ${evaluatedVariableName} === "string") {
            return \` ${modiferAttributeName}="\$\{${evaluatedVariableName}\}"\`;
          }

          return ${evaluatedVariableName} ? " ${modiferAttributeName}" : "";
        })()\}`;
      } else if (dynamicModifierAttributeNameRegex.test(attributeName)) {
        if (typeof attributeValue !== "string") {
          console.error(`${attributeName} attribute requires a value`);
          continue;
        }

        delete attributes[attributeName];
        const [baseAttributeName, attributeModifier] = attributeName.split(":");

        if (!attributeModifier) {
          console.error(
            "#with attribute provided without a variable name modifier"
          );
          continue;
        }

        if (typeof attributes[baseAttributeName] !== "object") {
          attributes[baseAttributeName] = {};
        }
        /** @type {Record<string,string>} */ (attributes[baseAttributeName])[
          attributeModifier
        ] = attributeValue;
      }
    } else {
      openingTagContents += ` ${renderAttributeToString(
        attributeName,
        attributeValue
      )}`;
    }
  }

  /** @type {string | null} */
  let childrenString = null;

  if ("#text" in attributes) {
    const attributeValue = attributes["#text"];

    if (typeof attributeValue !== "string") {
      console.error("#text attribute provided without a string value");
    } else {
      const { code, evaluatedVariableName } =
        processExpressionString(attributeValue);

      imports.escapeText = "#tmph/render/escapeText.js";

      // Escape HTML characters from text content
      childrenString = `\$\{(()=>{
        ${code}
        return escapeText(String(${evaluatedVariableName}));
      })()\}`;
    }
  } else if ("#html" in attributes) {
    const attributeValue = attributes["#html"];

    if (typeof attributeValue !== "string") {
      console.error("#html attribute provided without a string value");
    } else {
      const { code, evaluatedVariableName } =
        processExpressionString(attributeValue);

      childrenString = `\$\{(()=>{
        ${code}
        return String(${evaluatedVariableName});
      })()\}`;
    }
  } else if (elementChildren.length > 0 || !(tagName in voidTagNames)) {
    childrenString = "";
    for (const child of elementChildren) {
      childrenString += render(child, imports);
    }
  }

  if (childrenString && "#md" in attributes) {
    // Presence of #md attribute means we should parse the children as markdown
    const hasDynamicContent = childrenString.includes("${");
    if (!hasDynamicContent) {
      childrenString = md(childrenString);
    } else {
      imports.md = "#tmph/render/md.js";

      childrenString = `\$\{md(\`${childrenString}\`)\}`;
    }
  }

  let renderedElement = `<${openingTagContents}>`;
  if (childrenString !== null) {
    renderedElement += `${childrenString}</${tagName}>`;
  }

  if ("#for" in attributes) {
    if (typeof attributes["#for"] !== "object") {
      throw new Error("Failed to parse #for attribute");
    }
    const modifierKeys = Object.keys(attributes["#for"]);
    const modifier = modifierKeys[0];

    if (modifierKeys.length > 1) {
      console.error(`Multiple #for attributes set when only one is allowed.`);
    }

    const attributeValue = attributes["#for"][modifier];

    const { code, evaluatedVariableName } =
      processExpressionString(attributeValue);

    const [itemName = "__tmph_item", indexName = "__tmph_index"] =
      modifier.split(",");

    renderedElement = `\$\{(()=> {
          ${code};
          let __tmph_renderedString = "";
          let ${indexName} = 0;
          for(const ${itemName} of ${evaluatedVariableName}){
            __tmph_renderedString += \`${renderedElement}\`;
            ++${indexName};
          }
          return __tmph_renderedString;
        })()\}`;
  } else if ("#for-range" in attributes) {
    if (typeof attributes["#for-range"] !== "object") {
      throw new Error("Failed to parse #for-range attribute");
    }

    const modifierKeys = Object.keys(attributes["#for-range"]);
    const modifier = modifierKeys[0];

    if (modifierKeys.length > 1) {
      console.error(
        `Multiple #for-range attributes set when only one is allowed.`
      );
    }

    const attributeValue = attributes["#for-range"][modifier];

    const { code, evaluatedVariableName } =
      processExpressionString(attributeValue);

    const itemName = modifier || "__tmph_item";

    imports.renderForRange = "#tmph/render/renderForRange.js";

    renderedElement = `\$\{(()=> {
          ${code};

          return renderForRange(${evaluatedVariableName}, (${itemName}) => {
            return \`${renderedElement}\`;
          });
        })()\}`;
  }

  renderedElement = `${wrappingContentStart}${renderedElement}${wrappingContentEnd}`;

  return renderedElement;
};

/**
 * Cache maps component paths to compiled code paths.
 * @type {Record<string, string>}
 */
const cache = {};

/**
 * @param {string} componentPath
 */
export function compileComponent(componentPath) {
  if (cache[componentPath]) {
    return cache[componentPath];
  }

  const componentString = readFileSync(componentPath, "utf8");

  // const elements = parseElements(componentString);

  const elements = parseElements(componentString);

  let renderString = "";

  /** @type {Record<string, string>} */
  const imports = {};

  for (const element of elements) {
    renderString += render(element, imports);
  }

  // writeFileSync("index.html", renderString);

  return esbuild.transformSync(
    `
    ${(() => {
      let importsString = "";

      for (const importMethod in imports) {
        importsString += `import {${importMethod}} from "${imports[importMethod]}";`;
      }

      return importsString;
    })()}
    export function render(params) {
      return \`${renderString}\`;
    }`,
    {
      minify: true,
    }
  );
}
