export interface LLM{
    generer(prompt: string): Promise<string>;
}