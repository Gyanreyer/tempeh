import { readFileSync, stat, writeFileSync } from "node:fs";
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

/** Generates a random string which can be used for scoped variable names */
const getRandomString = () => Math.random().toString(36).slice(2);

// Regex matches the last line of a JavaScript expression
const lastLineOfExpressionRegex = /;?(.+)[;\s]?$/;

/**
 * @param {unknown} expressionString
 */
const processExpressionString = (
  expressionString,
  resultVariableName = `__tmph_expr__${getRandomString()}`
) => {
  if (typeof expressionString !== "string") {
    throw new Error("Received invalid expression value");
  }

  const lastLineOfExpressionMatch = expressionString.match(
    lastLineOfExpressionRegex
  );

  if (!lastLineOfExpressionMatch) {
    throw new Error(`Failed to parse expression: "${expressionString}"`);
  }

  const lastExpressionLine = lastLineOfExpressionMatch[0];
  const code = expressionString.slice(0, lastLineOfExpressionMatch.index);

  return {
    code: `${code}
    let ${resultVariableName} = (${lastExpressionLine});`,
    resultVariableName,
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

  const allAttributes = element[":@"];

  /**
   * @type {Array<{ name: "#if" | "#for" | "#for-range" | "#with"; modifier: string; value: string; }> | null}
   * Render attributes which involve creating a new block scope, ie #if, #for, #for-range, and #with
   * The order of these attributes is important, so we need to gather them in an array and then evaluate them
   * in reverse order so the innermost scope is evaluated first.
   */
  let scopedRenderAttributes = null;
  let shouldParseChildrenAsMarkdown = false;

  let attributesString = "";

  for (let attributeName in allAttributes) {
    const attributeValue = allAttributes[attributeName];

    if (attributeName[0] === ":") {
      // :attrName is a shorthand for #attr:attrName
      attributeName = `#attr${attributeName}`;
    }

    if (attributeName[0] !== "#") {
      // Pass static attributes through to the output
      attributesString += renderAttributeToString(
        attributeName,
        attributeValue
      );
      continue;
    }

    if (attributeName === "#") {
      // Skip comment attributes
      continue;
    }

    const [baseAttributeName, attributeModifier] = attributeName.split(":");

    switch (baseAttributeName) {
      case "#md": {
        /**
         * #md
         * attributeValue is ignored
         * If the element has children, they will be parsed as markdown
         */
        shouldParseChildrenAsMarkdown = true;
        break;
      }
      case "#tagname": {
        /**
         * #tagname="expression"
         * attributeValue is the expression which should be evaluated to a string which will
         * replace the element's tag name.
         * If the expression evaluates to a falsey value, the default tag name will be used.
         * If the expression evaluates to a non-string value, the default tag name will be used.
         */
        const { code, resultVariableName } =
          processExpressionString(attributeValue);

        tagName = `\$\{(()=>{
          ${code}
          if(${resultVariableName} && typeof ${resultVariableName} === "string"){
            return ${resultVariableName};
          }
          return "${tagName}";
        })()\}`;
        break;
      }
      case "#attr": {
        /**
         * #attr:attrName="expression"
         * attributeModifier is the attribute name
         * attributeValue is the expression which should be evaluated to the attribute's value
         */
        const { code, resultVariableName } =
          processExpressionString(attributeValue);

        imports.renderAttributeToString = "#tmph/render/renderAttributes.js";

        // Attribute spreading syntax means the attribute value should be an object
        // and we should spread the object's properties into the element's attributes
        if (attributeModifier === "...") {
          const attributesStringVariableName = `__tmph_attrString_${getRandomString()}`;

          attributesString += `\$\{(()=>{
            ${code}
            if(!${resultVariableName}) {
              return "";
            }
            if(typeof ${resultVariableName} !== "object"){
              console.warn(\`Attempted to spread non-object value \$\{${resultVariableName}\} onto element attributes\`);
              return "";
            }

            let ${attributesStringVariableName} = "";

            for(const key in ${resultVariableName}) {
              ${attributesStringVariableName} += renderAttributeToString(key, ${resultVariableName}[key]);
            }

            return ${attributesStringVariableName};
          })()\}`;
        } else {
          attributesString += `\$\{(()=>{
            ${code}

            return renderAttributeToString("${attributeModifier}", ${resultVariableName});
          })()\}`;
        }

        break;
      }
      case "#text": {
        /**
         * #text="expression"
         * attributeValue is the expression which should be evaluated to an escaped string which will
         * replace the element's children.
         */
        imports.escapeText = "#tmph/render/escapeText.js";
        const { code, resultVariableName } =
          processExpressionString(attributeValue);

        elementChildren[0] = {
          __text: `\$\{escapeText((()=>{
            ${code}
            return ${resultVariableName};
          })())\}`,
        };
        elementChildren.length = 1;

        break;
      }
      case "#html": {
        /**
         * #html="expression"
         * attributeValue is the expression which should be evaluated to an HTML content string which will
         * replace the element's children without being escaped.
         */
        imports.html = "#tmph/render/html.js";
        const { code, resultVariableName } =
          processExpressionString(attributeValue);

        elementChildren[0] = {
          __text: `\$\{html((()=>{
            ${code}
            return ${resultVariableName};
          })())\}`,
        };
        elementChildren.length = 1;
        break;
      }
      case "#with":
      case "#if":
      case "#for":
      case "#for-range": {
        if (typeof attributeValue !== "string") {
          // Continue to the default error case if the attribute value is not a string
          continue;
        }

        (scopedRenderAttributes ??= []).push({
          name: baseAttributeName,
          modifier: attributeModifier,
          value: attributeValue,
        });
        break;
      }

      default:
        console.error(
          `Received invalid render attribute ${attributeName}${
            attributeValue === true ? "" : `=${attributeValue}`
          }. Check for typos.`
        );
    }
  }

  /** @type {string} */
  let childrenString = "";

  if (elementChildren.length > 0 || !(tagName in voidTagNames)) {
    for (const child of elementChildren) {
      childrenString += render(child, imports);
    }
  }

  if (childrenString && shouldParseChildrenAsMarkdown) {
    // Presence of #md attribute means we should parse the children as markdown
    const hasDynamicContent = childrenString.includes("${");
    if (!hasDynamicContent) {
      childrenString = md(childrenString);
    } else {
      imports.md = "#tmph/render/md.js";

      childrenString = `\$\{md(\`${childrenString}\`)\}`;
    }
  }

  const isFragment = tagName === "_";

  let renderedElement = isFragment ? "" : `<${tagName}${attributesString}>`;
  if (childrenString !== null) {
    renderedElement += childrenString;
    if (!isFragment) {
      renderedElement += `</${tagName}>`;
    }
  }

  if (scopedRenderAttributes) {
    // Evaluating scoped render attributes in reverse order so the innermost scope is evaluated first
    for (const attribute of scopedRenderAttributes.reverse()) {
      switch (attribute.name) {
        case "#with": {
          if (!attribute.modifier) {
            console.error(`#with attribute requires a modifier`);
            continue;
          }

          renderedElement = `\$\{(()=>{
            ${processExpressionString(attribute.value, attribute.modifier).code}
            return \`${renderedElement}\`;
          })()\}`;
          break;
        }
        case "#if": {
          const { code, resultVariableName } = processExpressionString(
            attribute.value
          );

          renderedElement = `\$\{(()=>{
            ${code}
            return ${resultVariableName} ? \`${renderedElement}\` : "";
          })()\}`;
          break;
        }
        case "#for": {
          const { code, resultVariableName } = processExpressionString(
            attribute.value
          );

          const [
            itemName = `__tmph_item_${getRandomString()}`,
            indexName = `__tmph_index_${getRandomString()}`,
          ] = attribute.modifier.split(",");

          const renderStringVariableName = `__tmph_render_${getRandomString()}`;

          renderedElement = `\$\{(()=> {
                ${code}
                let ${renderStringVariableName} = "";
                let ${indexName} = 0;
                for(const ${itemName} of ${resultVariableName}){
                  ${renderStringVariableName} += \`${renderedElement}\`;
                  ++${indexName};
                }
                return \`${renderStringVariableName}\`;
              })()\}`;
          break;
        }
        case "#for-range": {
          const { code, resultVariableName } = processExpressionString(
            attribute.value
          );

          const itemName =
            attribute.modifier || `__tmph_item_${getRandomString()}`;

          imports.renderForRange = "#tmph/render/renderForRange.js";

          renderedElement = `\$\{(()=> {
                ${code};
                return renderForRange(${resultVariableName}, (${itemName}) => {
                  return \`${renderedElement}\`;
                });
              })()\}`;
          break;
        }
      }
    }
  }

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

  const elements = parseElements(componentString);

  let renderString = "";

  /** @type {Record<string, string>} */
  const imports = {};

  for (const element of elements) {
    renderString += render(element, imports);
  }

  writeFileSync(
    `index.js`,
    esbuild.transformSync(
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
    ).code
  );
}
