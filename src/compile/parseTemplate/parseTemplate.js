import { LexerTokenType, lex } from "./lexer.js";

/** @typedef {import("./templateData").TmphElementAttribute} TmphElementAttribute */
/** @typedef {import("./templateData").TmphElementNode} TmphElementNode */
/** @typedef {import("./templateData").TmphTextNode} TmphTextNode */
/** @typedef {import("./templateData").TmphNode} TmphNode */
/** @typedef {import("./templateData").TemplateDataAST} TemplateDataAST */

/**
 * Takes the path to a .tmph.html file and parses it into a JSON object
 * that can be used by the compiler.
 * @param {string} filePath
 * @returns {Promise<TemplateDataAST | Error>}
 */
export async function parseTemplate(filePath) {
  /**
   * @type {TemplateDataAST}
   */
  const templateData = {
    src: filePath,
    nodes: [],
  };

  /**
   * @type {Map<TmphElementNode, TmphElementNode | null>}
   */
  const nodeParentMap = new Map();

  /**
   * @type {TmphElementNode | null}
   */
  let currentOpenRootElementNode = null;

  /**
   * @type {TmphElementNode | null}
   */
  let currentOpenLeafElementNode = null;

  for await (const token of lex(filePath)) {
    switch (token.type) {
      case LexerTokenType.EOF: {
        if (currentOpenRootElementNode !== null) {
          templateData.nodes.push(currentOpenRootElementNode);
        }
        break;
      }
      case LexerTokenType.ERROR: {
        return new Error(token.value);
      }
      case LexerTokenType.TEXT_CONTENT: {
        if (!token.value) {
          break;
        }

        /**
         * @type {TmphTextNode}
         */
        const textNode = {
          textContent: token.value,
          l: token.l,
          c: token.c,
        };
        if (currentOpenLeafElementNode) {
          const previousNode = currentOpenLeafElementNode.children?.at(-1);
          if (previousNode && "textContent" in previousNode) {
            previousNode.textContent += textNode.textContent;
          } else {
            (currentOpenLeafElementNode.children ??= []).push(textNode);
          }
        } else {
          const previousNode = templateData.nodes.at(-1);
          if (previousNode && "textContent" in previousNode) {
            // Merge into the previous text node if it exists
            previousNode.textContent += textNode.textContent;
          } else {
            // Append text node to the root if there's no open parent node
            templateData.nodes.push(textNode);
          }
        }
        break;
      }
      case LexerTokenType.OPENING_TAGNAME: {
        /**
         * @type {TmphElementNode}
         */
        const elementNode = {
          tagName: token.value,
          l: token.l,
          c: token.c,
        };

        if (!currentOpenRootElementNode) {
          currentOpenRootElementNode = currentOpenLeafElementNode = elementNode;
          break;
        }

        if (!currentOpenLeafElementNode) {
          return new Error(
            `${filePath}:${token.l}:${token.c} Encountered unexpected opening tag: ${token.value}`
          );
        }

        (currentOpenLeafElementNode.children ??= []).push(elementNode);
        nodeParentMap.set(elementNode, currentOpenLeafElementNode);
        currentOpenLeafElementNode = elementNode;
        break;
      }
      case LexerTokenType.ATTRIBUTE_NAME: {
        if (currentOpenLeafElementNode) {
          (currentOpenLeafElementNode.attributes ??= []).push({
            name: token.value,
            l: token.l,
            c: token.c,
            value: "",
          });
        }
        break;
      }
      case LexerTokenType.ATTRIBUTE_VALUE: {
        if (
          currentOpenLeafElementNode &&
          currentOpenLeafElementNode.attributes
        ) {
          const lastAttribute =
            currentOpenLeafElementNode.attributes[
              currentOpenLeafElementNode.attributes.length - 1
            ];
          if (lastAttribute) {
            lastAttribute.value = token.value;
          }
        }
        break;
      }
      case LexerTokenType.SELF_CLOSING_TAG_END: {
        if (!currentOpenLeafElementNode) {
          break;
        }

        if (currentOpenLeafElementNode === currentOpenRootElementNode) {
          templateData.nodes.push(currentOpenRootElementNode);
          currentOpenRootElementNode = currentOpenLeafElementNode = null;
        } else {
          /** @type {TmphElementNode | null} */
          const parentNode =
            nodeParentMap.get(currentOpenLeafElementNode) ?? null;
          nodeParentMap.delete(currentOpenLeafElementNode);

          currentOpenLeafElementNode = parentNode;
        }
        break;
      }
      case LexerTokenType.CLOSING_TAGNAME: {
        const closedTagname = token.value;

        if (!currentOpenLeafElementNode) {
          return new Error(
            `${filePath}:${token.l}:${token.c} Encountered unexpected closing tag: ${closedTagname}`
          );
        }

        /**
         * @type {TmphElementNode | null}
         */
        let closedNode = currentOpenLeafElementNode;

        while (closedNode && closedNode.tagName !== closedTagname) {
          closedNode = nodeParentMap.get(closedNode) ?? null;
        }

        if (!closedNode) {
          return new Error(
            `${filePath}:${token.l}:${token.c} Encountered unexpected closing tag: ${closedTagname}`
          );
        }

        if (closedNode === currentOpenRootElementNode) {
          templateData.nodes.push(closedNode);
          currentOpenRootElementNode = currentOpenLeafElementNode = null;
        } else {
          currentOpenLeafElementNode = nodeParentMap.get(closedNode) ?? null;
        }

        nodeParentMap.delete(closedNode);
        break;
      }
    }
  }

  nodeParentMap.clear();

  return templateData;
}
