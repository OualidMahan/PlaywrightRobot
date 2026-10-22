// providers/OpenAILLM.ts

import OpenAI from "openai";
import { LLM } from "./LLM";


export class OpenAILLM implements LLM {
  private readonly client: OpenAI;

  constructor(private readonly modele: string = "openai/gpt-oss-20b") {
    const apiKey =
      "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";

    if (!apiKey) {
      throw new Error("La variable NVIDIA_API_KEY est manquante.");
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: "https://integrate.api.nvidia.com/v1",
    });
  }

  async generer(prompt: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.modele,
      messages: [{ role: "user", content: prompt }],
      temperature: 1,
      top_p: 1,
      max_tokens: 4096,
      stream: true,
    });

    let reponse = "";

    for await (const chunk of completion) {
      const contenu = chunk.choices[0]?.delta?.content;

      if (contenu) {
        reponse += contenu;
      }
    }

    return reponse;
  }
}
