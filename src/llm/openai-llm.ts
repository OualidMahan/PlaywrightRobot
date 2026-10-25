import OpenAI from "openai";
import type { LLM } from "./llm";


export class OpenAILLM implements LLM {
  private readonly client: OpenAI;

  constructor(private readonly model: string = "openai/gpt-oss-20b") {
    const apiKey =
      process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      throw new Error("The NVIDIA_API_KEY environment variable is missing.");
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: "https://integrate.api.nvidia.com/v1",
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
