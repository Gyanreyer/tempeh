import { renderAttributes, defaultProps, html } from "tempeh/render";

const imports = await Promise.all([
  import("./Layout.tmph.js"),
  import("./UnderlinedLink.tmph.js"),
]);

/**
 * @typedef  {Object} Props
 * @property {boolean} [showForm=false]
 * @property {Record<string, string>} [formProps]
 */

/**
 * @param {Object} params
 */
export async function render({ props }) {
  const [Layout, UnderlinedLink] = imports;

  defaultProps(props, {
    showForm: false,
    formProps: {
      method: "POST",
    },
  });

  return Layout.render({
    props: {
      title: "Welcome to my home page",
    },
    slot: html`
      <h1>Hello, world!</h1>
      ${UnderlinedLink.render({
        props: {
          href: "/about",
        },
        slot: "About",
        namedSlots: {
          icon: "<svg></svg>",
        },
      })}
      ${props.showForm
        ? html`
            <div>
              <form ${renderAttributes(props.formProps)}></form>
            </div>
          `
        : ""}
    `,
  });
}
