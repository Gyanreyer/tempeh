import { extractComponentName } from "./extractComponentName.js";

/** @typedef {import("./parseXML.js").TmphNode} TmphNode */

/**
 * @typedef {{
 *  stylesheets?: string[];
 *  scripts?: string[];
 *  componentImports?: { [componentName: string]: string; };
 *  inlineComponents?: { [componentName: string]: Array<TmphNode | string>; };
 *  jsDoc?: string;
 * }} Meta
 */

/**
 *
 * @param {TmphNode|string} node
 * @param {Meta} [meta]
 */
export function gatherComponentMeta(node, meta = {}) {
  if (typeof node === "string") {
    return meta;
  }

  if (!node.children) {
    return meta;
  }

  let i = 0;
  let childCount = node.children.length;

  /**
   * Remove the current child so it isn't rendered.
   */
  const removeCurrentChild = () => {
    node.children?.splice(i, 1);
    --i;
    --childCount;
  };

  for (; i < childCount; ++i) {
    const child = /** @type {string | TmphNode} */ (node.children[i]);

    if (typeof child === "string") {
      continue;
    }

    const { tagName, attributes, children } = child;

    if (tagName === "link") {
      if (!attributes) {
        throw new Error("Received invalid <link> element without attributes");
      }

      if (!attributes.rel || typeof attributes.rel !== "string") {
        throw new Error(
          `Received <link> element without a valid rel attribute`
        );
      }

      if (!attributes.href || typeof attributes.href !== "string") {
        throw new Error(
          `Received <link> element without a valid href attribute`
        );
      }

      if (attributes.rel === "stylesheet") {
        (meta.stylesheets ??= []).push(attributes.href);
        // Remove the link element so it isn't rendered
        removeCurrentChild();
        continue;
      } else if (attributes.rel === "import") {
        let componentName = attributes.as;

        if (!componentName || typeof componentName !== "string") {
          componentName = extractComponentName(attributes.href);
        }

        (meta.componentImports ??= {})[componentName] = attributes.href;
        // Remove the link element so it isn't rendered
        removeCurrentChild();
        continue;
      }
    } else if (tagName === "script") {
      if (attributes?.["#types"]) {
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
    } else if (tagName === "template") {
      if (attributes?.["#component"]) {
        const componentName = attributes["#component"];

        if (!componentName || typeof componentName !== "string") {
          throw new Error(
            `Received invalid template #component name "${componentName}"`
          );
        }

        if (!children) {
          throw new Error(
            `Received invalid template #component "${componentName}" without children`
          );
        }

        (meta.inlineComponents ??= {})[componentName] = children;
        removeCurrentChild();
        continue;
      }
    }

    gatherComponentMeta(child, meta);
  }

  return meta;
}
