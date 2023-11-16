import { transform } from "lightningcss";

/**
 * @typedef {import("lightningcss").Selector} Selector
 * @typedef {import("lightningcss").SelectorComponent} SelectorComponent
 * @typedef {import("lightningcss").ScopeRule} ScopeRule
 * @typedef {import("lightningcss").Rule} Rule
 */

/**
 *
 * @param {Selector} selector
 * @param {SelectorComponent} scopedAttributeSelector
 * @returns {boolean}
 */
const scopeSelector = (selector, scopedAttributeSelector) => {
  let hasScopeSelector = false;

  for (let i = 0, selectorCount = selector.length; i < selectorCount; ++i) {
    const selectorComponent = selector[i];
    if (selectorComponent.type === "pseudo-class") {
      switch (selectorComponent.kind) {
        case "scope": {
          // Replace :scope with the scoped component ID
          selector[i] = scopedAttributeSelector;
          hasScopeSelector = true;
          break;
        }
        default: {
          if ("selectors" in selectorComponent && selectorComponent.selectors) {
            for (const subSelector of selectorComponent.selectors) {
              if (Array.isArray(subSelector)) {
                hasScopeSelector =
                  hasScopeSelector ||
                  scopeSelector(subSelector, scopedAttributeSelector);
              }
            }
          }
          break;
        }
      }
    }
  }

  return hasScopeSelector;
};

/** @type {SelectorComponent} */
const descendantCombinator = {
  type: "combinator",
  value: "descendant",
};

/**
 * @param {SelectorComponent} scopedAttributeSelector
 * @param {{
 *  type: "scope";
 *  value: ScopeRule;
 * }} scopeRule
 * @returns {Rule | Rule[] | void}
 */
const transformScopeAtRule = (scopedAttributeSelector, scopeRule) => {
  if (!scopeRule.value.scopeStart) {
    for (const rule of scopeRule.value.rules) {
      if (rule.type === "style") {
        for (const selector of rule.value.selectors) {
          // Scope every selector in the rule to the scoped component ID
          const hasHostSelector = scopeSelector(
            selector,
            scopedAttributeSelector
          );
          if (!hasHostSelector) {
            // If the selector didn't have a :host selector, prepend the scoped component ID at the front of the selector
            selector.splice(
              0,
              0,
              scopedAttributeSelector,
              descendantCombinator
            );
          }
        }
      }
    }

    return scopeRule.value.rules;
  }

  return scopeRule;
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
  const shouldMinify = options?.minify ?? true;
  const shouldScope = options?.scope ?? true;

  const processedCSSResult = transform({
    filename: `${scopedComponentID}.css`,
    code: Buffer.from(cssString),
    minify: shouldMinify,
    visitor: shouldScope
      ? {
          Rule: {
            scope: transformScopeAtRule.bind(null, {
              type: "attribute",
              name: "data-scid",
              operation: {
                operator: "equal",
                value: scopedComponentID,
              },
            }),
          },
        }
      : undefined,
  });

  return processedCSSResult.code.toString();
}
