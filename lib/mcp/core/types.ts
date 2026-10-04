import { z } from "zod";

// Let's redefine ExecutionContext here for the core module
export interface Context {
  userId: string;
  tenantId: string;
  permissions: string[];
}

export interface McpToolDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: T;
  handler: (input: any, context: Context) => Promise<any>;
}

export interface McpPlugin {
  name: string;
  tools: McpToolDefinition[];
  // Future expansions: resources, prompts, etc.
}
