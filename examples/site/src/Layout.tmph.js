import n from"#tmph/render/escapeText.js";export async function render({props:e,slot:t,namedSlots:m}){return`<html lang="en-US">

<head>


<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>
${n((()=>e.title)())}</title></head>
<body>
${t??""}</body></html>`}
