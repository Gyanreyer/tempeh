
    import * as UnderlinedLink from "/Users/ryangeyer/Projects/tempeh/examples/site/src/components/UnderlinedLink.tmph.js";import * as Layout from "/Users/ryangeyer/Projects/tempeh/examples/site/src/Layout.tmph.js";import renderAttributeToString from "#tmph/render/renderAttributes.js";
    
    /**
   * @typedef  {Object} Props
   * @property {boolean} [showForm=false]
   * @property {Record<string, string>} [formProps={}]
   * @property {string} [formProps.method="POST"]
   */
    /**
     * @param {Object} params
     * @param {Props} params.props
     * @param {string|null} params.slot
     * @param {Record<string, string>|null} params.namedSlots
     */
    export async function render({ props, slot, namedSlots }) {
      return `${await Layout.render({
      props: {title: "Welcome to my home page",},
      slot: `<h1>Hello, world!</h1>
${await UnderlinedLink.render({
      props: {href: "/about",},
      slot: `About
<svg slot="icon"></svg>`,
      namedSlots: null,
    })}
${await (async ()=>{
            return props.showForm ? `<div><form${await (async ()=> {
            const __tmph_value_7pw2v4rmau = (()=>{
              const __tmph_result_uczoj3w69o = props.formProps;
              if(typeof __tmph_result_uczoj3w69o !== "object") {
                console.warn(`Attempted to spread non-object value ${__tmph_result_uczoj3w69o} onto element attributes`);
                return {};
              }
              return __tmph_result_uczoj3w69o;
            })();
            let __tmph_attributePromises_ag4lu94sd8o = [];
            for(const __tmph_key_aksd53danub in __tmph_value_7pw2v4rmau){
              __tmph_attributePromises_ag4lu94sd8o.push(renderAttributeToString(__tmph_key_aksd53danub, __tmph_value_7pw2v4rmau[__tmph_key_aksd53danub]));
            }
            const __tmph_result_3xr10vck0f =  (await Promise.all(__tmph_attributePromises_ag4lu94sd8o)).join(" ");
            return __tmph_result_3xr10vck0f ? ` ${__tmph_result_3xr10vck0f}` : "";
          })()}></form></div>` : "";
          })()}`,
      namedSlots: null,
    })}`;
    }