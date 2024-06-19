import { describe, test } from "node:test";
import * as assert from "node:assert";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

import { parseTemplate } from "../parseTemplate/index.js";
import { convertTemplateDataToJS } from "./convertTemplateDataToJS.js";

const fixtureDirPath = import.meta.resolve("./test-fixtures").slice(7);

const allFixtureFilePaths = readdirSync(fixtureDirPath);

const templateFileFixturePaths = allFixtureFilePaths
  .filter((fileName) => fileName.endsWith(".html"))
  .map((fileName) => `${fixtureDirPath}/${fileName}`);

const templateOutputJSFixturePaths = allFixtureFilePaths
  .filter((fileName) => fileName.endsWith(".js.txt"))
  .map((fileName) => `${fixtureDirPath}/${fileName}`);

describe("convertTemplateDataToJS", () => {
  test("template files are compiled into JavaScript as expected", async () => {
    for (let i = 0; i < templateFileFixturePaths.length; ++i) {
      const templateFilePath = templateFileFixturePaths[i];
      const expectedJsFilePath = templateOutputJSFixturePaths[i];
      if (!templateFilePath || !expectedJsFilePath) {
        throw new Error("templateFilePath or expectedJsFilePath did not exist");
      }

      const expectedJsString =
        readFileSync(expectedJsFilePath).toString("utf-8");
      const compiledJsString = await parseTemplate(templateFilePath).then(
        (parsedTemplateData) => convertTemplateDataToJS(parsedTemplateData)
      );

      writeFileSync(
        import.meta
          .resolve(`./.compiled.${expectedJsFilePath.split("/").at(-1)}`)
          .slice(7),
        compiledJsString,
        "utf-8"
      );

      assert.strictEqual(compiledJsString, expectedJsString);
    }
  });
});
