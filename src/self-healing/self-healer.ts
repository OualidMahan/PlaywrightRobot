import type { LLM } from "../llm/llm";
import { TemplateLoader } from "./template-loader";
import { ConsoleLogger } from "../logging/logger";
import type { Logger } from "../logging/logger";

export class SelfHealer {
  private readonly llm: LLM;
  private readonly dom: string;
  private readonly logger: Logger;

  constructor(llm: LLM, dom: string, logger: Logger = new ConsoleLogger("info", "SelfHealer")) {
    this.llm = llm;
    this.dom = dom;
    this.logger = logger;
  }

  async getXpath(elementDescription: string): Promise<string> {
    if (!elementDescription.trim()) {
      this.logger.warn("XPath generation rejected: empty element description.");
      throw new Error("The element description is empty.");
    }
    this.logger.debug("Loading the XPath prompt template.");
    const template = await TemplateLoader.loadTemplate().catch((error: unknown) => {
      this.logger.error("Failed to load the XPath prompt template.");
      throw error;
    });

    const prompt = template
      .replace(/\{\{(ELEMENT_DESCRIPTION|DOM)\}\}/g, (_, variable: string) =>
        variable === "DOM" ? this.dom : elementDescription,
      );

    this.logger.debug("Requesting XPath generation from the LLM.");
    const response = await this.llm.generate(prompt).catch((error: unknown) => {
      this.logger.error("The LLM request failed.");
      throw error;
    });
    const xpath = response.trim();
    if (xpath === "NOT_FOUND") {
      this.logger.warn("XPath generation failed: no matching element.");
      throw new Error(`No element found for: ${elementDescription}`);
    }
    if (xpath === "AMBIGUOUS") {
      this.logger.warn("XPath generation failed: ambiguous element.");
      throw new Error(`Multiple possible elements for: ${elementDescription}`);
    }
    if (!xpath || /[\r\n]/.test(xpath) || xpath.includes("```")) {
      this.logger.warn("XPath generation failed: invalid response format.");
      throw new Error("The LLM did not return a single-line XPath.");
    }

    this.logger.info("XPath generation completed.");
    return xpath;
  }
}
