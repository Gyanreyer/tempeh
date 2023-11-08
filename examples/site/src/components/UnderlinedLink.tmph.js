import p from"#tmph/render/renderAttributes.js";export async function render({props:r,slot:e,namedSlots:t}){return`<a${await p("href",(()=>r.href)())}>

${e??""}
${t?.icon??""}</a>`}
