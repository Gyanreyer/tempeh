import n from"#tmph/render/renderAttributes.js";export async function render({props:r,slot:t,namedSlots:e}){return`<a${await n("href",(()=>r.href)())}>

${t??""}
${e?.icon??""}</a>`}
