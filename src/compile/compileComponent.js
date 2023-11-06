import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import esbuild from "esbuild";

import { parseElements } from "./parseElements.js";

import renderAttributeToString from "../render/renderAttributes.js";
import md from "../render/md.js";
import { processExpressionString } from "./parseExpressionString.js";
import { getRandomString } from "../utils/getRandomString.js";

/** @typedef {import("./parseElements.js").ParsedElement} ParsedElement */

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

/**
 * @param {ParsedElement} element
 * @param {Record<string, string>} imports
 * @param {import("./parseElements.js").Meta} meta
 * @returns {Promise<string>}
 */
const render = async (element, imports, meta) => {
  if (!element.tagName) {
    return element.children?.join("\n") ?? "";
  }

  /**
   * @type {Array<{ name: "#if" | "#for" | "#for-range" | "#with"; modifier: string; value: string; }> | null}
   * Render attributes which involve creating a new block scope, ie #if, #for, #for-range, and #with
   * The order of these attributes is important, so we need to gather them in an array and then evaluate them
   * in reverse order so the innermost scope is evaluated first.
   */
  let scopedRenderAttributes = null;
  let shouldParseChildrenAsMarkdown = false;

  /** @type {Record<string, string|true> | null} */
  let staticAttributes = null;

  /** @type {Record<string, string|true> | null} */
  let dynamicAttributes = null;

  for (let attributeName in element.attributes) {
    const attributeValue = element.attributes[attributeName];

    if (attributeName[0] === ":") {
      // :attrName is a shorthand for #attr:attrName
      attributeName = `#attr${attributeName}`;
    }

    if (attributeName[0] !== "#") {
      // Pass static attributes through to the output
      (staticAttributes ??= {})[attributeName] = attributeValue;
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

        element.tagName = `\$\{(()=>{
          ${code}
          if(${resultVariableName} && typeof ${resultVariableName} === "string"){
            return ${resultVariableName};
          }
          return "${element.tagName}";
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

        dynamicAttributes ??= {};

        // Attribute spreading syntax means the attribute value should be an object
        // and we should spread the object's properties into the element's attributes
        if (attributeModifier === "...") {
          dynamicAttributes["..."] = `(()=>{
            ${code}
            if(typeof ${resultVariableName} !== "object") {
              console.warn(\`Attempted to spread non-object value \$\{${resultVariableName}\} onto element attributes\`);
              return {};
            }
            return ${resultVariableName};
          })()`;
        } else {
          dynamicAttributes[attributeModifier] = `(()=>{
            ${code}
            return ${resultVariableName};
          })()`;
        }

        break;
      }
      case "#text": {
        /**
         * #text="expression"
         * attributeValue is the expression which should be evaluated to an escaped string which will
         * replace the element's children.
         */
        const { code, resultVariableName } =
          processExpressionString(attributeValue);

        imports.escapeText = "#tmph/render/escapeText.js";

        element.children = [
          `\$\{escapeText((()=>{
              ${code}
              return ${resultVariableName};
            })())\}`,
        ];

        break;
      }
      case "#html": {
        /**
         * #html="expression"
         * attributeValue is the expression which should be evaluated to an HTML content string which will
         * replace the element's children without being escaped.
         */
        const { code, resultVariableName } =
          processExpressionString(attributeValue);

        imports.html = "#tmph/render/html.js";

        element.children = [
          `\$\{html((()=>{
              ${code}
              return ${resultVariableName};
            })())\}`,
        ];
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

  let renderedElement = "";

  const isImportedComponent =
    meta.componentImports && element.tagName in meta.componentImports;
  const isInlineComponent =
    meta.inlineComponents && element.tagName in meta.inlineComponents;

  if (isImportedComponent || isInlineComponent) {
    let propsString = "";

    if (staticAttributes) {
      for (const attributeName in staticAttributes) {
        propsString += `${attributeName}: ${JSON.stringify(
          staticAttributes[attributeName]
        )},`;
      }
    }

    if (dynamicAttributes) {
      /** @type {string | null} */
      let spreadAttribute = null;

      for (const attributeName in dynamicAttributes) {
        if (attributeName === "...") {
          spreadAttribute = /** @type {string} */ (
            dynamicAttributes[attributeName]
          );
        } else {
          propsString += `${attributeName}: ${dynamicAttributes[attributeName]},`;
        }
      }

      if (spreadAttribute) {
        propsString += `...${spreadAttribute},`;
      }
    }

    /** @type {Array<string|Promise<string>> | null} */
    let defaultSlotContent = null;
    /** @type {Record<string, Promise<string>[]> | null} */
    let namedSlots = null;

    if (element.children) {
      for (const child of element.children) {
        if (typeof child === "string") {
          (defaultSlotContent ??= []).push(child);
        } else {
          if (typeof child.attributes?.slot === "string") {
            const slotName = child.attributes.slot;
            // Delete the slot attribute so it doesn't get rendered
            delete child.attributes.slot;
            ((namedSlots ??= {})[slotName] ??= []).push(
              render(child, imports, meta)
            );
          } else {
            (defaultSlotContent ??= []).push(render(child, imports, meta));
          }
        }
      }
    }

    let defaultSlotString = defaultSlotContent
      ? (await Promise.all(defaultSlotContent)).join("\n")
      : null;

    /** @type {string} */
    let stringifiedNamedSlots;
    if (namedSlots) {
      stringifiedNamedSlots = "{";
      for (const slotName in namedSlots) {
        stringifiedNamedSlots += `${slotName}: \`${(
          await Promise.all(namedSlots[slotName])
        ).join("\n")}\`,`;
      }
      stringifiedNamedSlots += "}";
    } else {
      stringifiedNamedSlots = "null";
    }

    renderedElement = `\$\{await ${element.tagName}.render({
      props: ${propsString ? `{${propsString}}` : "null"},
      slot: ${defaultSlotString ? `\`${defaultSlotString}\`` : "null"},
      namedSlots: ${stringifiedNamedSlots},
    })\}`;
  } else {
    const isFragment = element.tagName === "_";

    if (!isFragment) {
      let attributesString = "";

      for (const attributeName in staticAttributes) {
        attributesString += await renderAttributeToString(
          attributeName,
          staticAttributes[attributeName]
        );
      }

      for (const attributeName in dynamicAttributes) {
        if (attributeName === "...") {
          const valueName = `__tmph_value_${getRandomString()}`;
          const keyName = `__tmph_key_${getRandomString()}`;
          const attributePromisesName = `__tmph_attributePromises_${getRandomString()}`;
          const resultName = `__tmph_result_${getRandomString()}`;
          attributesString += `\$\{await (async ()=> {
            const ${valueName} = ${dynamicAttributes[attributeName]};
            let ${attributePromisesName} = [];
            for(const ${keyName} in ${valueName}){
              ${attributePromisesName}.push(renderAttributeToString(${keyName}, ${valueName}[${keyName}]));
            }
            const ${resultName} =  (await Promise.all(${attributePromisesName})).join(" ");
            return ${resultName} ? \` \$\{${resultName}\}\` : "";
          })()\}`;
        } else {
          attributesString += `\$\{await renderAttributeToString(
            "${attributeName}",
            ${dynamicAttributes[attributeName]},
          )\}`;
        }
      }

      renderedElement = `<${element.tagName}${attributesString}>`;
    }

    /** @type {string} */
    let childrenString = "";

    if (typeof element.children === "string") {
      childrenString = element.children;
    } else if (Array.isArray(element.children)) {
      /** @type {Array<string | Promise<string>>} */
      const childRenderPromises = new Array(element.children.length);
      for (const child of element.children) {
        if (typeof child === "string") {
          childRenderPromises.push(child);
        } else {
          if (child.tagName === "slot") {
            if (child.attributes?.name) {
              const slotName = child.attributes.name;
              // Delete the slot attribute so it doesn't get rendered
              childRenderPromises.push(`\$\{namedSlots?.${slotName} ?? ""\}`);
            } else {
              childRenderPromises.push(`\$\{slot ?? ""\}`);
            }
          } else {
            childRenderPromises.push(render(child, imports, meta));
          }
        }
      }
      childrenString = (await Promise.all(childRenderPromises)).join("\n");
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

    renderedElement += childrenString;

    if (!isFragment) {
      const isVoid = element.tagName in voidTagNames;

      if (!isVoid || Boolean(childrenString)) {
        if (isVoid) {
          console.warn(
            `Void tag <${element.tagName}> unexpectedly received child content`
          );
        }
        renderedElement += `</${element.tagName}>`;
      }
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

          renderedElement = `\$\{await (async ()=>{
            ${processExpressionString(attribute.value, attribute.modifier).code}
            return \`${renderedElement}\`;
          })()\}`;
          break;
        }
        case "#if": {
          const { code, resultVariableName } = processExpressionString(
            attribute.value
          );

          renderedElement = `\$\{await (async ()=>{
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

          renderedElement = `\$\{await (async ()=> {
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
export async function compileComponent(componentPath) {
  if (cache[componentPath]) {
    return cache[componentPath];
  }

  const componentString = readFileSync(componentPath, "utf8");

  const { parsedElements, meta } = parseElements(componentString);

  /** @type {Record<string, string>} */
  const imports = {};

  const componentDirectory = path.dirname(componentPath);

  if (meta.componentImports) {
    const resolveComponentImportPromises = [];

    for (const componentName in meta.componentImports) {
      const filePath = path.resolve(
        componentDirectory,
        meta.componentImports[componentName]
      );

      resolveComponentImportPromises.push(
        compileComponent(filePath).then((outputPath) => {
          imports[`* as ${componentName}`] = outputPath;
        })
      );
    }

    await Promise.all(resolveComponentImportPromises);
  }

  const renderPromises = [];

  for (const element of parsedElements) {
    renderPromises.push(render(element, imports, meta));
  }

  const renderString = (await Promise.all(renderPromises)).join("\n");

  let inlineComponentsString = "";

  if (meta.inlineComponents) {
    for (const componentName in meta.inlineComponents) {
      const subComponentRenderPromises = [];

      for (const element of meta.inlineComponents[componentName]) {
        if (typeof element === "string") {
          subComponentRenderPromises.push(element);
        } else {
          subComponentRenderPromises.push(render(element, imports, meta));
        }
      }

      inlineComponentsString += `
        const ${componentName} = { render: async ({ props, slot, namedSlots }) => {
          return \`${(await Promise.all(subComponentRenderPromises)).join(
            "\n"
          )}\`;
        }};
      `;
    }
  }

  let importsString = "";
  for (const importMethod in imports) {
    importsString += `import ${importMethod} from "${imports[importMethod]}";`;
  }

  const outputPath = path.resolve(
    componentDirectory,
    `./${path.basename(componentPath, ".html")}.js`
  );

  writeFileSync(
    outputPath,
    esbuild.transformSync(
      `
    ${importsString}
    ${inlineComponentsString}
    export async function render({ props, slot, namedSlots }) {
      return \`${renderString}\`;
    }`,
      {
        minify: true,
      }
    ).code
  );

  return outputPath;
}
