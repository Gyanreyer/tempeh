import * as Layout from "/Users/ryangeyer/Projects/tempeh/examples/site/src/Layout.tmph.js";
import * as UnderlinedLink from "/Users/ryangeyer/Projects/tempeh/examples/site/src/components/UnderlinedLink.tmph.js";
import renderAttributeToString from "#tmph/render/renderAttributes.js";

/**
 * @typedef  {Object} Props
 * @property {boolean} [showForm=false]
 * @property {Record<string, string>} [formProps={}]
 * @property {string} [formProps.method="POST"]
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
  return `${await Layout.render({
    props: { title: "Welcome to my home page" },
    slot: `<h1>Hello, world!</h1>
${await UnderlinedLink.render({
  props: { href: "/about" },
  slot: `About
<svg slot="icon"></svg>`,
  namedSlots: null,
})}
${await (async () => {
  return props.showForm
    ? `<div><form${await (async () => {
        const __tmph_value_gwzyt3807yt = (() => {
          const __tmph_result_ns6bqh2mw4 = props.formProps;
          if (typeof __tmph_result_ns6bqh2mw4 !== "object") {
            console.warn(
              `Attempted to spread non-object value ${__tmph_result_ns6bqh2mw4} onto element attributes`
            );
            return {};
          }
          return __tmph_result_ns6bqh2mw4;
        })();
        let __tmph_attributePromises_9tilq85mge = [];
        for (const __tmph_key_ucruqrkz86 in __tmph_value_gwzyt3807yt) {
          __tmph_attributePromises_9tilq85mge.push(
            renderAttributeToString(
              __tmph_key_ucruqrkz86,
              __tmph_value_gwzyt3807yt[__tmph_key_ucruqrkz86]
            )
          );
        }
        const __tmph_result_y4j01s533pi = (
          await Promise.all(__tmph_attributePromises_9tilq85mge)
        ).join(" ");
        return __tmph_result_y4j01s533pi ? ` ${__tmph_result_y4j01s533pi}` : "";
      })()}></form></div>`
    : "";
})()}`,
    namedSlots: null,
  })}`;
}
