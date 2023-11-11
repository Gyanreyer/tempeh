// __tmph_integrity=301dfffe4546151756074dee7305d4d4162c9076385ba7526caa562ddef66ab5
import * as UnderlinedLink from "/Users/ryangeyer/Projects/tempeh/examples/site/src/components/UnderlinedLink.tmph.js";
import * as Layout from "/Users/ryangeyer/Projects/tempeh/examples/site/src/Layout.tmph.js";
import renderAttributeToString from "#tmph/render/renderAttributes.js";
import defaultProps from "#tmph/render/defaultProps.js";


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
export async function render(params) {const props = defaultProps(params?.props, {"showForm": false,"formProps": {method: "POST"},});

  return `${await Layout.render({props: {title: "Welcome to my home page",},slot: `<h1>Hello, world!</h1>
${await UnderlinedLink.render({props: {href: "/about",},slot: `About
<svg slot="icon"></svg>`})}
${await (async ()=>{
            return props.showForm ? `<div><form${await (async ()=> {
            const __tmph_value_a4dx2n0fvn = (()=>{
              const __tmph_result_8ovig16olsf = props.formProps;
              if(typeof __tmph_result_8ovig16olsf !== "object") {
                console.warn(`Attempted to spread non-object value ${__tmph_result_8ovig16olsf} onto element attributes`);
                return {};
              }
              return __tmph_result_8ovig16olsf;
            })();
            let __tmph_attributePromises_03hfage3l59y = [];
            for(const __tmph_key_q79zys657 in __tmph_value_a4dx2n0fvn){
              __tmph_attributePromises_03hfage3l59y.push(renderAttributeToString(__tmph_key_q79zys657, __tmph_value_a4dx2n0fvn[__tmph_key_q79zys657]));
            }
            const __tmph_result_1b2ijkoln21 =  (await Promise.all(__tmph_attributePromises_03hfage3l59y)).join(" ");
            return __tmph_result_1b2ijkoln21 ? ` ${__tmph_result_1b2ijkoln21}` : "";
          })()}></form></div>` : "";
          })()}`})}`;
}