export class TmphHTML {
  #strings;
  #exps;

  /**
   * @param {TemplateStringsArray} strings
   * @param  {...unknown} exps
   */
  constructor(strings, ...exps) {
    /** @type {TemplateStringsArray} */
    this.#strings = strings;
    /** @type {unknown[]} */
    this.#exps = exps;
  }

  /**
   * Async generator which yields each chunk of the html text stream as it is rendered.
   */
  async *[Symbol.asyncIterator]() {
    const textStream = this.textStream();
    const reader = textStream.getReader();

    try {
      for (
        let readResult = await reader.read();
        !readResult.done;
        readResult = await reader.read()
      ) {
        yield readResult.value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Takes a readable stream controller and an expression value and enqueues
   * the value as a string or async generator function.
   * @param {ReadableStreamDefaultController<string>} controller
   * @param {any} expressionValue
   */
  static #enqueueExpressionValue = async (controller, expressionValue) => {
    // Skip undefined, null, false, and empty string values
    if (
      expressionValue === undefined ||
      expressionValue === null ||
      expressionValue === false ||
      expressionValue === ""
    ) {
      return;
    }

    if (expressionValue instanceof Promise) {
      // If the expression is a promise, unwrap it and enqueue the resolved value
      try {
        await TmphHTML.#enqueueExpressionValue(
          controller,
          await expressionValue
        );
      } catch (error) {
        console.error(
          "An error occurred while rendering async HTML content:",
          error
        );
      }
      return;
    }

    let isSyncGeneratorFunction = false;
    let isAsyncGeneratorFunction = false;

    switch (typeof expressionValue) {
      case "function": {
        const constructorName = expressionValue.constructor.name;
        isSyncGeneratorFunction = constructorName === "GeneratorFunction";
        isAsyncGeneratorFunction = constructorName === "AsyncGeneratorFunction";
        break;
      }
      case "object": {
        if (Symbol.asyncIterator in expressionValue) {
          isAsyncGeneratorFunction = true;
          // Re-assign the expressionValue to the async generator function, bound to the expressionValue object
          // so references to `this` will work as expected
          expressionValue = /** @type {AsyncGeneratorFunction} */ (
            expressionValue[Symbol.asyncIterator]
          ).bind(expressionValue);
        } else if (Symbol.iterator in expressionValue) {
          isSyncGeneratorFunction = true;
          expressionValue = /** @type {GeneratorFunction} */ (
            expressionValue[Symbol.iterator]
          ).bind(expressionValue);
        }
        break;
      }
    }

    if (isSyncGeneratorFunction) {
      for (const chunk of expressionValue()) {
        await TmphHTML.#enqueueExpressionValue(controller, chunk);
      }
    } else if (isAsyncGeneratorFunction) {
      for await (const chunk of expressionValue()) {
        await TmphHTML.#enqueueExpressionValue(controller, chunk);
      }
    } else {
      controller.enqueue(String(expressionValue));
    }
  };

  /**
   * Gets a ReadableStream<string> which can be used to stream the html as a string
   *
   * @returns {ReadableStream<string>}
   */
  textStream() {
    const strings = this.#strings;
    const expressions = this.#exps;

    return new ReadableStream({
      start(controller) {
        controller.enqueue(strings[0]);

        (async () => {
          for (
            let expressionIndex = 0, expressionCount = expressions.length;
            expressionIndex < expressionCount;
            ++expressionIndex
          ) {
            await TmphHTML.#enqueueExpressionValue(
              controller,
              expressions[expressionIndex]
            );

            // Yield the next static string content following the nested TmphHTML expression
            controller.enqueue(strings[expressionIndex + 1]);
          }

          controller.close();
        })();
      },
    });
  }

  /**
   * Waits for all async expressions to resolve and returns the final
   * html all at once as a string.
   *
   * @returns {Promise<string>}
   */
  async text() {
    let accumulatedText = "";

    const textStream = this.textStream();
    const reader = textStream.getReader();

    try {
      for (
        let readResult = await reader.read();
        !readResult.done;
        readResult = await reader.read()
      ) {
        accumulatedText += readResult.value;
      }
    } finally {
      reader.releaseLock();
    }

    return accumulatedText;
  }

  /**
   * Gets a ReadableStream<Uint8Array> which can be used to stream the html as a buffer
   *
   * @returns {ReadableStream<Uint8Array>}
   */
  arrayBufferStream() {
    return this.textStream().pipeThrough(new TextEncoderStream());
  }

  /**
   * Waits for all async expressions to resolve and returns the final
   * html all at once as a Uint8Array.
   *
   * @returns {Promise<Uint8Array>}
   */
  async arrayBuffer() {
    const text = await this.text();
    return new TextEncoder().encode(text);
  }

  /**
   * Gets a Response object with the stream as the body which can be directly sent
   * as a server response.
   *
   * @param {ResponseInit} [init]
   */
  response(init) {
    return new Response(this.arrayBufferStream(), {
      status: 200,
      ...init,
      headers: {
        "Content-Type": "text/html",
        "Transfer-Encoding": "chunked",
        ...init?.headers,
      },
    });
  }
}

/**
 * Template string function takes html and uses an async generator to
 * stream the html as any dynamic async content is rendered.
 *
 * @param {TemplateStringsArray} strings
 * @param  {...any} exps
 *
 * @example
 * const htmlGenerator = html`
 *  <div>
 *    ${new Promise((resolve)=>{
 *     	setTimeout(()=>resolve("Async content"), 1000);
 *    })}
 *  </div>
 * `;
 *
 * for await (const html of htmlGenerator) {
 *  console.log(html);
 * }
 *
 * // 0s: <div>
 * // 1s: Async content</div>
 */
export const html = (strings, ...exps) => new TmphHTML(strings, ...exps);
