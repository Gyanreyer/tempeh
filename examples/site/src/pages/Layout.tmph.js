import { defaultProps, escapeText, html } from "tempeh/render";

/**
 * @typedef  {Object} Props
 * @property {string} [props.title="My Tempeh Site"]
 */

/**
 * @param {Object} params
 * @param {Props}  [params.props]
 * @param {string} params.slot
 */
export async function render({ props, slot }) {
  defaultProps(props, {
    title: "My Tempeh Site",
  });

  return html`<!DOCTYPE html>
    <html lang="en-US">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeText(props.title)}</title>
      </head>
      <body>
        ${slot}
      </body>
    </html>`;
}
