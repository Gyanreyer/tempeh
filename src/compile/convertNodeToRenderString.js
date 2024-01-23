import { parseDynamicAttributeContent } from "./makeDynamicRenderStringContent.js";
import renderHTMLAttribute from "../render/renderAttributes.js";
import { TmphNode } from "../template-parser/pb/gen/js/template-data_pb.js";

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
 * @param {TmphNode} node
 * @param {Record<string, string>} imports
 * @param {{
 *  sourceFilePath: string;
 * }} templateData
 * @returns {{ renderString: string; type: "static-html" | "dynamic-html" | "text" }}
 */
export function convertNodeToRenderString(node, imports, templateData) {
  if (node.textContent) {
    return { renderString: node.textContent, type: "text" };
  }

  let attributeString = "";
  let tagName = node.tagName;

  /** @type {TmphNode[] | null} */
  let childNodes = node.childNodes;
  let childString = "";

  let shouldParseChildrenAsMarkdown = false;

  /**
   * Array of callbacks which will wrap the rendered content in a new scope.
   * This is necessary for #if and #for attributes which impact what/how content is rendered.
   * @type {Array<(childScope: string) => string>}
   */
  const renderConditionScopeGenerators = [];

  let hasDynamicContent = false;

  let attributeIndex = -1;
  for (const attribute of node.attributes) {
    ++attributeIndex;

    let [attrName, ...attrModifiers] = attribute.name.split(":");

    if (!attrName) {
      if (attrModifiers.length > 0) {
        attrName = "#attr";
      } else {
        continue;
      }
    }

    const attrValue = attribute.value.trim();

    const attrLine = attribute.line;
    const attrColumn = attribute.column;

    let isDynamicAttribute = true;

    switch (attrName) {
      case "#": {
        // Skip comment attributes
        break;
      }
      case "#md": {
        imports.md = "tmph/render/md.js";
        shouldParseChildrenAsMarkdown = true;
        break;
      }
      case "#tagname": {
        if (!attrValue) {
          console.error(
            `${templateData.sourceFilePath}:${attrLine}:${attrColumn} - Error: Received #tagname attribute without a value.`
          );
        }

        const { setupExpressionLines, lastExpressionLine, isAsync } =
          parseDynamicAttributeContent(attrValue);

        tagName = `\${(${isAsync ? "async " : ""}() => {
          ${setupExpressionLines}
          return (${lastExpressionLine});
        })()}`;
        break;
      }
      case "#text": {
        imports.escapeText = "tmph/render/escapeText.js";
        const { setupExpressionLines, lastExpressionLine, isAsync } =
          parseDynamicAttributeContent(attrValue);

        childNodes = null;
        childString = `\${(${isAsync ? "async " : ""}() => {
              ${setupExpressionLines}
              return escapeText(${lastExpressionLine});
            })()}`;
        break;
      }
      case "#html": {
        const { setupExpressionLines, lastExpressionLine, isAsync } =
          parseDynamicAttributeContent(attrValue);

        childNodes = null;
        childString = `\${(${isAsync ? "async " : ""}() => {
              ${setupExpressionLines}
              return (${lastExpressionLine});
            })()}`;
        break;
      }
      case "#if": {
        if (!attrValue) {
          console.error(
            `${templateData.sourceFilePath}:${attrLine}:${attrColumn} - Error: Received #if attribute without an expression value.`
          );
          break;
        }

        renderConditionScopeGenerators.push((nestedContent) => {
          const { setupExpressionLines, lastExpressionLine } =
            parseDynamicAttributeContent(attrValue);

          return /* JS */ `(() => {
  ${setupExpressionLines}
  if(!(${lastExpressionLine})) {
      return null;
  }
  return ${nestedContent};
})()`;
        });
        break;
      }
      case "#for-of": {
        if (!attrValue) {
          console.error(
            `${templateData.sourceFilePath}:${attrLine}:${attrColumn} - Error: Received #for attribute without an expression value.`
          );
          break;
        }

        const [variableModifier = ""] = attrModifiers;
        let [itemVariableName, indexVariableName] = variableModifier.split(",");

        if (!itemVariableName) {
          itemVariableName = `__TMPH__for${attributeIndex}__item`;
        }

        const iterableVariableName = `__TMPH__for${attributeIndex}__iterable`;

        renderConditionScopeGenerators.push((nestedContent) => {
          const { setupExpressionLines, lastExpressionLine } =
            parseDynamicAttributeContent(attrValue);

          return /* JS */ `(async function* () {
  ${setupExpressionLines}
  const ${iterableVariableName} = (${lastExpressionLine});
  ${indexVariableName ? /* JS */ `let ${indexVariableName} = 0;` : ""}

  for (const ${itemVariableName} of ${iterableVariableName}) {
    yield ${nestedContent};
    ${indexVariableName ? /* JS */ `++${indexVariableName};` : ""}
  }
})()`;
        });
        break;
      }
      case "#for-count": {
        if (!attrValue) {
          console.error(
            `${templateData.sourceFilePath}:${attrLine}:${attrColumn} - Error: Received #for attribute without an expression value.`
          );
          break;
        }

        let [iterationIndexVarName] = attrModifiers;
        if (!iterationIndexVarName) {
          iterationIndexVarName = `__TMPH__for${attributeIndex}__index`;
        }

        const iterationCountVarName = `__TMPH__for${attributeIndex}__count`;

        renderConditionScopeGenerators.push((nestedContent) => {
          const { setupExpressionLines, lastExpressionLine, isAsync } =
            parseDynamicAttributeContent(attrValue);

          return /* JS */ `(${isAsync ? "async " : ""}function* () {
  ${setupExpressionLines}
  const ${iterationCountVarName} = (${lastExpressionLine});
  for (let ${iterationIndexVarName} = 0; ${iterationIndexVarName} < ${iterationCountVarName}; ++${iterationIndexVarName}) {
    yield ${nestedContent};
  }
})()`;
        });
        break;
      }
      case "#for": {
        renderConditionScopeGenerators.push((nestedContent) => {
          const { setupExpressionLines, lastExpressionLine, isAsync } =
            parseDynamicAttributeContent(attrValue);

          return /* JS */ `(function* () {
  for (${attrValue}) {
    yield ${nestedContent};
  }
})()`;
        });
      }
      case "#let": {
        const variableName = attrModifiers[0];
        if (!variableName) {
          console.error(
            `${templateData.sourceFilePath}:${attrLine}:${attrColumn} - Error: Received #let attribute without a variable name.`
          );
          break;
        }

        renderConditionScopeGenerators.push((nestedContent) => {
          if (attrValue) {
            const { setupExpressionLines, lastExpressionLine, isAsync } =
              parseDynamicAttributeContent(attrValue);

            return /* JS */ `(${isAsync ? "async " : ""}() => {
  ${setupExpressionLines}
  let ${variableName} = (${lastExpressionLine});

  return ${nestedContent};
})()`;
          } else {
            return /* JS */ `(() => {
  let ${variableName};

  return ${nestedContent};
})()`;
          }
        });

        break;
      }
      case "#attr": {
        const dynamicAttributeName = attrModifiers[0];
        if (!dynamicAttributeName) {
          console.error(
            `${templateData.sourceFilePath}:${attrLine}:${attrColumn} - Error: Received ${attribute.name} attribute without a name for the attribute to set on the element.`
          );
          break;
        }

        if (!attrValue) {
          // If the attribute doesn't have a value, just set as a static boolean attribute
          console.warn(
            `${templateData.sourceFilePath}:${attrLine}:${attrColumn} - Warning: Received ${attribute.name} attribute without an attribute value. This is equivalent to just directly setting a ${dynamicAttributeName} attribute.`
          );
          attributeString += ` ${dynamicAttributeName}`;
          break;
        }

        // Add renderHTMLAttribute to dependencies as this is needed to safely render dynamic attributes
        imports.renderHTMLAttribute = "tmph/render/renderAttributes.js";

        const { setupExpressionLines, lastExpressionLine, isAsync } =
          parseDynamicAttributeContent(attrValue);

        if (dynamicAttributeName === "...") {
          const spreadableObjectVarName = `__tmph__attr${attributeIndex}__spreadable`;
          const spreadAttrKeyVarName = `__tmph__attr${attributeIndex}__spreadableKey`;

          attributeString += /* JS */ ` \${${
            isAsync ? "async " : ""
          }function *() {
  ${setupExpressionLines}
  const ${spreadableObjectVarName} = (${lastExpressionLine});

  for(const ${spreadAttrKeyVarName} in ${spreadableObjectVarName}) {
    yield renderHTMLAttribute(${spreadAttrKeyVarName}, ${spreadableObjectVarName}[${spreadAttrKeyVarName}]);
  }
}}`;
        } else {
          attributeString += /* JS */ `\${(${isAsync ? "async" : ""}() => {
  ${setupExpressionLines}
  return renderHTMLAttribute("${dynamicAttributeName}", (${lastExpressionLine}));
})()}`;
        }

        break;
      }
      default: {
        isDynamicAttribute = false;
        attributeString += renderHTMLAttribute(attrName, attrValue);
        break;
      }
    }

    if (isDynamicAttribute) {
      hasDynamicContent = true;
    }
  }

  const isSlot = tagName === "slot";
  const isFragment = isSlot || tagName === "_";

  if (isSlot) {
    hasDynamicContent = true;
  }

  let renderString = "";

  if (hasDynamicContent) {
    renderString += "html`";
  }

  if (!isFragment) {
    renderString += `<${tagName}${attributeString}>`;
  }

  if (childNodes) {
    for (const child of childNodes) {
      const { renderString: childRenderString, type: childType } =
        convertNodeToRenderString(child, imports, templateData);

      if (childType === "dynamic-html") {
        renderString += `\${${childRenderString}}`;
      } else {
        renderString += childRenderString;
      }
    }
  }

  if (!(tagName in voidTagNames)) {
    renderString += childString;
    if (!isFragment) {
      renderString += `</${tagName}>`;
    }
  } else if (childString) {
    console.warn(
      `${templateData.sourceFilePath}:${node.line}:${node.column} - Warning: Received void tag ${tagName} with child content. This child content will be ignored.`
    );
  }

  // TODO: add component definition and import handling
  // TODO: add style and script handling
  // TODO: style attribute merging?

  if (hasDynamicContent) {
    renderString += "`";
  }

  if (isSlot) {
    const slotName = node.attributes.find(
      (attr) => attr.name === "name"
    )?.value;

    if (slotName) {
      renderString = /* JS */ `namedSlots?.${slotName} ?? ${renderString}`;
    } else {
      renderString = /* JS */ `slot ?? ${renderString}`;
    }
  }

  for (let i = renderConditionScopeGenerators.length - 1; i >= 0; --i) {
    const generator = renderConditionScopeGenerators[i];
    if (generator) {
      renderString = generator(renderString);
    }
  }

  if (shouldParseChildrenAsMarkdown) {
    renderString = /* JS */ `await md(${renderString})`;
  }

  return {
    renderString,
    type: hasDynamicContent ? "dynamic-html" : "static-html",
  };
}
