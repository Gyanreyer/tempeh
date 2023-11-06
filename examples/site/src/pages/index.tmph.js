import*as s from"/Users/ryangeyer/Projects/tempeh/examples/site/src/components/UnderlinedLink.tmph.js";import*as _ from"/Users/ryangeyer/Projects/tempeh/examples/site/src/Layout.tmph.js";import a from"#tmph/render/renderAttributes.js";export async function render({props:e,slot:m,namedSlots:i}){return`${await _.render({props:{title:"Welcome to my home page"},slot:`<h1>
Hello, world!</h1>
${await s.render({props:{href:"/about"},slot:"About",namedSlots:{icon:"<svg></svg>"}})}
${await(async()=>e.showForm?`<div>
<form${await(async()=>{const r=(()=>{let t=e.formProps;return typeof t!="object"?(console.warn(`Attempted to spread non-object value ${t} onto element attributes`),{}):t})();let o=[];for(const t in r)o.push(a(t,r[t]));const n=(await Promise.all(o)).join(" ");return n?` ${n}`:""})()}></form></div>`:"")()}`,namedSlots:null})}`}
