import*as i from"/Users/ryangeyer/Projects/tempeh/examples/site/src/components/UnderlinedLink.tmph.js";import*as m from"/Users/ryangeyer/Projects/tempeh/examples/site/src/Layout.tmph.js";import _ from"#tmph/render/renderAttributes.js";export async function render({props:e,slot:l,namedSlots:a}){return`<link rel="import" href="..&#x2F;Layout.tmph.html">
<link rel="import" href="..&#x2F;components&#x2F;UnderlinedLink.tmph.html">
${await m.render({props:{title:"Welcome to my home page"},slot:`


<h1>
Hello, world!</h1>
${await i.render({props:{href:"/about"},slot:`

About
<svg slot="icon">`})}
${await(async()=>e.showForm?`<div>
<form${await(async()=>{const r=(()=>{let t=e.formProps;return typeof t!="object"?(console.warn(`Attempted to spread non-object value ${t} onto element attributes`),{}):t})();let o=[];for(const t in r)o.push(_(t,r[t]));const n=(await Promise.all(o)).join(" ");return n?` ${n}`:""})()}></div>`:"")()}`})}`}
