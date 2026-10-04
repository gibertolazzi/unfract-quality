import { AskPerplexityInput, AskClaudeInput, AskOpenAIInput } from "./schemas";
import { Context } from "../../core/types";

/**
 * Mocks a call to the Perplexity API.
 * In production, this uses the Perplexity sonar models to search the live web.
 */
export async function handleAskPerplexity(
  input: AskPerplexityInput,
  context: Context
): Promise<{ text: string; sources?: string[] }> {
  console.log(`[Perplexity Handler] Executed by user: ${context.userId}, tenant: ${context.tenantId}`);
  
  // TODO: Implement actual fetch to https://api.perplexity.ai/chat/completions
  
  return {
    text: `Mocked Perplexity response for query: "${input.query}" focusing on ${input.focus}.`,
    sources: ["https://example.com/source1", "https://example.com/source2"]
  };
}

/**
 * Mocks a call to the Anthropic (Claude) API.
 */
export async function handleAskClaude(
  input: AskClaudeInput,
  context: Context
): Promise<{ text: string }> {
  console.log(`[Claude Handler] Executed by user: ${context.userId}, tenant: ${context.tenantId}`);
  
  // TODO: Implement actual fetch to Anthropic Messages API
  
  return {
    text: `Mocked Claude response for prompt: "${input.prompt}". Max tokens: ${input.maxTokens}, Temp: ${input.temperature}.`
  };
}

/**
 * Mocks a call to the OpenAI API.
 */
export async function handleAskOpenAI(
  input: AskOpenAIInput,
  context: Context
): Promise<{ text: string }> {
  console.log(`[OpenAI Handler] Executed by user: ${context.userId}, tenant: ${context.tenantId}`);
  
  // TODO: Implement actual fetch to OpenAI Chat Completions API
  
  const lastMessage = input.messages[input.messages.length - 1]?.content || "Empty";
  
  return {
    text: `Mocked OpenAI (${input.model}) response to last message: "${lastMessage}".`
  };
}
