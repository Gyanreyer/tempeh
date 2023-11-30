import { spawn } from "node:child_process";
import { resolveRelativePath } from "../utils/resolveRelativePath.js";

const parserBinaryPath = resolveRelativePath(
  "../../bin/parse-template",
  import.meta
);

/** @type {import("node:child_process").ChildProcessWithoutNullStreams | null} */
let parserProcess = null;
/** @type {string | null} */
let parserProcessServerOrigin = null;

/** @type {Promise<void> | null} */
let startingParserPromise = null;

export async function startTemplateParserServer() {
  if (!parserProcess) {
    if (startingParserPromise) {
      await startingParserPromise;
    } else {
      startingParserPromise = /** @type {Promise<void>} */ (
        new Promise((resolve, reject) => {
          parserProcess = spawn(parserBinaryPath);

          parserProcess.addListener("error", () => reject());
          parserProcess.stdout.on("data", (message) => {
            parserProcessServerOrigin = message.toString();

            if (!parserProcessServerOrigin?.startsWith("http://localhost")) {
              reject(
                new Error("Template parser server failed to start correctly")
              );
            } else {
              resolve();
            }
          });
        })
      ).finally(() => {
        // Clean up the listeners we added
        parserProcess?.removeAllListeners();
        parserProcess?.stdout.removeAllListeners();
      });

      try {
        await startingParserPromise;
      } catch (e) {
        console.error("Template parser server failed to start");
        parserProcess = null;
        parserProcessServerOrigin = null;
      }

      startingParserPromise = null;
    }
  }

  return parserProcessServerOrigin;
}

export function stopTemplateParserServer() {
  if (parserProcess) {
    parserProcess.kill();
    parserProcess = null;
    parserProcessServerOrigin = null;
  }
}
