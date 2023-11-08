import a from"#tmph/render/escapeText.js";export async function render({props:t,slot:e,namedSlots:n}){return`
<!DOCTYPE html>
<html lang="en-US">

<head>


<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>
${a((()=>t.title)())}</title></head>
<body>
${e??""}</body></html>`}
