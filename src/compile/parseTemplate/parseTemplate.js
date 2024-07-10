import { LexerTokenType, lex } from "./lexer.js";

/**
 * @import { TmphElementNode, TmphTextNode, TmphNode } from "./templateData";
 */

/**
 * Takes the path to a .tmph.html file and parses it into a JSON object
 * that can be used by the compiler.
 * @param {string} filePath
 * @returns {AsyncGenerator<TmphNode | Error, void>}
 */
export async function* parseTemplate(filePath) {
  /**
   * @type {Map<TmphElementNode, TmphElementNode | null>}
   */
  const nodeParentMap = new Map();

  try {
    /**
     * @type {TmphNode | null}
     */
    let currentOpenRootNode = null;

    /**
     * @type {TmphElementNode | null}
     */
    let currentOpenLeafElementNode = null;

    for await (const token of lex(filePath)) {
      switch (token.type) {
        case LexerTokenType.EOF: {
          if (currentOpenRootNode !== null) {
            yield currentOpenRootNode;
            currentOpenRootNode = currentOpenLeafElementNode = null;
          }
          break;
        }
        case LexerTokenType.ERROR: {
          yield new Error(token.value);
          return;
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
          } else if (
            currentOpenRootNode &&
            "textContent" in currentOpenRootNode
          ) {
            // Merge into the previous text node if it exists
            currentOpenRootNode.textContent += textNode.textContent;
          } else {
            currentOpenRootNode = textNode;
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

          if (currentOpenRootNode && "textContent" in currentOpenRootNode) {
            yield currentOpenRootNode;
            currentOpenRootNode = null;
          }

          if (!currentOpenRootNode) {
            currentOpenRootNode = currentOpenLeafElementNode = elementNode;
            break;
          }

          if (!currentOpenLeafElementNode) {
            yield new Error(
              `${filePath}:${token.l}:${token.c} Encountered unexpected opening tag: ${token.value}`
            );
            return;
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

          if (currentOpenLeafElementNode === currentOpenRootNode) {
            yield currentOpenRootNode;
            currentOpenRootNode = currentOpenLeafElementNode = null;
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
            yield new Error(
              `${filePath}:${token.l}:${token.c} Encountered unexpected closing tag: ${closedTagname}`
            );
            return;
          }

          /**
           * @type {TmphElementNode | null}
           */
          let closedNode = currentOpenLeafElementNode;

          while (closedNode && closedNode.tagName !== closedTagname) {
            closedNode = nodeParentMap.get(closedNode) ?? null;
          }

          if (!closedNode) {
            yield new Error(
              `${filePath}:${token.l}:${token.c} Encountered unexpected closing tag: ${closedTagname}`
            );
            return;
          }

          if (closedNode === currentOpenRootNode) {
            yield closedNode;
            currentOpenRootNode = currentOpenLeafElementNode = null;
          } else {
            currentOpenLeafElementNode = nodeParentMap.get(closedNode) ?? null;
          }

          nodeParentMap.delete(closedNode);
          break;
        }
      }
    }
  } finally {
    nodeParentMap.clear();
  }
}
