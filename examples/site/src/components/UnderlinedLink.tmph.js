import _ from"#tmph/render/renderAttributes.js";export async function render({props:r,slot:e,namedSlots:t}){return`<a${await _("href",(()=>r.href)())}>

${e??""}
${t?.icon??""}</a>`}
