import { McpPlugin } from "../../core/types";
import { AskPerplexitySchema, AskClaudeSchema, AskOpenAISchema } from "./schemas";
import { handleAskPerplexity, handleAskClaude, handleAskOpenAI } from "./handlers";

export const AiModelsPlugin: McpPlugin = {
  name: "ai-models",
  tools: [
    {
      name: "ask_perplexity",
      description: "Search the live web or answer complex research questions using the Perplexity API.",
      schema: AskPerplexitySchema,
      handler: handleAskPerplexity,
    },
    {
      name: "ask_claude",
      description: "Process text, perform reasoning, or generate content using Anthropic's Claude.",
      schema: AskClaudeSchema,
      handler: handleAskClaude,
    },
    {
      name: "ask_openai",
      description: "Chat or generate content using OpenAI's models (e.g., GPT-4o).",
      schema: AskOpenAISchema,
      handler: handleAskOpenAI,
    }
  ]
};

export default AiModelsPlugin;
