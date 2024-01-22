export class TmphHTML {
  /**
   * @param {TemplateStringsArray} strings
   * @param  {...any} exps
   */
  constructor(strings, ...exps) {
    /** @type {TemplateStringsArray} */
    this.strings = strings;
    /** @type {unknown[]} */
    this.exps = exps;
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
   * Gets a ReadableStream<string> which can be used to stream the html as a string
   *
   * @returns {ReadableStream<string>}
   */
  textStream() {
    const strings = this.strings;
    const expressions = this.exps;

    /**
     * @type {ReadableStream<string>}
     */
    return new ReadableStream({
      start(controller) {
        controller.enqueue(strings[0]);

        (async () => {
          for (
            let expressionIndex = 0, expressionCount = expressions.length;
            expressionIndex < expressionCount;
            ++expressionIndex
          ) {
            let expressionValue = expressions[expressionIndex];

            if (expressionValue instanceof Promise) {
              // If the expression is a promise, unwrap it
              try {
                expressionValue = await expressionValue;
              } catch (error) {
                expressionValue = "";
                console.error(
                  "An error occurred while rendering async HTML content:",
                  error
                );
              }
            }

            if (expressionValue instanceof TmphHTML) {
              const nestedStream = expressionValue.textStream();
              const nestedReader = nestedStream.getReader();

              try {
                for (
                  let readResult = await nestedReader.read();
                  !readResult.done;
                  readResult = await nestedReader.read()
                ) {
                  controller.enqueue(readResult.value);
                }
              } finally {
                nestedReader.releaseLock();
              }
            } else {
              controller.enqueue(String(expressionValue));
            }

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
