import { readFile } from "node:fs/promises";
import path from "node:path";

export class TemplateLoader {
  private static templatePromise: Promise<string> | undefined;

  static loadTemplate(): Promise<string> {
    this.templatePromise ??= readFile(
      path.resolve(__dirname, "../prompts/find-element.txt"),
      "utf-8",
    ).catch((error) => {
      this.templatePromise = undefined;
      throw error;
    });
    return this.templatePromise;
  }
}
