import renderAttributeToString from "#tmph/render/renderAttributes.js";



/**
 * @typedef {Record<string, any> | null | undefined} Props
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
  return `<a${await renderAttributeToString(
            "href",
            props.href,
          )}>${slot ?? ""}${namedSlots?.icon ?? ""}</a>`;
}