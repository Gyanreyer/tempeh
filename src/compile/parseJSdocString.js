import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

import { getRandomString } from "../utils/getRandomString.js";

const jsdocBinaryPath = import.meta
  .resolve("../../node_modules/.bin/jsdoc")
  .replace("file://", "");

// Creating a re-usable array to avoid unnecessary garbage collection
// for the arguments we'll be passing when spawning the parser process.
const jsdocProcessArgs = new Array(2);
jsdocProcessArgs[0] = "-X";

/**
 * @param {string} jsDocString
 */
export async function parseJSdocString(jsDocString) {
  const tempDir = await mkdtemp(join(tmpdir(), ".tmph-"));

  const tempFilePath = join(tempDir, `${getRandomString()}.js`);
  await writeFile(tempFilePath, jsDocString);

  /** @type {Array<Object>} */
  const parsedJSDocData = await new Promise((resolve, reject) => {
    // Concatentating buffers requires an array,
    // so we'll create a re-usable one at the top to avoid
    // unnecessary garbage collection. The first item will represent
    // the buffer we're writing to, and the second will be the latest buffer data that
    // we're appending.
    const bufferArray = new Array(2);
    bufferArray[0] = Buffer.from("", "utf8");

    jsdocProcessArgs[1] = tempFilePath;
    const process = spawn(jsdocBinaryPath, jsdocProcessArgs);

    process.on("error", reject);

    // As data streams in from stdout, append it to the buffer
    process.stdout.on("data", (data) => {
      bufferArray[1] = data;
      bufferArray[0] = Buffer.concat(bufferArray);
    });

    // Once we've reached the end of the stdout stream, parse the buffer and resolve
    process.stdout.on("end", () => {
      resolve(JSON.parse(bufferArray[0].toString("utf-8")));
    });
  }).finally(() => rm(tempDir, { recursive: true }));

  return parsedJSDocData;
}
