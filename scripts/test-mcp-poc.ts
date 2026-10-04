import { mcpRegistry } from "../lib/mcp/core/registry";
import { Context } from "../lib/mcp/core/types";

async function run() {
  const mockContext: Context = {
    userId: "user_123",
    tenantId: "tenant_abc",
    permissions: ["use_external_ai"]
  };

  console.log("--- Available Tools ---");
  const tools = mcpRegistry.getAvailableTools(mockContext);
  tools.forEach(t => console.log(`- ${t.name}: ${t.description}`));

  console.log("\n--- Testing Perplexity ---");
  try {
    const result = await mcpRegistry.executeTool("ask_perplexity", {
      query: "What is the capital of France?",
      focus: "academic"
    }, mockContext);
    console.log("Result:", result);
  } catch (err: any) {
    console.error("Failed:", err.message);
  }

  console.log("\n--- Testing Zod Validation Error ---");
  try {
    // missing required 'prompt'
    await mcpRegistry.executeTool("ask_claude", {
      maxTokens: 500
    }, mockContext);
  } catch (err: any) {
    console.error("Caught expected Zod error:", err.message);
  }
}

run();
