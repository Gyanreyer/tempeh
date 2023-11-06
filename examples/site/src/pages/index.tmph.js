import*as a from"/Users/ryangeyer/Projects/tempeh/examples/site/src/components/UnderlinedLink.tmph.js";import*as _ from"/Users/ryangeyer/Projects/tempeh/examples/site/src/Layout.tmph.js";import m from"#tmph/render/renderAttributes.js";export async function render({props:e,slot:s,namedSlots:l}){return`${await _.render({props:{title:"Welcome to my home page"},slot:`<h1>
Hello, world!</h1>
${await a.render({props:{href:"/about"},slot:"About",namedSlots:{icon:"<svg></svg>"}})}
${await(async()=>e.showForm?`<div>
<form${await(async()=>{const o=(()=>{let t=e.formProps;return typeof t!="object"?(console.warn(`Attempted to spread non-object value ${t} onto element attributes`),{}):t})();let r=[];for(const t in o)r.push(m(t,o[t]));const n=(await Promise.all(r)).join(" ");return n?` ${n}`:""})()}></form></div>`:"")()}`,namedSlots:null})}`}
