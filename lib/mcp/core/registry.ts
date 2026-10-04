import { McpPlugin, McpToolDefinition, Context } from "./types";
import { AiModelsPlugin } from "../plugins/ai-models";
import { UnfractTasksPlugin } from "../plugins/unfract-tasks";

// In a real app, you might dynamically load these or filter based on tenant subscriptions
const PLUGINS: McpPlugin[] = [
  AiModelsPlugin,
  UnfractTasksPlugin,
];

export class McpRegistry {
  private plugins: Map<string, McpPlugin> = new Map();
  private tools: Map<string, McpToolDefinition> = new Map();

  constructor() {
    this.registerPlugins(PLUGINS);
  }

  private registerPlugins(plugins: McpPlugin[]) {
    for (const plugin of plugins) {
      this.plugins.set(plugin.name, plugin);
      for (const tool of plugin.tools) {
        if (this.tools.has(tool.name)) {
          console.warn(`[MCP Registry] Tool name collision detected: ${tool.name}`);
        }
        this.tools.set(tool.name, tool);
      }
    }
  }

  public getAvailableTools(context: Context): McpToolDefinition[] {
    // Here we can filter tools based on user permissions or tenant subscriptions
    return Array.from(this.tools.values());
  }

  public async executeTool(toolName: string, input: any, context: Context): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // 1. Validate the input against the Zod schema
    const parsedInput = tool.schema.parse(input);

    // 2. Execute the handler with isolated context
    return await tool.handler(parsedInput, context);
  }
}

// Export a singleton for easy usage
export const mcpRegistry = new McpRegistry();
