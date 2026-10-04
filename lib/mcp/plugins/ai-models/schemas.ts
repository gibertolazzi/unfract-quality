import { z } from "zod";

// Perplexity Schema
export const AskPerplexitySchema = z.object({
  query: z.string().describe("The research question or topic to search the web for."),
  focus: z.enum(["web", "academic", "news", "reddit", "youtube"]).optional().default("web").describe("The domain focus for the search."),
});
export type AskPerplexityInput = z.infer<typeof AskPerplexitySchema>;

// Claude Schema
export const AskClaudeSchema = z.object({
  prompt: z.string().describe("The prompt or text for Claude to analyze or generate."),
  maxTokens: z.number().optional().default(1024).describe("Maximum number of tokens to generate."),
  temperature: z.number().min(0).max(1).optional().default(0.7).describe("Temperature for response creativity."),
});
export type AskClaudeInput = z.infer<typeof AskClaudeSchema>;

// OpenAI Schema
export const AskOpenAISchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string()
  })).describe("The conversation history to send to OpenAI."),
  model: z.enum(["gpt-4o", "gpt-4o-mini"]).optional().default("gpt-4o").describe("The OpenAI model to use."),
});
export type AskOpenAIInput = z.infer<typeof AskOpenAISchema>;
