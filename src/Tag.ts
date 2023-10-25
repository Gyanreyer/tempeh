import TextContent from "./TextContent";

export default class Tag {
  attributes: {
    [key: string]: string;
  } = {};
  children: Array<Tag | TextContent> = [];

  constructor(public tagName: string) { }

  render(): string {
    let attributesString = "";
    for (const key in this.attributes) {
      attributesString += ` ${key}="${this.attributes[key]}" `;
    }

    let childrenString = "";
    for (const child of this.children) {
      childrenString += child.render();
    }

    return `<${this.tagName}${attributesString}>${childrenString}</${this.tagName}>`;
  }
}