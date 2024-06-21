import { LexerTokenType, lex } from "./lexer.js";

/**
 * @typedef TmphElementAttribute
 * @property {number} l - Line number
 * @property {number} c - Column number
 * @property {string} name
 * @property {string} value
 */

/**
 * @typedef TmphElementNode
 * @property {number} l - Line number
 * @property {number} c - Column number
 * @property {string} tagName
 * @property {TmphElementAttribute[]} [attributes]
 * @property {TmphNode[]} [children]
 */

/**
 * @typedef TmphTextNode
 * @property {number} l - Line number
 * @property {number} c - Column number
 * @property {string} textContent
 */

/**
 * @typedef {TmphElementNode| TmphTextNode} TmphNode
 */

/**
 * @typedef TemplateDataAST
 * @property {string} src - Path to the parsed template file
 * @property {TmphNode[]} nodes - The root nodes of the template
 */

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
   * @typedef {TmphElementNode & {
   *  parent: OpenTmphElementNode | null
   * }} OpenTmphElementNode
   */

  /**
   * @type {OpenTmphElementNode | null}
   */
  let currentOpenLeafElementNode = null;

  for await (const token of lex(filePath)) {
    if (token.type === LexerTokenType.EOF) {
      if (currentOpenLeafElementNode !== null) {
        let openRootNode = currentOpenLeafElementNode;
        while (openRootNode.parent) {
          openRootNode = openRootNode.parent;
        }
        const { parent, ...nodeWithoutParent } = openRootNode;
        templateData.nodes.push(nodeWithoutParent);
      }
      break;
    } else if (token.type === LexerTokenType.ERROR) {
      return new Error(token.value);
    }

    switch (token.type) {
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
          (currentOpenLeafElementNode.children ?? []).push(textNode);
        } else {
          // Append text node to the root if there's no open parent node
          templateData.nodes.push(textNode);
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

        if (currentOpenLeafElementNode) {
          (currentOpenLeafElementNode.children ??= []).push(elementNode);
        }
        currentOpenLeafElementNode = {
          ...elementNode,
          parent: currentOpenLeafElementNode,
        };
        break;
      }
      case LexerTokenType.ATTRIBUTE_NAME: {
        if (currentOpenLeafElementNode) {
          (currentOpenLeafElementNode.attributes ??= []).push({
            name: /** @type {string} */ (token.value),
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
      case LexerTokenType.CLOSING_TAG_END: {
        if (!currentOpenLeafElementNode) {
          break;
        }

        if (currentOpenLeafElementNode.parent) {
          currentOpenLeafElementNode = currentOpenLeafElementNode.parent;
        } else {
          const { parent, ...nodeWithoutParent } = currentOpenLeafElementNode;
          templateData.nodes.push(nodeWithoutParent);
          currentOpenLeafElementNode = null;
        }
        break;
      }
      case LexerTokenType.CLOSING_TAGNAME: {
        const closedTagname = token.value;

        let closedNode = /** @type {OpenTmphElementNode|null} */ (
          currentOpenLeafElementNode
        );

        if (closedTagname === "body") {
          debugger;
        }
        while (closedNode && closedNode.tagName !== closedTagname) {
          closedNode = closedNode.parent;
        }

        if (!closedNode) {
          return new Error(
            `${filePath}:${token.l}:${token.c} Encountered unexpected closing tag: ${closedTagname}`
          );
        }

        if (closedNode.parent) {
          currentOpenLeafElementNode = closedNode.parent;
        } else {
          const { parent, ...nodeWithoutParent } = closedNode;
          templateData.nodes.push(nodeWithoutParent);
          currentOpenLeafElementNode = null;
        }
        break;
      }
    }
  }

  return templateData;
}
