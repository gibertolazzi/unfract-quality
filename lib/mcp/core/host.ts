import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

export interface McpServerConfig {
  id: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export class UnfractMcpHost {
  private clients: Map<string, Client> = new Map();

  /**
   * Connects to a local or external MCP server via stdio.
   */
  public async connectToServer(config: McpServerConfig): Promise<Client> {
    console.log(`[MCP Host] Connecting to server ${config.id}...`);

      const processEnv = Object.keys(process.env).reduce<Record<string, string>>((env, key) => {
        const value = process.env[key];
        if (value !== undefined) env[key] = value;
        return env;
      }, {});
    
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
        env: { ...processEnv, ...config.env }
    });

    const client = new Client({
      name: "unfract-ai-hub",
      version: "1.0.0",
    }, {
      capabilities: {}
    });

    await client.connect(transport);
    this.clients.set(config.id, client);
    
    console.log(`[MCP Host] Connected to ${config.id} successfully.`);
    return client;
  }

  /**
   * Retrieves all available tools from a connected server.
   */
  public async getServerTools(serverId: string) {
    const client = this.clients.get(serverId);
    if (!client) throw new Error(`Server ${serverId} not connected.`);
    
    const response = await client.listTools();
    return response.tools;
  }

  /**
   * Executes a tool on a connected server.
   */
  public async callServerTool(serverId: string, toolName: string, args: any) {
    const client = this.clients.get(serverId);
    if (!client) throw new Error(`Server ${serverId} not connected.`);
    
    console.log(`[MCP Host] Calling tool ${toolName} on server ${serverId}`);
    const response = await client.callTool({
      name: toolName,
      arguments: args,
    });
    
    return response;
  }
}

export const mcpHost = new UnfractMcpHost();
