export const makeRenderScope = () => {
  /**
   * @type {Set<string>}
   */
  const definitions = new Set();

  const renderDefinitions = () => {
    let renderedDefinitionsString = "";
    for (const definition of definitions) {
      renderedDefinitionsString += `let ${definition};\n`;
    }
    return renderedDefinitionsString;
  };

  /**
   * @type {string[]}
   */
  const logicSnippets = [];

  const renderLogic = () => {
    let renderedLogicString = "";
    for (const logicSnippet of logicSnippets) {
      renderedLogicString += `
{
  ${logicSnippet}
}
`;
    }
    return renderedLogicString;
  };

  let tagName = "";

  let attributes = {};

  let childContents = [];

  return {
    /**
     * @param {string} definition
     */
    addDefinition: (definition) => {
      definitions.add(definition);
    },
    /**
     * @param {string} logicString
     */
    addLogicSnippet: (logicString) => {
      logicSnippets.push(logicString);
    },
    /**
     *
     * @param {(currentRenderString: string) => string} getRenderString
     */
    updateRenderString: (getRenderString) => {
      renderString = getRenderString(renderString);
    },
    render: () => `
  ${renderDefinitions()}
  ${renderLogic()}
  ${renderString}
`,
  };
};
