import md from "../render/md.js";
import { deepFreeze } from "../utils/deepFreeze.js";
import { stringifyObjectForRender } from "./stringifyObjectForRender.js";
import { makeDynamicRenderStringContent } from "./makeDynamicRenderStringContent.js";
import { isTmphElementNode } from "./types.js";

/** @typedef {import("./types.js").TmphElementNode} TmphElementNode */
/** @typedef {import("./types.js").TmphTextNode} TmphTextNode */

// HTML tag names that don't have closing tags
const voidTagNames = Object.freeze({
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
});

/**
 * @param {TmphTextNode|TmphElementNode} node
 * @param {Record<string, string>} imports
 * @param {import("./types.js").TmphTemplateData} templateData
 * @returns {Promise<string>}
 */
export async function convertNodeToRenderString(node, imports, templateData) {
  if (!isTmphElementNode(node)) {
    return node.textContent;
  }

  let scopeLevel = 0;

  /** @type {Array<string>} */
  let scopeSetupLogic = ['let __tmph__renderedHTML = "";'];

  let scopePrefixes = [""];
  let scopePostfixes = [""];

  const addScope = (
    scopePrefix = "return await (async ()=>{",
    scopePostfix = "})()"
  ) => {
    ++scopeLevel;
    scopeSetupLogic.push("");
    scopePrefixes.push(scopePrefix);
    scopePostfixes.push(scopePostfix);
  };

  /**
   * @param {string} logicSnippet
   */
  const addSetupLogic = (logicSnippet) => {
    scopeSetupLogic[scopeLevel] += logicSnippet;
  };

  let tagName = node.tagName;

  const isInlineComponent =
    templateData.inlineComponents && tagName in templateData.inlineComponents;
  const isImportedComponent =
    !isInlineComponent &&
    templateData.componentImports &&
    tagName in templateData.componentImports;

  const isComponent = isInlineComponent || isImportedComponent;

  let children = node.children;

  /**
   * @type {Array<{ name: "#if" | "#for" | "#for-range" | "#with"; modifier: string; value: string; }> | null}
   * Render attributes which involve creating a new block scope, ie #if, #for, #for-range, and #with
   * The order of these attributes is important, so we need to gather them in an array and then evaluate them
   * in reverse order so the innermost scope is evaluated first.
   */
  let scopedRenderAttributes = null;
  let shouldParseChildrenAsMarkdown = false;

  /** @type {Record<string, string>} */
  const attributes = {};

  if (node.staticAttributes) {
    for (const attribute of node.staticAttributes) {
      attributes[attribute.name] = attribute.value ?? "";

      // renderedAttributesString += ` ${attribute.name}${
      //   attribute.value ? `="${attribute.value}"` : ""
      // }`;
    }
  }

  if (node.renderAttributes) {
    for (
      let i = 0, attrLength = node.renderAttributes.length;
      i < attrLength;
      ++i
    ) {
      const attribute = node.renderAttributes[i];

      if (attribute.name === "#") {
        // Skip comment attributes
        continue;
      }

      switch (attribute.name) {
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
          if (!attribute.expressionValue) {
            console.warn(
              `Received #tagname attribute without a tag name expression. ${templateData.sourceFilePath}:${attribute.position}`
            );
            break;
          }

          const variableName = `__tmph__tagname__${i}`;

          addSetupLogic(
            makeDynamicRenderStringContent(
              variableName,
              attribute.expressionValue
            )
          );

          tagName = `\$\{${variableName} ?? "${tagName}"\}`;
          break;
        }
        case "#attr": {
          /**
           * #attr:attrName="expression"
           * attribute.modifier is the attribute name
           * attribute.expressionValue is the expression which should be evaluated to the attribute's value
           */
          const { modifier, expressionValue, position } = attribute;

          if (!modifier) {
            console.error(
              `Recieved #attr attribute without an attribute name. ${templateData.sourceFilePath}:${position}`
            );
            break;
          }

          if (!expressionValue) {
            // If the attribute doesn't have a value, just set as a static boolean attribute
            attributes[modifier] = "";
            console.warn(
              `Received #attr:${attribute.modifier} without an attribute value expression. ${templateData.sourceFilePath}:${position}`
            );
            break;
          }

          const variableName =
            modifier === "..."
              ? `__tmph__spreadableAttr__${i}`
              : `__tmph__attr_${modifier}__${i}`;

          addSetupLogic(
            makeDynamicRenderStringContent(variableName, expressionValue)
          );

          if (isComponent) {
            attributes[modifier] = variableName;
          } else {
            attributes[modifier] = `\${${variableName}}`;
          }

          break;
        }
        case "#text": {
          /**
           * #text="expression"
           * attributeValue is the expression which should be evaluated to an escaped string which will
           * replace the element's children.
           */
          const { expressionValue, position } = attribute;
          if (!expressionValue) {
            console.error(
              `Recieved #text attribute without an expression value. ${templateData.sourceFilePath}:${position}`
            );
            break;
          }

          const variableName = `__tmph__text__${i}`;

          imports.escapeText = "#tmph/render/escapeText.js";

          addSetupLogic(
            makeDynamicRenderStringContent(
              variableName,
              `
${makeDynamicRenderStringContent("__tmph__unescapedText", expressionValue)}
return escapeText(__tmph__unescapedText);
            `
            )
          );

          children = deepFreeze([
            {
              textContent: `\${${variableName}}`,
              position: attribute.position,
            },
          ]);
        }
        case "#html": {
          /**
           * #html="expression"
           * attributeValue is the expression which should be evaluated to an HTML content string which will
           * replace the element's children without being escaped.
           */
          const { expressionValue, position } = attribute;
          if (!expressionValue) {
            console.error(
              `Recieved #html attribute without an expression value. ${templateData.sourceFilePath}:${position}`
            );
            break;
          }

          const variableName = `__tmph__html__${i}`;

          addSetupLogic(
            makeDynamicRenderStringContent(variableName, expressionValue)
          );

          children = deepFreeze([
            {
              textContent: `\${${variableName}}`,
              position: attribute.position,
            },
          ]);

          break;
        }
        case "#if": {
          const { expressionValue, position } = attribute;

          if (!expressionValue) {
            console.error(
              `Received #if attribute without an expression value ${templateData.sourceFilePath}:${position}`
            );
            break;
          }

          const variableName = `__tmph__ifCondition__${i}`;

          addSetupLogic(
            `
${makeDynamicRenderStringContent(variableName, expressionValue)}
if(!${variableName}) {
  return "";
}
`
          );
          break;
        }
        case "#with": {
          const { modifier, expressionValue, position } = attribute;

          if (!modifier) {
            console.error(
              `Received #with attribute without a variable name modifier ${templateData.sourceFilePath}:${position}`
            );
            break;
          }

          if (!expressionValue) {
            console.error(
              `Received #with attribute without an expression value ${templateData.sourceFilePath}:${position}`
            );
            break;
          }

          addSetupLogic(
            makeDynamicRenderStringContent(modifier, expressionValue)
          );
        }
        case "#for": {
          const {
            modifier = `__tmph__forItemValue__${i}`,
            expressionValue,
            position,
          } = attribute;

          if (!expressionValue) {
            console.error(
              `Received #for attribute without an expression value ${templateData.sourceFilePath}:${position}`
            );
            break;
          }

          const [
            itemValueVariableName,
            itemIndexVariableName = `__tmph__forItemIndex__${i}`,
          ] = modifier.split(",");

          const itemIterableVariableName = `__tmph__forItemIterable__${i}`;

          addSetupLogic(
            makeDynamicRenderStringContent(
              itemIterableVariableName,
              expressionValue
            )
          );

          const itemPromisesVariableName = `__tmph__forItemPromises__${i}`;
          addSetupLogic(`const ${itemPromisesVariableName} = [];`);

          const forHTMLVariableName = `__tmph__forHTML__${i}`;

          addScope(
            `
for(const ${itemValueVariableName} of ${itemIterableVariableName}) {
  ${itemPromisesVariableName}.push((async () => {
          `,
            `
  })());
  ${itemIndexVariableName}++;
}

const results = await Promise.allSettled(${itemPromisesVariableName});
let ${forHTMLVariableName} = "";
for(const result of results) {
  if(result.status === "fulfilled") {
    ${forHTMLVariableName} += result.value;
  } else {
    console.error("An error occurred inside #for loop ${templateData.sourceFilePath}:${position}", result.reason);
  }
}
return ${forHTMLVariableName};
`
          );
        }
        case "#for-range": {
          const {
            modifier = `__tmph__forRangeIndex__${i}`,
            expressionValue,
            position,
          } = attribute;

          if (!expressionValue) {
            console.error(
              `Received #for-range attribute without an expression value ${templateData.sourceFilePath}:${position}`
            );
            break;
          }

          const itemIterableVariableName = `__tmph__forItemIterable__${i}`;

          imports.renderForRange = "#tmph/render/renderForRange.js";

          addSetupLogic(
            makeDynamicRenderStringContent(
              itemIterableVariableName,
              expressionValue
            )
          );

          addScope(
            `return renderForRange(${itemIterableVariableName}, async (${modifier}) => {\n`,
            `\n});`
          );
        }
        default:
      }
    }
  }

  let renderedElement = "";

  if (isComponent) {
    let propsString = "";

    for (const attributeName in attributes) {
      if (attributeName === "...") {
        propsString += `...${JSON.stringify(attributes[attributeName])},`;
      } else {
        propsString += `${attributeName}: ${JSON.stringify(
          attributes[attributeName]
        )},`;
      }
    }

    /** @type {Array<string|Promise<string>> | null} */
    let defaultSlotContent = null;
    /** @type {Record<string, Promise<string>[]> | null} */
    let namedSlots = null;

    if (children) {
      for (const child of children) {
        if (typeof child === "string") {
          (defaultSlotContent ??= []).push(child);
        } else {
          if (attributes.slot) {
            const slotName = attributes.slot;
            // Delete the slot attribute so it doesn't get rendered
            delete attributes.slot;
            ((namedSlots ??= {})[slotName] ??= []).push(
              convertNodeToRenderString(child, imports, templateData)
            );
          } else {
            (defaultSlotContent ??= []).push(
              convertNodeToRenderString(child, imports, templateData)
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

    renderedElement = `\$\{await ${tagName}.render(${stringifyObjectForRender(
      renderParams
    )})\}`;
  } else {
    const isFragment = tagName === "_";

    if (!isFragment) {
      let attributesString = "";

      for (const attributeName in attributes) {
        if (attributeName === "...") {
          const spreadableObjectVariableName = attributes[attributeName];
          const variableName = `${spreadableObjectVariableName}_attrString`;
          addSetupLogic(`
let ${variableName} = "";
for(const __tmph__spreadAttrName in ${spreadableObjectVariableName}) {
  ${variableName} += \` \${__tmph__spreadAttrName}\${
    ${spreadableObjectVariableName} ? "" :
    \\\`="\${${spreadableObjectVariableName}[\${__tmph__spreadAttrName}]
  }"\\\`\`
}
`);
        } else {
          attributesString += ` ${attributeName}${
            attributes[attributeName] ? "" : `="${attributes[attributeName]}"`
          }`;
        }
      }

      renderedElement = `<${tagName}${attributesString}>`;
    }

    /** @type {string} */
    let childrenString = "";

    if (children) {
      const childCount = children.length;
      /** @type {Array<string | Promise<string>>} */
      const childRenderPromises = new Array(childCount);

      for (let i = 0; i < childCount; ++i) {
        const child = children[i];

        if (typeof child === "string") {
          childRenderPromises[i] = child;
        } else {
          if ("tagName" in child && child.tagName === "slot") {
            const slotName = child.staticAttributes?.find(
              (attr) => attr.name === "name"
            )?.value;
            if (slotName) {
              childRenderPromises[i] = `\$\{namedSlots?.${slotName} ?? ""\}`;
            } else {
              childRenderPromises[i] = `\$\{slot ?? ""\}`;
            }
          } else {
            childRenderPromises[i] = convertNodeToRenderString(
              child,
              imports,
              templateData
            );
          }
        }
      }

      childrenString = (await Promise.all(childRenderPromises)).join("");
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

  let renderString = renderedElement;

  for (let i = scopeLevel; i >= 0; --i) {
    renderString =
      scopePrefixes[i] + scopeSetupLogic[i] + renderString + scopePostfixes[i];
  }

  return renderString;
}
