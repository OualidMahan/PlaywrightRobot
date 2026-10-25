export interface LLM{
    generate(prompt: string): Promise<string>;
}