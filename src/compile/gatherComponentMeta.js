import { extractComponentName } from "./extractComponentName.js";
import { getNodeAttributeValue } from "./getNodeAttributeValue.js";

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

    console.log("child", child);

    if (typeof child === "string") {
      continue;
    }

    const { TagName: tagName, Children: children } = child;

    if (tagName === "link") {
      if (!child.Attributes) {
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

        (meta.componentImports ??= {})[componentName] = href;
        // Remove the link element so it isn't rendered
        removeCurrentChild();
        continue;
      }
    } else if (tagName === "script") {
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
    } else if (tagName === "template") {
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

        (meta.inlineComponents ??= {})[inlineComponentName] = children;
        removeCurrentChild();
        continue;
      }
    }

    if (child.Children) {
      gatherComponentMeta(child.Children, meta);
    }
  }

  return meta;
}
