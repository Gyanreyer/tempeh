
    import * as Layout from "/Users/ryangeyer/Projects/tempeh/examples/site/src/Layout.tmph.js";import * as UnderlinedLink from "/Users/ryangeyer/Projects/tempeh/examples/site/src/components/UnderlinedLink.tmph.js";import renderAttributeToString from "#tmph/render/renderAttributes.js";
    
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
            const __tmph_value_whza5na1abk = (()=>{
              const __tmph_result_zxkdd35u6w = props.formProps;
              if(typeof __tmph_result_zxkdd35u6w !== "object") {
                console.warn(`Attempted to spread non-object value ${__tmph_result_zxkdd35u6w} onto element attributes`);
                return {};
              }
              return __tmph_result_zxkdd35u6w;
            })();
            let __tmph_attributePromises_opa18ducb2 = [];
            for(const __tmph_key_ylprvunktsm in __tmph_value_whza5na1abk){
              __tmph_attributePromises_opa18ducb2.push(renderAttributeToString(__tmph_key_ylprvunktsm, __tmph_value_whza5na1abk[__tmph_key_ylprvunktsm]));
            }
            const __tmph_result_k727j7h2h4 =  (await Promise.all(__tmph_attributePromises_opa18ducb2)).join(" ");
            return __tmph_result_k727j7h2h4 ? ` ${__tmph_result_k727j7h2h4}` : "";
          })()}></form></div>` : "";
          })()}`,
      namedSlots: null,
    })}`;
    }