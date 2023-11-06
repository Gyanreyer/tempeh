import e from"#tmph/render/escapeText.js";export async function render({props:t,slot:n,namedSlots:a}){return`<html lang="en-US">

<head>


<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>
${e((()=>t.title)())}</title></head>
<body>
<slot></body></html>`}
