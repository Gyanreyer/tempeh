/**
 * @type {Record<string, HTMLTemplateElement>}
 */
const __tmph__templateElements = {};

/**
 * @typedef {Record<string|symbol, {
 *   value: any;
 *   attributeName?: string;
 * }>} TmphState
 */

export class TmphElement extends HTMLElement {
  #tagName = "";
  #templateString = "";
  /** @type {TmphState | null} */
  #state = null;

  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: "open" });

    let template = __tmph__templateElements[this.#tagName];

    if (!template) {
      template = document.createElement("template");
      template.innerHTML = this.#templateString;
      __tmph__templateElements[this.#tagName] = template;
    }

    shadowRoot.appendChild(template.cloneNode(true));

    if (this.#state) {
      this.state = new Proxy(this.#state, {
        get: (target, name) => target[name]?.value,
        set: (target, name, value) => {
          if (!(name in target)) {
            return false;
          }

          const stateEntry = target[name];

          stateEntry.value = value;
          const attributeName = stateEntry.attributeName;
          if (attributeName) {
            this.setAttribute(attributeName, value);
          }
          shadowRoot.querySelector(`  `).textContent = value;
          return true;
        },
      });
    }
  }
}
