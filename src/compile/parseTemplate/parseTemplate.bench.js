import { promises } from "node:fs";
// import {
//   startTemplateParserServer,
//   stopTemplateParserServer,
// } from "./templateParserServer.js";
import { parseTemplate } from "./parseTemplate.js";
import { resolveRelativePath } from "../../utils/resolveRelativePath.js";
import path from "node:path";
// import os from "node:os";

const fixturesDirPath = resolveRelativePath(
  "../../../test/fixtures/",
  import.meta
);

const testFixtureFilePaths = await promises
  .readdir(fixturesDirPath)
  .then((fileNames) =>
    fileNames.map((fileName) => path.join(fixturesDirPath, fileName))
  );

// const totalMemory = os.totalmem() >> 10;

// const initialMemoryUse = totalMemory - (os.freemem() >> 10);

/**
 *
 * @param {string} context
 */
// const logMemoryUsage = (context) => {
//   console.log(
//     `Memory used (${context}): ${
//       totalMemory - (os.freemem() >> 10) - initialMemoryUse
//     }KB`
//   );
// };
// let memoryCheckID = setImmediate(function checkMemLoop() {
//   logMemoryUsage("interval");
//   memoryCheckID = setImmediate(checkMemLoop);
// });

// const startTemplateParserServerStartTime = performance.now();
// const parserServerOrigin = await startTemplateParserServer();
// const startTemplateParserServerEndTime = performance.now();
// console.log(
//   `startTemplateParserServer: ${
//     startTemplateParserServerEndTime - startTemplateParserServerStartTime
//   }ms`
// );

// if (!parserServerOrigin) {
//   throw new Error("Template parser server not running");
// }

// logMemoryUsage("after starting server");

// const timings = new Map();

// const parseAllTemplatesStartTime = performance.now();

let averageTimings = 0;

for (const filePath of testFixtureFilePaths) {
  const runCount = Math.round(5 + Math.random() * 10);
  let totalTime = 0;
  for (let i = 0; i < runCount; ++i) {
    const startTime = performance.now();
    for await (const node of parseTemplate(filePath)) {
      // just run through the iterator
    }
    const parseTemplateEndTime = performance.now();
    totalTime += parseTemplateEndTime - startTime;
  }

  const averageTime = totalTime / runCount;
  averageTimings += averageTime;

  console.log(
    `Average time for ${runCount} runs parsing ${filePath}: ${averageTime}ms`
  );
}

console.log(
  `\nAverage time for all templates: ${
    averageTimings / testFixtureFilePaths.length
  }ms`
);

// console.log("Individual parseTemplate timings", timings);
// const parseAllTemplatesEndTime = performance.now();
// console.log(
//   "total parsing time:",
//   `${parseAllTemplatesEndTime - parseAllTemplatesStartTime}ms;`,
//   "average:",
//   `${
//     (parseAllTemplatesEndTime - parseAllTemplatesStartTime) /
//     testFixtureFilePaths.length
//   }ms`
// );

// cleanupWorkers();

// stopTemplateParserServer();

// clearImmediate(memoryCheckID);
// logMemoryUsage("after parsing");
