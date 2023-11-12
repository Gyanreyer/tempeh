// __tmph_integrity=7f0756076abe4ce237c7b69e7fce19bdc571c360c789c61d093d7efcdea6a2a1
// __tmph_meta={"usesProps":true,"isAsync":false,"sourceFilePath":"/Users/ryangeyer/Projects/tempeh/examples/site/src/Layout.tmph.html","hasDefaultSlot":true,"namedSlots":null}
import escapeText from "#tmph/render/escapeText.js";
import defaultProps from "#tmph/render/defaultProps.js";


/**
   * @typedef  {Object} Props
   * @property {string} [title="My Tempeh Site"]
   */
/**
 * @param {Object} [params]
 * @param {Props} [params.props]
 * @param {string|null} [params.slot=""]
*/
export  function render(params) {const slot = params?.slot ?? "";
const props = defaultProps(params?.props, {"title": "My Tempeh Site",});

  return `<!DOCTYPE html> 
<html lang="en-US"><head><meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>${escapeText((props.title))}</title></head> <body>${slot ?? ""}</body></html>`;
}