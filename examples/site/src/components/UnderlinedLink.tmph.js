
    import renderAttributeToString from "#tmph/render/renderAttributes.js";
    
    
    /**
     * @param {Object} params
     * @param {Props} params.props
     * @param {string|null} params.slot
     * @param {Record<string, string>|null} params.namedSlots
     */
    export async function render({ props, slot, namedSlots }) {
      return `<a${await renderAttributeToString(
            "href",
            props.href,
          )}>${slot ?? ""}${namedSlots?.icon ?? ""}</a>`;
    }