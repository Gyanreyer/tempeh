import { deepPreventExtensions } from "../utils/deepPreventExtensions.js";
import { startTemplateParserServer } from "./templateParserServer.js";

/**
 * @typedef {Object} StaticAttribute
 * @property {string} name
 * @property {string} [value]
 * @property {string} position
 */

/**
 * @typedef {Object} RenderAttribute
 * @property {string} name
 * @property {string} [modifier]
 * @property {string} [expressionValue]
 * @property {string} [expressionPosition]
 * @property {true} [isExpressionAsync]
 * @property {true} [doesExpressionReferenceProps]
 * @property {string} position
 */

/**
 * @typedef {Object} TmphTextNode
 * @property {string} textContent
 * @property {string} position
 */

/**
 * @typedef {Object} TmphElementNode
 * @property {string} tagName
 * @property {StaticAttribute[]} [staticAttributes]
 * @property {RenderAttribute[]} [renderAttributes]
 * @property {Array<TmphTextNode | TmphElementNode>} [children]
 * @property {string} position
 */

/**
 * @typedef {Object} TmphRootNode
 * @property {string} tagName
 * @property {Array<TmphTextNode | TmphElementNode>} [children]
 * @property {string} position
 */

/**
 * @typedef {Object} ComponentImport
 * @property {string} [importName] - The name that the component is imported as, if a #as attribute was set
 * @property {string} path - The path to the component file
 * @property {string} position - The position of the import in the template
 */

/**
 * @typedef {Object} TmphComponent
 * @property {TmphRootNode} rootNode
 * @property {boolean}  hasDefaultSlot
 * @property {Record<string, true>} [namedSlots]
 * @property {string} [propTypesJSDoc]
 */

/**
 * @typedef {Object} AssetBucketInlineStyle
 * @property {string} content - The content of the inline style
 * @property {string} position
 */

/**
 * @typedef {Object} AssetBucketImportedStyle
 * @property {string} path - The path to the style asset
 * @property {string} position
 */

/**
 * @typedef {Object} AssetBucketInlineScript
 * @property {string} content - The content of the inline script
 * @property {string} scope - The scope of the inline script
 * @property {string} position
 */

/**
 * @typedef {Object} AssetBucketImportedScript
 * @property {string} path - The path to the script asset
 * @property {string} scope - The scope of the inline script
 * @property {string} position
 */

/**
 * @typedef {Object} AssetBucket
 * @property {Array<AssetBucketInlineScript|AssetBucketImportedScript>} [scripts]
 * @property {Array<AssetBucketInlineStyle|AssetBucketImportedStyle>} [styles]
 */

/**
 * @typedef {Object} TmphTemplateData
 * @property {string} sourceFilePath
 * @property {TmphComponent} mainComponent
 * @property {Record<string, TmphComponent>} [inlineComponents]
 * @property {Record<string, AssetBucket>} [assets]
 * @property {ComponentImport[]} [componentImports]
 */

/**
 * Takes the path to a .tmph.html file and parses it into a JSON object
 * that can be used by the compiler.
 * @param {string} filePath
 */
export async function parseTemplate(filePath) {
  const parserServerOrigin = await startTemplateParserServer();

  if (!parserServerOrigin) {
    throw new Error("Template parser server not running");
  }

  const requestURL = new URL("/parse", parserServerOrigin);
  requestURL.searchParams.set("path", filePath);

  // Prevent extension on all items in the node tree. This means that items can be deleted
  // or modified, but never added. This should hopefully reduce memory usage.
  return deepPreventExtensions(
    /** @type {Promise<TmphTemplateData>} */ (
      await fetch(requestURL).then((res) => res.json())
    )
  );
}
