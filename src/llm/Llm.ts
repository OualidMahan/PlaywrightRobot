export interface LlM{
    generer(prompt: string): Promise<string>;
}