import { test, describe } from "node:test";
import * as assert from "node:assert";

import { html } from "./html.js";

/**
 * @param {number} ms
 */
const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("html", () => {
  test("html can be used as an async generator", async () => {
    const htmlGenerator = html`<p>
        ${(async () => {
          await waitFor(10);
          return "Async content?!";
        })()}
      </p>
      <p>
        ${(async () => {
          await waitFor(20);
          return "More async content";
        })()}
      </p>`;

    const chunks = [];

    for await (const chunk of htmlGenerator) {
      chunks.push(chunk);
    }

    assert.deepStrictEqual(chunks, [
      `<p>
        `,
      `Async content?!`,
      `
      </p>
      <p>
        `,
      `More async content`,
      `
      </p>`,
    ]);
  });

  test("html.textStream() creates a readable string stream", async () => {
    const htmlGenerator = html`<p>
        ${(async () => {
          await waitFor(10);
          return "Async content again?!";
        })()}
      </p>
      <p>
        ${(async () => {
          await waitFor(20);
          return "Even more async content.";
        })()}
      </p>`;

    const reader = htmlGenerator.textStream().getReader();
    /** @type {string[]} */
    let chunks = [];

    try {
      for (
        let readResult = await reader.read();
        !readResult.done;
        readResult = await reader.read()
      ) {
        chunks.push(readResult.value);
      }
    } finally {
      reader.releaseLock();
    }

    assert.deepStrictEqual(chunks, [
      `<p>
        `,
      `Async content again?!`,
      `
      </p>
      <p>
        `,
      `Even more async content.`,
      `
      </p>`,
    ]);
  });

  test("html.arrayBufferStream() creates a readable Uint8Array stream", async () => {
    const htmlGenerator = html`<p>
        ${(async () => {
          await waitFor(10);
          return "Async content again?!";
        })()}
      </p>
      <p>
        ${(async () => {
          await waitFor(20);
          return "Even more async content.";
        })()}
      </p>`;

    const reader = htmlGenerator.arrayBufferStream().getReader();
    /** @type {string[]} */
    let chunks = [];

    const textDecoder = new TextDecoder();

    try {
      for (
        let readResult = await reader.read();
        !readResult.done;
        readResult = await reader.read()
      ) {
        chunks.push(textDecoder.decode(readResult.value));
      }
    } finally {
      reader.releaseLock();
    }

    assert.deepStrictEqual(chunks, [
      `<p>
        `,
      `Async content again?!`,
      `
      </p>
      <p>
        `,
      `Even more async content.`,
      `
      </p>`,
    ]);
  });

  test("html.response() creates a Response from the html stream", async () => {
    const htmlGenerator = html`<p>
        ${(async () => {
          await waitFor(10);
          return "Async content again?!";
        })()}
      </p>
      <p>
        ${(async () => {
          await waitFor(20);
          return "Even more async content.";
        })()}
      </p>`;

    const response = await htmlGenerator.response();

    assert.strictEqual(response.headers.get("content-type"), "text/html");
    assert.strictEqual(
      await response.text(),
      `<p>
        Async content again?!
      </p>
      <p>
        Even more async content.
      </p>`
    );
  });

  test("html.text() returns the full final html string", async () => {
    const htmlGenerator = html`<p>
        ${(async () => {
          await waitFor(10);
          return "Async content...";
        })()}
      </p>
      <p>
        ${(async () => {
          await waitFor(20);
          return "Some more";
        })()}
      </p>`;

    assert.strictEqual(
      await htmlGenerator.text(),
      `<p>
        Async content...
      </p>
      <p>
        Some more
      </p>`
    );
  });

  test("nested html generators work as expected", async () => {
    const htmlGenerator = html`<p>
        ${(async () => {
          await waitFor(10);
          return "Async content...";
        })()}
      </p>
      <ul>
        ${(async () => html`
          <li>
            ${(async () => {
              await waitFor(20);
              return "Some more";
            })()}
          </li>
          <li>
            ${(async () => {
              return "And more";
            })()}
          </li>
        `)()}
      </ul>`;

    const chunks = [];

    const reader = htmlGenerator.textStream().getReader();

    for (
      let readResult = await reader.read();
      !readResult.done;
      readResult = await reader.read()
    ) {
      chunks.push(readResult.value);
    }

    assert.deepStrictEqual(chunks, [
      `<p>
        `,
      `Async content...`,
      `
      </p>
      <ul>
        `,
      `
          <li>
            `,
      `Some more`,
      `
          </li>
          <li>
            `,
      `And more`,
      `
          </li>
        `,
      `
      </ul>`,
    ]);
  });

  test("nested generators work as expected", async () => {
    const htmlGenerator = html`<ul>
        ${async function* () {
          // Async generators work
          for (let i = 0; i < 3; i++) {
            yield html`<li>Item ${i}</li>`;
          }
        }}
      </ul>
      <ul>
        ${
          // Array contents will be unwrapped because they have sync generators
          [html`<li>Item 0</li>`, html`<li>Item 1</li>`, html`<li>Item 2</li>`]
        }
      </ul>`;

    const chunks = [];
    for await (const chunk of htmlGenerator) {
      chunks.push(chunk);
    }

    assert.deepStrictEqual(chunks, [
      `<ul>
        `,
      `<li>Item `,
      `0`,
      `</li>`,
      `<li>Item `,
      `1`,
      `</li>`,
      `<li>Item `,
      `2`,
      `</li>`,
      `
      </ul>
      <ul>
        `,
      `<li>Item 0</li>`,
      `<li>Item 1</li>`,
      `<li>Item 2</li>`,
      `
      </ul>`,
    ]);
  });
});
