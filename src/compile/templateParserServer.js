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

export async function startTemplateParserServer() {
  if (!parserProcess) {
    await /** @type {Promise<void>} */ (
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
