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
 * @param {TmphTextNode | TmphElementNode} node
 * @returns {node is TmphElementNode}
 */
export const isTmphElementNode = (node) => "tagName" in node;

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
 * @param {AssetBucketImportedStyle | AssetBucketInlineStyle} style
 * @returns {style is AssetBucketImportedStyle}
 */
export const isAssetBucketImportedStyle = (style) => "path" in style;

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
 * @param {AssetBucketImportedScript | AssetBucketInlineScript} script
 * @returns {script is AssetBucketImportedScript}
 */
export const isAssetBucketImportedScript = (script) => "path" in script;

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
 * @property {Record<string, ComponentImport>} [componentImports]
 */
