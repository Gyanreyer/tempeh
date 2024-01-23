// __tmph_integrity=b8e96d46f4472935e1b3d72fc057880f443eb7b28ad17b1e2a0bdfb95c5299e0
// __tmph_meta={"usesProps":true,"isAsync":true,"sourceFilePath":"./examples/site/src/pages/index.tmph.html","hasDefaultSlot":false,"namedSlots":null}
import renderAttributeToString from "src/render/renderAttributes.js";
import escapeText from "src/render/escapeText.js";
import defaultProps from "src/render/defaultProps.js";
import { html } from "src/render/html";

import * as Layout from "../Layout.tmph.js";
import * as UnderlinedLink from "../components/UnderlinedLink.tmph.js";

/**
 * @typedef  {Object} Props
 * @property {boolean} [showForm=false]
 * @property {Record<string, string>} [formProps={}]
 * @property {string} [formProps.method="POST"]
 */
/**
 * @param {Object} params
 * @param {Props} params.props
 */
export async function render(params) {
  const props = defaultProps(params?.props, {
    showForm: false,
    formProps: { method: "POST" },
  });

  return html`${Layout.render({
    props: { title: "Welcome to my home page" },
    slot: html`<h1>Hello, world!</h1>

      ${UnderlinedLink.render({
        props: { href: "/about" },
        slot: html`About <svg slot="icon"></svg>`,
      })}
      ${props.showForm
        ? html`<div>
            <form
              ${(async () => {
                let __tmph_result_vrwmofj6nwf = "";

                const __tmph_value_3zxhqo1nuxi = (() => {
                  const __tmph_result_jp72rw1as2h = props.formProps;
                  if (typeof __tmph_result_jp72rw1as2h !== "object") {
                    console.warn(
                      `Attempted to spread non-object value ${__tmph_result_jp72rw1as2h} onto element attributes`
                    );
                    return {};
                  }
                  return __tmph_result_jp72rw1as2h;
                })();
                for (const __tmph_key_00tubohqmowpl in __tmph_value_3zxhqo1nuxi) {
                  __tmph_result_vrwmofj6nwf += ` ${renderAttributeToString(
                    __tmph_key_00tubohqmowpl,
                    __tmph_value_3zxhqo1nuxi[__tmph_key_00tubohqmowpl]
                  )}`;
                }
                return __tmph_result_vrwmofj6nwf;
              })()}
            ></form>
          </div>`
        : ""}

      <div>
        <p>
          The temperature in Detroit is
          ${(async () => {
            let forecast = await fetch(
              "https://api.weather.gov/gridpoints/DTX/66,34/forecast"
            ).then((res) => res.json());
            return html`${escapeText(
              forecast.properties.periods[0].temperature
            )}`;
          })()}
        </p>
      </div>`,
  })}`;
}
