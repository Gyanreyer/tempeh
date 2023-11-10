import { spawn } from "node:child_process";

import { deepPreventExtensions } from "../utils/deepPreventExtensions.js";

/**
 * @typedef {Object} TmphNode
 * @property {string|null} tagName
 * @property {Array<TmphNode | string>|null} children
 * @property {Array<string|true>|null} attributes
 */

/**
 * @typedef {Array<TmphNode | string>} RootNodeArray
 */

const parserBinaryPath = import.meta
  .resolve("../../bin/parse-xml")
  .replace("file://", "");

// Creating a re-usable array to avoid unnecessary garbage collection
// for the arguments we'll be passing when spawning the parser process.
const parserProcessArgs = new Array(2);
parserProcessArgs[0] = "--file";

/**
 * Takes the path to a .tmph.html file and parses it into an array of TmphNodes
 * @param {string} path
 */
export async function parseXML(path) {
  // Prevent extension on all items in the node tree. This means that items can be deleted
  // or modified, but never added. This should hopefully reduce memory usage.
  return deepPreventExtensions(
    await /** @type {Promise<RootNodeArray>} */ (
      new Promise((resolve, reject) => {
        // Concatentating buffers requires an array,
        // so we'll create a re-usable one at the top to avoid
        // unnecessary garbage collection. The first item will represent
        // the buffer we're writing to, and the second will be the latest buffer data that
        // we're appending.
        const bufferArray = new Array(2);
        bufferArray[0] = Buffer.from("", "utf8");

        parserProcessArgs[1] = path;
        // Spawn a process to run the parser binary
        const process = spawn(parserBinaryPath, parserProcessArgs);

        process.on("error", reject);

        // As data streams in from stdout, append it to the buffer
        process.stdout.on("data", (data) => {
          bufferArray[1] = data;
          bufferArray[0] = Buffer.concat(bufferArray);
        });

        // Once we've reached the end of the stdout stream, parse the buffer and resolve
        // with the parsed node data
        process.stdout.on("end", () => {
          resolve(JSON.parse(bufferArray[0].toString("utf-8")));
        });
      })
    )
  );
}
