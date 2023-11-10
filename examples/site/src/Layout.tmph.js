import escapeText from "#tmph/render/escapeText.js";


/**
   * @typedef  {Object} Props
   * @property {string} [props.title="My Tempeh Site"]
   */
/**
 * @typedef {Record<string, string> | null | undefined} NamedSlots
 */
/**
 * @param {Object} params
 * @param {Props} [params.props]
 * @param {NamedSlots} [params.namedSlots]
 * @param {string|null} [params.slot]
 */
export async function render({ props, slot, namedSlots }) {
  return `<!DOCTYPE html>
<html lang="en-US"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeText(props.title)}</title></head><body>${slot ?? ""}</body></html>`;
}