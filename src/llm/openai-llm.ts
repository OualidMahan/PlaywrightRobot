import OpenAI from "openai";
import type { LLM } from "./llm";

const defaultBaseURL = "https://integrate.api.nvidia.com/v1";
const defaultModel = "openai/gpt-oss-20b";

export interface OpenAILLMOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

function nonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

export class OpenAILLM implements LLM {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options?: OpenAILLMOptions | string) {
    if (options !== undefined && typeof options !== "string" &&
        (options === null || typeof options !== "object" || Array.isArray(options))) {
      throw new Error("OpenAILLM options must be an object or a model string.");
    }
    const settings = typeof options === "string" ? { model: options } : options ?? {};
    this.model = settings.model === undefined ? defaultModel : nonEmptyString(settings.model, "model");
    const baseURL = settings.baseURL === undefined
      ? defaultBaseURL : nonEmptyString(settings.baseURL, "baseURL");
    let url: URL;
    try {
      url = new URL(baseURL);
    } catch {
      throw new Error("baseURL must be an absolute HTTP or HTTPS URL.");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error("baseURL must use HTTP or HTTPS without credentials, query parameters, or a fragment.");
    }
    const isDefaultEndpoint = url.href.replace(/\/+$/, "") === defaultBaseURL;
    if (!isDefaultEndpoint && settings.apiKey === undefined) {
      throw new Error("An explicit apiKey is required for a custom baseURL.");
    }
    const key = settings.apiKey === undefined ? process.env.NVIDIA_API_KEY : settings.apiKey;

    if (key === undefined) {
      throw new Error("Provide apiKey or set the NVIDIA_API_KEY environment variable.");
    }
    const apiKey = nonEmptyString(key, "apiKey");

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  async generate(prompt: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 1,
      top_p: 1,
      max_tokens: 4096,
      stream: true,
    });

    let response = "";

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content;

      if (content) {
        response += content;
      }
    }

    return response;
  }
}
