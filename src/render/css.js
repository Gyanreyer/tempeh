import { transform } from "lightningcss";

/** @typedef {import("lightningcss").Selector} Selector */
/** @typedef {import("lightningcss").SelectorComponent} SelectorComponent */

/** @type {SelectorComponent} */
const descendantCombinator = {
  type: "combinator",
  value: "descendant",
};

/**
 *
 * @param {Selector} selector
 * @param {SelectorComponent} scopedAttributeSelector
 */
const scopeSelector = (selector, scopedAttributeSelector) => {
  let hasHostSelector = false;

  for (let i = 0, selectorCount = selector.length; i < selectorCount; ++i) {
    const selectorComponent = selector[i];
    if (selectorComponent.type === "pseudo-class") {
      switch (selectorComponent.kind) {
        case "host": {
          hasHostSelector = true;

          // Replace :host with the scoped component ID
          selector.splice(i, 1, scopedAttributeSelector);

          let addedSelectorCount = selector.length - selectorCount;
          i += addedSelectorCount;
          selectorCount += addedSelectorCount;

          if (selectorComponent.selectors) {
            selector.splice(i + 1, 0, ...selectorComponent.selectors);

            addedSelectorCount = selector.length - selectorCount;
            i += addedSelectorCount;
            selectorCount += addedSelectorCount;
          }

          break;
        }
        default: {
          if ("selectors" in selectorComponent) {
            for (const subSelector of selectorComponent.selectors) {
              const didSubSelectorHaveHostSelector = scopeSelector(
                subSelector,
                scopedAttributeSelector
              );

              if (didSubSelectorHaveHostSelector) {
                hasHostSelector = true;
              }
            }
          }
          break;
        }
      }
    }
  }

  return hasHostSelector;
};

/**
 * Template literal string tag which performs basic CSS minification on the string.
 *
 * @param {string} cssString
 * @param {string} scopedComponentID
 * @param {object} [options]
 * @param {boolean} [options.minify=true]
 * @param {boolean} [options.scope=true]
 *
 * @returns {string}
 */
export default function css(cssString, scopedComponentID, options) {
  /** @type {SelectorComponent} */
  const scopedAttributeSelector = {
    type: "attribute",
    name: "data-scid",
    operation: {
      operator: "equal",
      value: scopedComponentID,
    },
  };

  const processedCSSResult = transform({
    filename: `${scopedComponentID}.css`,
    code: Buffer.from(cssString),
    minify: options?.minify ?? true,
    visitor: {
      Selector: options?.scope
        ? (selector) => {
            const hasHostSelector = scopeSelector(
              selector,
              scopedAttributeSelector
            );

            if (!hasHostSelector) {
              // If the selector doesn't contain a :host selector, insert the scoped attribute selector
              // at the front
              selector.splice(
                0,
                0,
                scopedAttributeSelector,
                descendantCombinator
              );
            }

            return selector;
          }
        : undefined,
    },
  });

  return processedCSSResult.code.toString();
}
