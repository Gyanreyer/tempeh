import { spawn } from "node:child_process";
import { resolveRelativePath } from "../../utils/resolveRelativePath.js";

const parserBinaryPath = resolveRelativePath(
  "../../../bin/parse-template",
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
      startingParserPromise = new Promise((resolve, reject) => {
        parserProcess = spawn(parserBinaryPath);
        parserProcess?.addListener("error", (err) => reject(err));
        parserProcess?.stdout.on(
          "data",
          /** @param {ArrayBuffer} message */
          async (message) => {
            parserProcessServerOrigin = message.toString();
            try {
              const healthResponse = await fetch(
                new URL("/health", parserProcessServerOrigin)
              );
              if (!healthResponse.ok) {
                console.log("Health check failed");
                throw new Error("Template parser server failed health check");
              }
            } catch (err) {
              parserProcessServerOrigin = null;
              reject(
                new Error(
                  `Template parser server failed to start at ${parserProcessServerOrigin}`,
                  {
                    cause: err,
                  }
                )
              );
            }

            resolve(undefined);
          }
        );
      }).finally(() => {
        // Clean up the listeners we added
        parserProcess?.removeAllListeners();
        parserProcess?.stdout.removeAllListeners();
      });

      try {
        await startingParserPromise;
      } catch (e) {
        console.error("Template parser server failed to start", e);
        parserProcess = null;
        parserProcessServerOrigin = null;
      }

      startingParserPromise = null;
    }
  }

  return parserProcessServerOrigin;
}

export function getTemplateParserServerOrigin() {
  return parserProcessServerOrigin;
}

export function stopTemplateParserServer() {
  if (parserProcess) {
    parserProcess.kill();
    parserProcess = null;
    parserProcessServerOrigin = null;
  }
}
