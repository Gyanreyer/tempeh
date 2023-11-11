// __tmph_integrity=f9c7e836f6bcfdba5fe725e6e11ae5c9af55430f7306f29f0f9c8dc0fffc442d
import escapeText from "#tmph/render/escapeText.js";
import defaultProps from "#tmph/render/defaultProps.js";


/**
   * @typedef  {Object} Props
   * @property {string} [props.title="My Tempeh Site"]
   */
/**
 * @param {Object} [params]
 * @param {Props} [params.props]
 * @param {string|null} [params.slot=""]
*/
export async function render(params) {const slot = params?.slot ?? "";
const namedSlots = params?.namedSlots ?? {};
const props = defaultProps(params?.props, {"props": {title: "My Tempeh Site"},});

  return `<!DOCTYPE html>
<html lang="en-US"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeText(props.title)}</title></head><body>${slot ?? ""}</body></html>`;
}