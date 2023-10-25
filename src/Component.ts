import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename } from "node:path";

export default class Component {
  static whiteSpaceRegex = /\s/;
  static lineBreakRegex = /[\r\n]/;

  componentName: string;
  hash: string | null = null;

  constructor(public filePath: string) {
    const fileName = basename(filePath);
    this.componentName = `${fileName[0].toUpperCase()}${fileName.split(".")[0]}`;
  }

  async parse() {
    const cacheDir = `../.tmph/${this.componentName}`;

    try {
      await stat(cacheDir);
    } catch {
      // Cache directory doesn't exist, so create it
      await mkdir(cacheDir, { recursive: true });
    }

    const rawFileContents = await readFile(this.filePath, 'utf-8');

    this.hash = createHash('sha256').update(rawFileContents).digest('hex');

    const cachedFilePath = `${cacheDir}/${this.hash.slice(0, 12)}.js`;

    // If the cached file path already exists, then we can just use that
    try {
      await stat(cachedFilePath);
      return cachedFilePath;
    } catch {
      // File doesn't exist, so we need to create it
    }

    let renderFileContents = "export default function render(props) {\n";

    let cursorStatus: {
      lineNumber: number;
      position: number;
      status: "outside" | "openingTagStart" | "tagName" | "betweenTagAttributes" | "tagAttributeName" | "tagAttributeValue" | "insideTag" | "closingTag" | "selfClosingTag";
      tagName: string;
      attributeName: string;
      attributeValue: string;
    } = {
      lineNumber: 1,
      position: 0,
      status: "outside",
      tagName: "",
      attributeName: "",
      attributeValue: "",
    };

    for (let i = 0; i < rawFileContents.length; ++i) {
      const char = rawFileContents[i];

      let isLineBreak = Component.lineBreakRegex.test(char);

      if (isLineBreak) {
        cursorStatus.lineNumber++;
        cursorStatus.position = 0;

        if (cursorStatus.status === "tagAttributeValue") {
          cursorStatus.attributeValue += "\n";
        }
        continue;
      } else {
        cursorStatus.position++;
      }

      switch (cursorStatus.status) {
        case "outside": {
          if (char === "<") {
            cursorStatus.status = "openingTagStart";
            cursorStatus.tagName = "";
          }
          break;
        }
        case "openingTagStart": {
          if (!Component.whiteSpaceRegex.test(char)) {
            if (char === "/") {
              cursorStatus.status = "selfClosingTag";
            } else if (char === ">") {
              console.error(`Error: Unexpected closing tag character '>' at line ${cursorStatus.lineNumber}, position ${cursorStatus.position}`);
              cursorStatus.status = "insideTag";
            } else {
              cursorStatus.status = "tagName";
              cursorStatus.tagName += char;
            }
          }
          break;
        }
        case "tagName": {
          if (Component.whiteSpaceRegex.test(char)) {
            cursorStatus.status = "betweenTagAttributes";
          } else if (char === "/") {
            cursorStatus.status = "selfClosingTag";
          } else if (char === ">") {
            cursorStatus.status = "insideTag";
          } else {
            cursorStatus.tagName += char;
          }
          break;
        }
        case "selfClosingTag": {
          if (char === ">") {
            cursorStatus.status = "outside";
          }
          break;
        }
      }

    }

    renderFileContents += "}";

    writeFile(cachedFilePath, renderFileContents);
    return cachedFilePath;
  }

}