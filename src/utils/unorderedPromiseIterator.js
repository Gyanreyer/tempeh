/**
 * Takes an array of promises and yields the resolved values in the order they resolve.
 * @template TResolveValue
 * @param {Promise<TResolveValue>[]} promises
 */
export async function* unorderedPromiseIterator(promises) {
  const resultStream = new ReadableStream({
    async pull(controller) {
      /** @param {TResolveValue} value */
      const onResolve = (value) => {
        controller.enqueue(value);
      };

      /** @param {unknown} err */
      const onError = (err) => {
        controller.enqueue(
          new Error("unorderedPromiseIterator: An unexpected error occurred.", {
            cause: err,
          })
        );
      };

      for (const promise of promises) {
        promise.then(onResolve, onError);
      }

      await Promise.allSettled(promises);
      controller.close();
    },
  });

  const reader = resultStream.getReader();

  try {
    /** @type {Awaited<ReturnType<typeof reader.read>>} */
    let readResult;
    while (!(readResult = await reader.read()).done) {
      yield readResult.value;
    }
  } finally {
    reader.releaseLock();
  }
}
