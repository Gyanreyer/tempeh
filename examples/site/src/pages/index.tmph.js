// __tmph_integrity=301dfffe4546151756074dee7305d4d4162c9076385ba7526caa562ddef66ab5
import * as Layout from "/Users/ryangeyer/Projects/tempeh/examples/site/src/Layout.tmph.js";
import * as UnderlinedLink from "/Users/ryangeyer/Projects/tempeh/examples/site/src/components/UnderlinedLink.tmph.js";
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
export async function render(params) {const props = defaultProps(params.props, {"formProps": {method: "POST"},});

  return `${await Layout.render({props: {title: "Welcome to my home page",},slot: `<h1>Hello, world!</h1>
${await UnderlinedLink.render({props: {href: "/about",},slot: `About
<svg slot="icon"></svg>`})}
${await (async ()=>{
            return props.showForm ? `<div><form${await (async ()=> {
            const __tmph_value_j8o2fq2qd3 = (()=>{
              const __tmph_result_e9912i36ps9 = props.formProps;
              if(typeof __tmph_result_e9912i36ps9 !== "object") {
                console.warn(`Attempted to spread non-object value ${__tmph_result_e9912i36ps9} onto element attributes`);
                return {};
              }
              return __tmph_result_e9912i36ps9;
            })();
            let __tmph_attributePromises_tt95xo7ady = [];
            for(const __tmph_key_yxwqxtcj44 in __tmph_value_j8o2fq2qd3){
              __tmph_attributePromises_tt95xo7ady.push(renderAttributeToString(__tmph_key_yxwqxtcj44, __tmph_value_j8o2fq2qd3[__tmph_key_yxwqxtcj44]));
            }
            const __tmph_result_j7k8szgow9l =  (await Promise.all(__tmph_attributePromises_tt95xo7ady)).join(" ");
            return __tmph_result_j7k8szgow9l ? ` ${__tmph_result_j7k8szgow9l}` : "";
          })()}></form></div>` : "";
          })()}`})}`;
}