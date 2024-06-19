import { generate as generateJsString } from "astring";

import { getComponentNameFromPath } from "./getComponentNameFromPath.js";

/** @import * as estree from '../ast/estree' */

/**
 * @typedef {import("../ast/estree").ImportDeclaration} ImportDeclaration
 * @typedef {import("../ast/estree").Identifier} Identifier
 */

/** @type {Identifier} */
const TMPHHtmlImportSpecifier = {
  type: "Identifier",
  name: "TmphHTML",
};

/** @type {Identifier} */
const htmlImportSpecifier = {
  type: "Identifier",
  name: "html",
};

/** @type {ImportDeclaration} */
const htmlImport = {
  type: "ImportDeclaration",
  source: {
    type: "Literal",
    value: "tempeh/render",
  },
  specifiers: [
    {
      type: "ImportSpecifier",
      imported: TMPHHtmlImportSpecifier,
      local: TMPHHtmlImportSpecifier,
    },
    {
      type: "ImportSpecifier",
      imported: htmlImportSpecifier,
      local: htmlImportSpecifier,
    },
  ],
};

/** @type {Identifier} */
const renderMethodIdentifier = {
  type: "Identifier",
  name: "render",
};

/**
 * @param {import("../parseTemplate").TemplateDataAST} templateData
 */
export function convertTemplateDataToJS(templateData) {
  /** @type {string | undefined} */
  let componentName;

  /** @type {import("../ast/estree").Program} */
  const compiledDocumentAST = {
    type: "Program",
    sourceType: "module",
    body: [],
  };

  /** @type {ImportDeclaration[]} */
  const importStatements = [htmlImport];

  const srcURL = new URL(templateData.src);

  for (const node of templateData.nodes) {
    if ("tagName" in node) {
      switch (node.tagName) {
        case "link": {
          /** @type {string | undefined} */
          let linkRel;
          /** @type {string | undefined} */
          let linkHref;
          /** @type {string | undefined} */
          let importName;

          for (const attribute of node.attributes ?? []) {
            switch (attribute.name) {
              case "href":
                if (!linkHref) {
                  linkHref = attribute.value;
                } else {
                  return new Error(
                    `${templateData.src}:${attribute.c}:${attribute.l} Multiple href attributes found in link tag`
                  );
                }
                break;
              case "as":
                importName = attribute.value;
                break;
              case "rel":
                linkRel = attribute.value;
                break;
            }
          }

          if (!linkHref) {
            return new Error(
              `${templateData.src}:${node.c}:${node.l} Link tag missing href attribute`
            );
          }

          if (linkRel === "import") {
            let isDefaultImport = true;
            /** @type {string | undefined} */
            let namedImport;

            const hrefURL = new URL(linkHref, srcURL);

            if (!importName) {
              if (hrefURL.hash) {
                isDefaultImport = false;
                importName = hrefURL.hash.slice(1);
              } else if (!hrefURL.pathname.endsWith(".tmph.html")) {
                return new Error(
                  `${templateData.src}:${node.c}:${node.l} Import links currently only support .tmph.html files`
                );
              } else {
                importName = getComponentNameFromPath(linkHref);
              }
            }

            importStatements.push({
              type: "ImportDeclaration",
              source: {
                type: "Literal",
                value: linkHref,
              },
              specifiers: [
                isDefaultImport
                  ? {
                      type: "ImportDefaultSpecifier",
                      local: {
                        type: "Identifier",
                        name: importName,
                      },
                    }
                  : {
                      type: "ImportSpecifier",
                      imported: {
                        type: "Identifier",
                        name: importName,
                      },
                      local: {
                        type: "Identifier",
                        name: importName,
                      },
                    },
                {
                  type: "ImportSpecifier",
                  imported: TMPHHtmlImportSpecifier,
                  local: TMPHHtmlImportSpecifier,
                },
                {
                  type: "ImportSpecifier",
                  imported: htmlImportSpecifier,
                  local: htmlImportSpecifier,
                },
              ],
            });
          }
        }
      }
    }
  }

  for (const node of templateData.nodes) {
    if ("tagName" in node) {
      // compiledDocumentAST.body.push(node.childNodes);
    } else {
      node.textContent;
    }
  }

  /** @type {import("../ast/estree").FunctionExpression} */
  const componentRenderMethodExpression = {
    type: "FunctionExpression",
    async: false,
    generator: false,
    id: null,
    params: [],
    body: {
      type: "BlockStatement",
      body: [],
    },
  };

  /** @type {import("../ast/estree").MethodDefinition} */
  const componentRenderMethod = {
    type: "MethodDefinition",
    kind: "method",
    static: false,
    computed: false,
    key: renderMethodIdentifier,
    value: componentRenderMethodExpression,
  };

  /** @type {import("../ast/estree").ClassDeclaration} */
  const componentClass = {
    type: "ClassDeclaration",
    superClass: null,
    id: {
      type: "Identifier",
      // If a component tag was not specified via a meta tag, extract a default name from
      // the template file path
      name: componentName || getComponentNameFromPath(templateData.src),
    },
    body: {
      type: "ClassBody",
      body: [componentRenderMethod],
    },
  };

  /** @type {import("../ast/estree").ExportDefaultDeclaration} */
  const componentExportDeclaration = {
    type: "ExportDefaultDeclaration",
    declaration: componentClass,
  };

  compiledDocumentAST.body.push(
    ...importStatements,
    componentExportDeclaration
  );

  // TODO: astring.generate can accept a writable stream. Use that to write the file!
  // const writeStream = new WritableStream();

  return generateJsString(compiledDocumentAST);
}
