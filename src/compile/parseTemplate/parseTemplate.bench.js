import { promises } from "node:fs";
import {
  startTemplateParserServer,
  stopTemplateParserServer,
} from "./templateParserServer.js";
import { parseTemplate } from "./parseTemplate.js";
import { resolveRelativePath } from "../../utils/resolveRelativePath.js";
import path from "node:path";
import os from "node:os";

const fixturesDirPath = resolveRelativePath(
  "../../../test/fixtures/",
  import.meta
);

const testFixtureFilePaths = await promises
  .readdir(fixturesDirPath)
  .then((fileNames) =>
    fileNames.map((fileName) => path.join(fixturesDirPath, fileName))
  );

const totalMemory = os.totalmem();

const initialMemoryUse = totalMemory - os.freemem();

/**
 *
 * @param {string} context
 */
const logMemoryUsage = (context) => {
  console.log(
    `Memory used (${context}): ${
      (totalMemory - os.freemem() - initialMemoryUse) >> 20
    }MB`
  );
};

const startTemplateParserServerStartTime = performance.now();
const parserServerOrigin = await startTemplateParserServer();
const startTemplateParserServerEndTime = performance.now();
console.log(
  `startTemplateParserServer: ${
    startTemplateParserServerEndTime - startTemplateParserServerStartTime
  }ms`
);

if (!parserServerOrigin) {
  throw new Error("Template parser server not running");
}

logMemoryUsage("after starting server");

let memoryCheckID = setImmediate(function checkMemLoop() {
  logMemoryUsage("interval");
  memoryCheckID = setImmediate(checkMemLoop);
});

// const timings = new Map();

const parseAllTemplatesStartTime = performance.now();
await Promise.all(
  testFixtureFilePaths.map(async (filePath) => {
    // const startTime = performance.now();
    await parseTemplate(filePath);
    // const parseTemplateEndTime = performance.now();
    // timings.set(filePath, parseTemplateEndTime - startTime);
  })
);

clearImmediate(memoryCheckID);
logMemoryUsage("after parsing");

// console.log("Individual parseTemplate timings", timings);
const parseAllTemplatesEndTime = performance.now();
console.log(
  "total parsing time:",
  `${parseAllTemplatesEndTime - parseAllTemplatesStartTime}ms;`,
  "average:",
  `${
    (parseAllTemplatesEndTime - parseAllTemplatesStartTime) /
    testFixtureFilePaths.length
  }ms`
);

stopTemplateParserServer();

logMemoryUsage("after stopping server");
