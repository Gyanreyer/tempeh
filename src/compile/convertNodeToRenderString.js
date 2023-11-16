import renderHTMLAttribute from "../render/renderAttributes.js";
import md from "../render/md.js";
import { getRandomString } from "../utils/getRandomString.js";
import { getNodeAttributeValue } from "./getNodeAttributeValue.js";
import { stringifyObjectForRender } from "./stringifyObjectForRender.js";
import { makeDynamicRenderStringContent } from "./makeDynamicRenderStringContent.js";

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
 * @param {TmphNode} node
 * @param {Record<string, string>} imports
 * @param {Meta} meta
 * @returns {Promise<string>}
 */
export async function convertNodeToRenderString(node, imports, meta) {
  let tagName = node.tagName;

  if (!tagName) {
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

  /** @type {Record<string, string> | null} */
  let dynamicAttributes = null;

  if (node.attributes) {
    for (
      let i = 0, attributesLength = node.attributes.length;
      i < attributesLength;
      i += 2
    ) {
      let attributeName = /** @type {string} */ (node.attributes[i]);
      const attributeValue = node.attributes[i + 1];

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
          if (typeof attributeValue !== "string") {
            console.warn(
              `${meta.sourceFilePath}: Received #tagname attribute without a tag name expression.`
            );
            break;
          }

          const { expressionCode, isAsync } =
            makeDynamicRenderStringContent(attributeValue);
          meta.isAsync = meta.isAsync || isAsync;

          tagName = `\$\{${expressionCode} ?? "${tagName}"\}`;
          break;
        }
        case "#attr": {
          /**
           * #attr:attrName="expression"
           * attributeModifier is the attribute name
           * attributeValue is the expression which should be evaluated to the attribute's value
           */
          if (typeof attributeValue !== "string") {
            // If the attribute doesn't have a value, just set it as a static boolean attribute
            staticAttributes ??= {};
            staticAttributes[attributeModifier] = true;
            console.warn(
              `${meta.sourceFilePath}: Received #attr:${attributeModifier} without an attribute value expression.`
            );
            break;
          }

          const { expressionCode, isAsync } =
            makeDynamicRenderStringContent(attributeValue);
          meta.isAsync = meta.isAsync || isAsync;

          dynamicAttributes ??= {};

          // Attribute spreading syntax means the attribute value should be an object
          // and we should spread the object's properties into the element's attributes
          if (attributeModifier === "...") {
            const resultVariableName = `__tmph_result_${getRandomString()}`;
            dynamicAttributes["..."] = `${isAsync ? "await (async " : "("}()=>{
              const ${resultVariableName} = ${expressionCode};
              if(typeof ${resultVariableName} !== "object") {
                console.warn(\`Attempted to spread non-object value \$\{${resultVariableName}\} onto element attributes\`);
                return {};
              }
              return ${resultVariableName};
            })()`;
          } else {
            dynamicAttributes[attributeModifier] = expressionCode;
          }

          break;
        }
        case "#text": {
          /**
           * #text="expression"
           * attributeValue is the expression which should be evaluated to an escaped string which will
           * replace the element's children.
           */
          if (typeof attributeValue !== "string") {
            console.warn(
              `${meta.sourceFilePath}: Received #text attribute without an expression value`
            );
            continue;
          }

          const { expressionCode, isAsync } =
            makeDynamicRenderStringContent(attributeValue);
          meta.isAsync = meta.isAsync || isAsync;

          imports.escapeText = "#tmph/render/escapeText.js";

          if (!node.children || node.children.length === 0) {
            node.children = Object.preventExtensions([
              `\$\{escapeText(${expressionCode})\}`,
            ]);
          } else {
            node.children.splice(
              0,
              node.children.length,
              `\$\{escapeText(${expressionCode})\}`
            );
          }

          break;
        }
        case "#html": {
          /**
           * #html="expression"
           * attributeValue is the expression which should be evaluated to an HTML content string which will
           * replace the element's children without being escaped.
           */
          if (typeof attributeValue !== "string") {
            console.warn(
              `${meta.sourceFilePath}: Received #html attribute without an expression value`
            );
            break;
          }

          const { expressionCode, isAsync } =
            makeDynamicRenderStringContent(attributeValue);
          meta.isAsync = meta.isAsync || isAsync;

          imports.html = "#tmph/render/html.js";

          if (!node.children || node.children.length === 0) {
            node.children = Object.preventExtensions([
              `\$\{html(${expressionCode})\}`,
            ]);
          } else {
            node.children.splice(
              0,
              node.children.length,
              `\$\{html(${expressionCode})\}`
            );
          }

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
    meta.componentImports && tagName in meta.componentImports;
  const isInlineComponent =
    !isImportedComponent &&
    meta.inlineComponents &&
    tagName in meta.inlineComponents;

  if (isImportedComponent || isInlineComponent) {
    const componentMeta = isImportedComponent
      ? meta.componentImports?.[tagName].meta
      : meta.inlineComponents?.[tagName].meta;

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
              convertNodeToRenderString(child, imports, meta)
            );
          } else {
            (defaultSlotContent ??= []).push(
              convertNodeToRenderString(child, imports, meta)
            );
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
        // Make sure the name is quoted to support - and _ characters
        stringifiedNamedSlots += `"${slotName}": \`${(
          await Promise.all(namedSlots[slotName])
        ).join("\n")}\`,`;
      }
      stringifiedNamedSlots += "}";
    } else {
      stringifiedNamedSlots = "null";
    }

    /**
     * @type {{
     *  props?: string;
     *  slot?: string;
     *  namedSlots?: string;
     * }}
     */
    const renderParams = {};

    if (propsString) {
      renderParams.props = `{${propsString}}`;
    }

    if (defaultSlotString) {
      renderParams.slot = `\`${defaultSlotString}\``;
    }

    if (namedSlots) {
      renderParams.namedSlots = stringifiedNamedSlots;
    }

    renderedElement = `\$\{${
      componentMeta?.isAsync ? "await" : ""
    }${tagName}.render(${stringifyObjectForRender(renderParams)})\}`;
  } else {
    const isFragment = tagName === "_";

    if (!isFragment) {
      let attributesString = "";

      for (const attributeName in staticAttributes) {
        attributesString += await renderHTMLAttribute(
          attributeName,
          staticAttributes[attributeName]
        );
      }

      for (const attributeName in dynamicAttributes) {
        imports.renderAttributeToString = "#tmph/render/renderAttributes.js";

        const attributeValue = dynamicAttributes[attributeName];
        const isAsync = attributeValue.startsWith("await");

        if (attributeName === "...") {
          const valueName = `__tmph_value_${getRandomString()}`;
          const keyName = `__tmph_key_${getRandomString()}`;
          const resultName = `__tmph_result_${getRandomString()}`;

          attributesString += `\$\{${isAsync ? "await (async " : "("}()=> {
            let ${resultName} = "";

            const ${valueName} = ${attributeValue};
            for(const ${keyName} in ${valueName}){
              ${resultName} += \` \$\{renderAttributeToString(${keyName}, ${valueName}[${keyName}])\}\`;
            }
            return ${resultName};
          })()\}`;
        } else {
          attributesString += `\$\{renderAttributeToString(
            "${attributeName}",
            ${dynamicAttributes[attributeName]},
          )\}`;
        }
      }

      renderedElement = `<${tagName}${attributesString}>`;
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
              convertNodeToRenderString(child, imports, meta).then(
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
      const isVoid = tagName in voidTagNames;

      if (!isVoid || Boolean(childrenString)) {
        if (isVoid) {
          console.warn(
            `Void tag <${tagName}> unexpectedly received child content`
          );
        }
        renderedElement += `</${tagName}>`;
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

          const { expressionCode, isAsync } = makeDynamicRenderStringContent(
            attribute.value
          );
          meta.isAsync = meta.isAsync || isAsync;

          renderedElement = `\$\{${isAsync ? "await (async " : "("}()=>{
            let ${attribute.modifier} = ${expressionCode};
            return \`${renderedElement}\`;
          })()\}`;
          break;
        }
        case "#if": {
          const { expressionCode, isAsync } = makeDynamicRenderStringContent(
            attribute.value
          );
          meta.isAsync = meta.isAsync || isAsync;

          renderedElement = `\$\{${expressionCode} ? \`${renderedElement}\` : ""\}`;
          break;
        }
        case "#for": {
          const { expressionCode, isAsync } = makeDynamicRenderStringContent(
            attribute.value
          );
          meta.isAsync = meta.isAsync || isAsync;

          const itemListVariableName = `__tmph_items_${getRandomString()}`;

          const [
            itemName = `__tmph_item_${getRandomString()}`,
            indexName = `__tmph_index_${getRandomString()}`,
          ] = attribute.modifier.split(",");

          const renderStringVariableName = `__tmph_render_${getRandomString()}`;

          renderedElement = `\$\{${isAsync ? "await (async " : "("}()=> {
                const ${itemListVariableName} = ${expressionCode};
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
          const { expressionCode, isAsync } = makeDynamicRenderStringContent(
            attribute.value
          );
          meta.isAsync = meta.isAsync || isAsync;

          const itemListVariableName = `__tmph_items_${getRandomString()}`;

          const itemName =
            attribute.modifier || `__tmph_item_${getRandomString()}`;

          imports.renderForRange = "#tmph/render/renderForRange.js";

          renderedElement = `\$\{${isAsync ? "await (async " : "("}()=> {
                const ${itemListVariableName} = ${expressionCode};
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
}
