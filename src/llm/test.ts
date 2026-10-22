import { LlM } from "./LLM";
import { OpenAILLM } from "./OpenAILLM";


async function main(): Promise<void> {
  const llm: LlM = new OpenAILLM();

  const reponse = await llm.generer(
    "Which number is larger, 9.11 or 9.8?"
  );

  console.log(reponse);
}

main().catch(console.error);