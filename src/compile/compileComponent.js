import { writeFileSync } from "node:fs";
import path from "node:path";

import renderAttributeToString from "../render/renderAttributes.js";
import md from "../render/md.js";
import { processExpressionString } from "./parseExpressionString.js";
import { getRandomString } from "../utils/getRandomString.js";
import { parseXML } from "./parseXML.js";
import { gatherComponentMeta } from "./gatherComponentMeta.js";
import { getNodeAttributeValue } from "./getNodeAttributeValue.js";
import { makeComponentJSdoc } from "./makeComponentJSdoc.js";

/** @typedef {import("./parseXML.js").TmphNode} TmphNode */
/** @typedef {import("./gatherComponentMeta.js").Meta} Meta */

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
 * @param {TmphNode|string} node
 * @param {Record<string, string>} imports
 * @param {Meta} meta
 * @returns {Promise<string>}
 */
const render = async (node, imports, meta) => {
  if (typeof node === "string") {
    return node;
  }

  if (!node.tagName) {
    return node.children?.join("\n") ?? "";
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

  if (node.attributes) {
    for (let [attributeName, attributeValue] of node.attributes) {
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
          const code = processExpressionString(attributeValue);

          node.tagName = `\$\{${code} ?? "${node.tagName}"\}`;
          break;
        }
        case "#attr": {
          /**
           * #attr:attrName="expression"
           * attributeModifier is the attribute name
           * attributeValue is the expression which should be evaluated to the attribute's value
           */
          const code = processExpressionString(attributeValue);

          imports.renderAttributeToString = "#tmph/render/renderAttributes.js";

          dynamicAttributes ??= {};

          // Attribute spreading syntax means the attribute value should be an object
          // and we should spread the object's properties into the element's attributes
          if (attributeModifier === "...") {
            const resultVariableName = `__tmph_result_${getRandomString()}`;
            dynamicAttributes["..."] = `(()=>{
              const ${resultVariableName} = ${code};
              if(typeof ${resultVariableName} !== "object") {
                console.warn(\`Attempted to spread non-object value \$\{${resultVariableName}\} onto element attributes\`);
                return {};
              }
              return ${resultVariableName};
            })()`;
          } else {
            dynamicAttributes[attributeModifier] = code;
          }

          break;
        }
        case "#text": {
          /**
           * #text="expression"
           * attributeValue is the expression which should be evaluated to an escaped string which will
           * replace the element's children.
           */
          const code = processExpressionString(attributeValue);

          imports.escapeText = "#tmph/render/escapeText.js";

          node.children = [`\$\{escapeText(${code})\}`];

          break;
        }
        case "#html": {
          /**
           * #html="expression"
           * attributeValue is the expression which should be evaluated to an HTML content string which will
           * replace the element's children without being escaped.
           */
          const code = processExpressionString(attributeValue);

          imports.html = "#tmph/render/html.js";

          node.children = [`\$\{html(${code})\}`];
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
  }

  let renderedElement = "";

  const isImportedComponent =
    meta.componentImports && node.tagName in meta.componentImports;
  const isInlineComponent =
    meta.inlineComponents && node.tagName in meta.inlineComponents;

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

    if (node.children) {
      for (const child of node.children) {
        if (typeof child === "string") {
          (defaultSlotContent ??= []).push(child);
        } else {
          if (typeof staticAttributes?.slot === "string") {
            const slotName = staticAttributes.slot;
            // Delete the slot attribute so it doesn't get rendered
            delete staticAttributes.slot;
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

    renderedElement = `\$\{await ${node.tagName}.render({
      props: ${propsString ? `{${propsString}}` : "null"},
      slot: ${defaultSlotString ? `\`${defaultSlotString}\`` : "null"},
      namedSlots: ${stringifiedNamedSlots},
    })\}`;
  } else {
    const isFragment = node.tagName === "_";

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

      renderedElement = `<${node.tagName}${attributesString}>`;
    }

    /** @type {string} */
    let childrenString = "";

    if (node.children) {
      const childCount = node.children.length;
      /** @type {Array<string | Promise<string>>} */
      const childRenderPromises = new Array(childCount);
      const childStringArray = new Array(childCount);

      for (let i = 0; i < childCount; ++i) {
        const child = node.children[i];

        if (typeof child === "string") {
          childStringArray[i] = child;
        } else {
          if (child.tagName === "slot") {
            const slotName = getNodeAttributeValue(child, "name");
            if (slotName) {
              childStringArray[i] = `\$\{namedSlots?.${slotName} ?? ""\}`;
            } else {
              childStringArray[i] = `\$\{slot ?? ""\}`;
            }
          } else {
            childRenderPromises.push(
              render(child, imports, meta).then(
                (str) => (childStringArray[i] = str)
              )
            );
          }
        }
      }

      await Promise.all(childRenderPromises);
      childrenString = childStringArray.join("");
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
      const isVoid = node.tagName in voidTagNames;

      if (!isVoid || Boolean(childrenString)) {
        if (isVoid) {
          console.warn(
            `Void tag <${node.tagName}> unexpectedly received child content`
          );
        }
        renderedElement += `</${node.tagName}>`;
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
            ${attribute.modifier} = ${processExpressionString(attribute.value)};
            return \`${renderedElement}\`;
          })()\}`;
          break;
        }
        case "#if": {
          const code = processExpressionString(attribute.value);

          renderedElement = `\$\{await (async ()=>{
            return ${code} ? \`${renderedElement}\` : "";
          })()\}`;
          break;
        }
        case "#for": {
          const code = processExpressionString(attribute.value);

          const itemListVariableName = `__tmph_items_${getRandomString()}`;

          const [
            itemName = `__tmph_item_${getRandomString()}`,
            indexName = `__tmph_index_${getRandomString()}`,
          ] = attribute.modifier.split(",");

          const renderStringVariableName = `__tmph_render_${getRandomString()}`;

          renderedElement = `\$\{await (async ()=> {
                const ${itemListVariableName} = ${code};
                let ${renderStringVariableName} = "";
                let ${indexName} = 0;
                for(const ${itemName} of ${itemListVariableName}){
                  ${renderStringVariableName} += \`${renderedElement}\`;
                  ++${indexName};
                }
                return \`${renderStringVariableName}\`;
              })()\}`;
          break;
        }
        case "#for-range": {
          const code = processExpressionString(attribute.value);

          const itemListVariableName = `__tmph_items_${getRandomString()}`;

          const itemName =
            attribute.modifier || `__tmph_item_${getRandomString()}`;

          imports.renderForRange = "#tmph/render/renderForRange.js";

          renderedElement = `\$\{(()=> {
                const ${itemListVariableName} = ${code};
                return renderForRange(${itemListVariableName}, (${itemName}) => {
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

  const rootNodes = await parseXML(componentPath);
  /** @type {Meta} */
  const meta = gatherComponentMeta(rootNodes, {});

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

  for (const node of rootNodes) {
    renderPromises.push(render(node, imports, meta));
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
    `
    ${importsString}
    ${inlineComponentsString}
    ${makeComponentJSdoc(meta.jsDoc ?? "")}
    export async function render({ props, slot, namedSlots }) {
      return \`${renderString}\`;
    }`
  );

  return outputPath;
}
