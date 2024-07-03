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

const parseAllTemplatesStartTime = performance.now();
for (const filePath of testFixtureFilePaths) {
  const runCount = Math.round(5 + Math.random() * 10);
  let totalTime = 0;
  for (let i = 0; i < runCount; ++i) {
    // await Promise.all(
    //   testFixtureFilePaths.map(async (filePath) => {
    const startTime = performance.now();
    await parseTemplate(filePath);
    const parseTemplateEndTime = performance.now();
    totalTime += parseTemplateEndTime - startTime;
  }

  console.log(
    `Average time for ${runCount} runs parsing ${filePath}: ${
      totalTime / runCount
    }ms`
  );
  // const parseTemplateEndTime = performance.now();
  // console.log(
  //   `parseTemplate(${filePath}): ${parseTemplateEndTime - startTime}ms`
  // );
  // timings.set(filePath, parseTemplateEndTime - startTime);
  //   })
  // );
}

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
