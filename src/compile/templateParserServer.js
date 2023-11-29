import { spawn } from "node:child_process";
import { resolveRelativePath } from "../utils/resolveRelativePath.js";

const parserBinaryPath = resolveRelativePath(
  "../../bin/parse-template",
  import.meta
);

/** @type {import("node:child_process").ChildProcessWithoutNullStreams | null} */
let parserProcess = null;

export async function startTemplateParserServer() {
  if (!parserProcess) {
    await /** @type {Promise<void>} */ (
      new Promise((resolve, reject) => {
        parserProcess = spawn(parserBinaryPath);
        parserProcess.addListener("spawn", () => resolve());
        parserProcess.addListener("error", () => reject());
      })
    );
  }
}

export function stopTemplateParserServer() {
  if (parserProcess) {
    parserProcess.kill();
    parserProcess = null;
  }
}
