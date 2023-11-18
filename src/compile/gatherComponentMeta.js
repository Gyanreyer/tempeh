import { readFileSync } from "node:fs";
import { extractComponentName } from "./extractComponentName.js";
import {
  getNodeAttributeValue,
  removeNodeAttribute,
} from "./getNodeAttributeValue.js";

/** @typedef {import("./parseXML.js").TmphNode} TmphNode */

/**
 * @typedef {Object} Meta
 * @property {string} sourceFilePath
 * @property {boolean} hasDefaultSlot
 * @property {string[]|null} namedSlots
 * @property {boolean} usesProps
 * @property {boolean} isAsync
 */

/**
 * @typedef {Object} AssetBucket
 * @property {string[]} stylesheets
 * @property {string[]} scripts
 */

/**
 * @typedef {Object} ComponentAssets
 * @property {{ [componentName: string]: { importPath: string; meta: Meta | null; } }|null} componentImports
 * @property {{ [componentName: string]: { nodes: Array<TmphNode | string>; meta: Meta; } }|null} inlineComponents
 * @property {string|null} propTypesJsDoc
 * @property {Record<string, AssetBucket>|null} assetBuckets
 * @property {string[]|null} inlineStylesheets
 * @property {string[]|null} inlineScripts
 */

const DEFAULT_BUCKET_NAME = "default";

/**
 *
 * @param {Array<TmphNode|string>} nodeList
 * @param {Meta} meta
 * @param {ComponentAssets} componentAssets
 */
export function gatherComponentMeta(nodeList, meta, componentAssets) {
  let i = 0;
  let childCount = nodeList.length;

  /**
   * Remove the current child so it isn't rendered.
   */
  const removeCurrentChild = () => {
    nodeList.splice(i, 1);
    --i;
    --childCount;
  };

  for (; i < childCount; ++i) {
    const child = /** @type {string | TmphNode} */ (nodeList[i]);

    if (typeof child === "string") {
      continue;
    }

    const { tagName: tagName, children: children } = child;

    switch (tagName) {
      case "link": {
        if (!child.attributes) {
          throw new Error("Received invalid <link> element without attributes");
        }

        const rel = getNodeAttributeValue(child, "rel");

        if (!rel || typeof rel !== "string") {
          throw new Error(
            `Received <link> element without a valid rel attribute`
          );
        }

        const href = getNodeAttributeValue(child, "href");

        if (!href || typeof href !== "string") {
          throw new Error(
            `Received <link> element without a valid href attribute`
          );
        }

        if (rel === "stylesheet") {
          if (href.startsWith("http")) {
            // Absolute URL imports are ignored
            continue;
          }

          try {
            const filePath = import.meta.resolve(href);
            const cssFile = readFileSync(filePath, "utf8");

            let bucketName = getNodeAttributeValue(child, "bucket");
            if (!bucketName || typeof bucketName !== "string") {
              bucketName = DEFAULT_BUCKET_NAME;
            }

            componentAssets.assetBuckets ??= {};
            componentAssets.assetBuckets[bucketName] ??= {
              stylesheets: [],
              scripts: [],
            };

            componentAssets.assetBuckets[bucketName].stylesheets.push(cssFile);
            // Remove the link element so it isn't rendered
            removeCurrentChild();
          } catch {}

          continue;
        } else if (rel === "import") {
          let componentName = getNodeAttributeValue(child, "as");

          if (!componentName || typeof componentName !== "string") {
            componentName = extractComponentName(href);
          }

          componentAssets.componentImports ??= {};
          componentAssets.componentImports[componentName] = {
            importPath: href,
            meta: null,
          };
          // Remove the link element so it isn't rendered
          removeCurrentChild();
          continue;
        }
        break;
      }
      case "script": {
        if (getNodeAttributeValue(child, "#prop-types")) {
          componentAssets.propTypesJsDoc = "";
          if (children) {
            for (const grandChild of children) {
              if (typeof grandChild === "string") {
                componentAssets.propTypesJsDoc += grandChild;
              }
            }
          }
          removeCurrentChild();
          continue;
        }
        break;
      }
      case "style": {
        if (getNodeAttributeValue(child, "#raw")) {
          // Raw style elements are not processed and rendered inline,
          // so just remove the #raw attribute
          removeNodeAttribute(child, "#raw");
          break;
        }

        const styleContent = child.children?.[0];
        if (typeof styleContent !== "string") {
          console.error(
            "Received invalid content for <style> tag",
            styleContent
          );
          removeCurrentChild();
          break;
        } else if (!styleContent.trim()) {
          // If the style tag is empty, just remove it
          removeCurrentChild();
          break;
        }

        // Inline styles are processed but will be rendered in a <style> tag
        // in the component
        if (getNodeAttributeValue(child, "#inline")) {
          componentAssets.inlineStylesheets ??= [];
          componentAssets.inlineStylesheets.push(styleContent);
          removeCurrentChild();
          break;
        }

        let bucketName = getNodeAttributeValue(child, "bucket");

        if (!bucketName || typeof bucketName !== "string") {
          bucketName = DEFAULT_BUCKET_NAME;
        }

        componentAssets.assetBuckets ??= {};
        componentAssets.assetBuckets[bucketName] ??= {
          stylesheets: [],
          scripts: [],
        };

        componentAssets.assetBuckets[bucketName].stylesheets.push(styleContent);

        // Remove the style element so it isn't rendered in the component
        removeCurrentChild();
        break;
      }
      case "template": {
        const inlineComponentName = getNodeAttributeValue(child, "#component");
        if (inlineComponentName) {
          if (!inlineComponentName || typeof inlineComponentName !== "string") {
            throw new Error(
              `Received invalid template #component name "${inlineComponentName}"`
            );
          }

          if (!children) {
            throw new Error(
              `Received invalid template #component "${inlineComponentName}" without children`
            );
          }

          /** @type {Meta} */
          const inlineComponentMeta = {
            sourceFilePath: meta.sourceFilePath,
            hasDefaultSlot: false,
            namedSlots: null,
            usesProps: false,
            isAsync: false,
          };

          gatherComponentMeta(children, inlineComponentMeta, componentAssets);

          (componentAssets.inlineComponents ??= {})[inlineComponentName] = {
            nodes: children,
            meta: inlineComponentMeta,
          };
          removeCurrentChild();
          continue;
        }
        break;
      }
      case "slot": {
        const nameAttribute = getNodeAttributeValue(child, "name");
        if (nameAttribute && typeof nameAttribute === "string") {
          (meta.namedSlots ??= []).push(nameAttribute);
        } else {
          meta.hasDefaultSlot = true;
        }
        break;
      }
    }

    if (child.children) {
      gatherComponentMeta(child.children, meta, componentAssets);
    }
  }

  return meta;
}

export const cachedMetaCommentStart = "// __tmph_meta=";

/**
 * Takes a full Meta object and converts it into a pared-down CachedMeta object in
 * the form of a comment string which will be placed on the second line of every compiled component file.
 *
 * @param {Meta} meta
 */
export function makeCachedMetaComment(meta) {
  return `${cachedMetaCommentStart}${JSON.stringify(meta)}`;
}
