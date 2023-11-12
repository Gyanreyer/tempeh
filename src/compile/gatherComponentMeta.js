import { extractComponentName } from "./extractComponentName.js";
import { getNodeAttributeValue } from "./getNodeAttributeValue.js";

/** @typedef {import("./parseXML.js").TmphNode} TmphNode */

/**
 * @typedef {{
 *  sourceFilePath: string;
 *  hasDefaultSlot: boolean;
 *  namedSlots: string[]|null;
 *  usesProps: boolean;
 *  isAsync: boolean;
 *  stylesheets?: string[];
 *  scripts?: string[];
 *  componentImports?: { [componentName: string]: { importPath: string; meta: CachedMeta | null } };
 *  inlineComponents?: { [componentName: string]: { nodes: Array<TmphNode | string>; meta: Meta }};
 *  jsDoc?: string;
 * }} Meta
 */

/**
 * @typedef {Pick<Meta, "usesProps" | "isAsync" | "sourceFilePath" | "hasDefaultSlot" | "namedSlots">} CachedMeta
 */

/**
 *
 * @param {Array<TmphNode|string>} nodeList
 * @param {Meta} meta
 */
export function gatherComponentMeta(nodeList, meta) {
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
          (meta.stylesheets ??= []).push(href);
          // Remove the link element so it isn't rendered
          removeCurrentChild();
          continue;
        } else if (rel === "import") {
          let componentName = getNodeAttributeValue(child, "as");

          if (!componentName || typeof componentName !== "string") {
            componentName = extractComponentName(href);
          }

          (meta.componentImports ??= {})[componentName] = {
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
        if (getNodeAttributeValue(child, "#types")) {
          meta.jsDoc = "";
          if (children) {
            for (const grandChild of children) {
              if (typeof grandChild === "string") {
                meta.jsDoc += grandChild;
              }
            }
          }
          removeCurrentChild();
          continue;
        }
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

          const inlineComponentMeta = gatherComponentMeta(children, {
            sourceFilePath: meta.sourceFilePath,
            hasDefaultSlot: false,
            namedSlots: null,
            usesProps: false,
            isAsync: false,
          });

          (meta.inlineComponents ??= {})[inlineComponentName] = {
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
      gatherComponentMeta(child.children, meta);
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
  /** @type {CachedMeta} */
  const cachedMeta = {
    usesProps: meta.usesProps,
    isAsync: meta.isAsync,
    sourceFilePath: meta.sourceFilePath,
    hasDefaultSlot: meta.hasDefaultSlot,
    namedSlots: meta.namedSlots,
  };

  return `${cachedMetaCommentStart}${JSON.stringify(cachedMeta)}`;
}
