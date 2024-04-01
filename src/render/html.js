export class TmphHTML {
  /** @type {ReadableStream<string> | null} */
  #stream;

  /**
   * Whether the html stream has been used. A TmphHTML stream can only be used once,
   * and will throw an error after that.
   *
   * @example
   * const myHTML = html`<div>Content</div>`;
   * myHTML.used; // false
   * const text = await myHTML.text();
   * myHTML.used; // true
   * const text2 = await myHTML.text(); // Error: Tempeh Error: html stream already used.
   */
  get used() {
    return this.#stream === null;
  }

  /**
   * @param {TemplateStringsArray} _strings
   * @param  {...unknown} _expressions
   */
  constructor(_strings, ..._expressions) {
    /** @type {TemplateStringsArray | null} */
    let strings = _strings;
    /** @type {unknown[] | null} */
    let expressions = _expressions;

    let stringIndex = 0;
    const stringCount = strings.length;
    const expressionCount = expressions.length;

    this.#stream = new ReadableStream({
      async pull(controller) {
        if (strings) {
          controller.enqueue(strings[stringIndex]);

          if (expressions && stringIndex < expressionCount) {
            try {
              await TmphHTML.#enqueueExpressionValue(
                controller,
                expressions[stringIndex]
              );
            } catch (error) {
              console.error(
                "An error occurred while rendering Tempeh HTML:",
                error
              );
            }
          } else {
            // If we've enqueued the last expression, clear the reference to the expressions array
            expressions = null;
          }
        }

        if (++stringIndex >= stringCount) {
          // If we've enqueued the last string, clear the reference to the strings array
          // and close the controller; the stream is done!
          strings = null;
          controller.close();
        }
      },
    });
  }

  /**
   * Takes a readable stream controller and an expression value and enqueues
   * the value as a string or async generator function.
   * @param {ReadableStreamDefaultController<string>} controller
   * @param {any} expressionValue
   */
  static #enqueueExpressionValue = async (controller, expressionValue) => {
    // Skip undefined, null, false, and empty string values (but not 0!)
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

    if (expressionValue instanceof TmphHTML) {
      // Read the html text stream and forward chunks to the controller
      const reader = expressionValue.textStream().getReader();
      try {
        /** @type {Awaited<ReturnType<typeof reader.read>>} */
        let readResult;
        while (!(readResult = await reader.read()).done) {
          controller.enqueue(readResult.value);
        }
      } finally {
        reader.releaseLock();
      }
      return;
    }

    if (typeof expressionValue === "function") {
      // Unwrap generator functions
      switch (expressionValue.constructor.name) {
        case "GeneratorFunction": {
          for (const chunk of expressionValue()) {
            await TmphHTML.#enqueueExpressionValue(controller, chunk);
          }
          return;
        }
        case "AsyncGeneratorFunction": {
          for await (const chunk of expressionValue()) {
            await TmphHTML.#enqueueExpressionValue(controller, chunk);
          }
          return;
        }
      }
    }

    // If the expression value wasn't a special type which needed to be unwrapped,
    // just cast it as a string and enqueue it.
    controller.enqueue(String(expressionValue));
  };

  /**
   * Gets a ReadableStream<string> which can be used to stream the html as a string
   *
   * @returns {ReadableStream<string>}
   */
  textStream() {
    const stream = this.#stream;

    if (!stream) {
      throw new Error("Tempeh Error: html stream already used.");
    }

    // Streams can only be consumed once, so clear our reference to the stream
    this.#stream = null;

    return stream;
  }

  /**
   * Async generator which yields each chunk of the html text stream as it is rendered.
   */
  async *[Symbol.asyncIterator]() {
    const textStream = this.textStream();
    const reader = textStream.getReader();

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
      /** @type {Awaited<ReturnType<typeof reader.read>>} */
      let readResult;
      while (!(readResult = await reader.read()).done) {
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
    return new TextEncoder().encode(await this.text());
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
