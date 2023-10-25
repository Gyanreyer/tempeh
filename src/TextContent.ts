export default class TextContent {
  content: string;

  constructor(content: string) {
    this.content = content.trim();
  }

  render() {
    return this.content;
  }
}