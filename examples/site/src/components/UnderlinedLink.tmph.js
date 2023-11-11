// __tmph_integrity=1850dc2160cd59d9d7e8779632b466c62cba87e8b16c6a11f0727e2b172d1b1b
import renderAttributeToString from "#tmph/render/renderAttributes.js";



/**
 * @typedef {Record<string, any> | null | undefined} Props
 */
/**
 * @param {Object} [params]
 * @param {Props} [params.props]
 * @param {string|null} [params.slot=""]
 * @param {{ [key in icon]?: string }} [params.namedSlots=""]
*/
export async function render(params) {const slot = params?.slot ?? "";
const namedSlots = params?.namedSlots ?? {};
const props = params?.props ?? {};

  return `<a${await renderAttributeToString(
            "href",
            props.href,
          )}>${slot ?? ""}${namedSlots?.icon ?? ""}</a>`;
}