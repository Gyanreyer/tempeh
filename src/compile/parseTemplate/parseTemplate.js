import { Worker } from "node:worker_threads";
import { cpus } from "node:os";

/** @typedef {import("./templateData").TemplateDataAST} TemplateDataAST */

/**
 * @type {Worker[]}
 */
const workerPool = [];
const workerPoolEventTarget = new EventTarget();

/**
 * Maps worker proxies to their underlying worker instances
 * so we can terminate them on cleanup.
 * @type {Set<Worker>}
 */
const workers = new Set();

let awaitingWorkerCount = 0;

const workerURL = new URL(import.meta.resolve("./parseTemplate.worker.js"));

const cpuCount = cpus().length;

const onceEventListenerConfig = {
  once: true,
};

/**
 *
 * @param {(worker: Worker) => void} resolve
 */
const getFutureWorkerPromiseCB = (resolve) => {
  const awaitingWorkerID = ++awaitingWorkerCount;
  workerPoolEventTarget.addEventListener(
    `push:${awaitingWorkerID}`,
    function onPush() {
      const worker = workerPool.pop();
      if (worker) {
        resolve(worker);
      }
    },
    onceEventListenerConfig
  );
};

const getWorker = async () => {
  const pooledWorker = workerPool.pop();
  if (pooledWorker) {
    return pooledWorker;
  } else if (workers.size < cpuCount) {
    const newWorker = new Worker(workerURL);
    workers.add(newWorker);
    return newWorker;
  } else {
    return new Promise(getFutureWorkerPromiseCB);
  }
};

/**
 * @param {Worker} worker
 */
const returnWorkerToPool = (worker) => {
  workerPool.push(worker);
  workerPoolEventTarget.dispatchEvent(
    new Event(`push:${awaitingWorkerCount--}`)
  );
};

/**
 * Takes the path to a .tmph.html file and parses it into a JSON object
 * that can be used by the compiler.
 * @param {string} filePath
 * @returns {Promise<import("./templateData").TemplateDataAST | Error>}
 */
export async function parseTemplate(filePath) {
  const worker = await getWorker();
  const parseTemplateResultPromise = new Promise((resolve) =>
    worker.once("message", resolve)
  ).then((result) => {
    returnWorkerToPool(worker);
    return result;
  });

  worker.postMessage(filePath);

  return parseTemplateResultPromise;
}

export function cleanupWorkers() {
  for (const worker of workers) {
    worker.terminate();
  }
  workers.clear();
  workerPool.length = 0;
}

process.on("exit", cleanupWorkers);
