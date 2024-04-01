/**
 * @param {string | URL} url
 */
export async function fetchStreamedHTMLResponse(url) {
  const response = await fetch(url);

  const bodyReadStream = response.body;
  if (!bodyReadStream) {
    return;
  }

  const reader = bodyReadStream
    .pipeThrough(new TextDecoderStream())
    .getReader();
  try {
    const streamDocument = document.implementation.createHTMLDocument();

    /**
     * @type {Node | null}
     */
    let currentOpenStreamingNode = null;

    /**
     * @type {Node | null}
     */
    let lastImportedNode = null;

    /**
     * @type {(node: Element) => void}
     */
    const applySwapOperation = (node) => {
      const targetElementSelector = node.getAttribute("$str:target");
      const swapBehavior = node.getAttribute("$str:swap");

      const streamTargetElement = targetElementSelector
        ? streamDocument.querySelector(targetElementSelector) ?? document.body
        : document.body;

      switch (swapBehavior) {
        case "append": {
          const newImportedNode = streamTargetElement.ownerDocument.importNode(
            node,
            true
          );
          streamTargetElement.appendChild(newImportedNode);

          lastImportedNode = newImportedNode;
          break;
        }
        case "replaceChildren":
          const newImportedNode = streamTargetElement.ownerDocument.importNode(
            node,
            true
          );
          if (!lastImportedNode && streamTargetElement.hasChildNodes()) {
            streamTargetElement.replaceChildren(newImportedNode);
          } else {
            streamTargetElement.appendChild(newImportedNode);
          }

          lastImportedNode = newImportedNode;
          break;
        case "replace":
        default: {
          const newImportedNode = streamTargetElement.ownerDocument.importNode(
            node,
            true
          );

          if (!lastImportedNode) {
            streamTargetElement.replaceWith(newImportedNode);
          } else if (!lastImportedNode.parentNode) {
            console.error(
              "Failed to swap streamed node, parent node is null",
              lastImportedNode
            );
          } else if (lastImportedNode.nextSibling) {
            lastImportedNode.parentNode.insertBefore(
              newImportedNode,
              lastImportedNode.nextSibling
            );
          } else {
            lastImportedNode.parentNode.appendChild(newImportedNode);
          }

          lastImportedNode = newImportedNode;
          break;
        }
      }
    };

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length === 0) {
          continue;
        }

        for (const node of mutation.addedNodes) {
          if (
            currentOpenStreamingNode &&
            currentOpenStreamingNode instanceof Element
          ) {
            applySwapOperation(currentOpenStreamingNode);
          }
          currentOpenStreamingNode = node;
        }
      }
    });
    mutationObserver.observe(document.body, {
      childList: true,
    });

    /** @type {Awaited<ReturnType<typeof reader.read>>} */
    let readResult;
    while (!(readResult = await reader.read()).done) {
      streamDocument.write(readResult.value);
    }
    mutationObserver.disconnect();

    if (
      currentOpenStreamingNode &&
      /** @type {Node | null} */ (currentOpenStreamingNode) instanceof Element
    ) {
      applySwapOperation(currentOpenStreamingNode);
    }
  } finally {
    reader.releaseLock();
  }
}
