import { mcpRegistry } from "./registry";
import { Context } from "./types";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * Creates an MCP Server that exposes Unfract's registry.
 */
export class UnfractMcpServer {
  private server: Server;
  
  constructor() {
    console.log("Initializing Unfract MCP Server...");
    
    this.server = new Server({
      name: "unfract-mcp-server",
      version: "1.0.0",
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      // In a real scenario, context is derived from the transport session (e.g. auth tokens in headers or init params)
      const mockContext: Context = { userId: "system", tenantId: "tenant_abc", permissions: [] };
      
      const tools = mcpRegistry.getAvailableTools(mockContext);
      
      // Naive mapper for PoC since zod-to-json-schema fails with instanceof bug here
      function mapZodToSchema(zodSchema: any): any {
        const def = zodSchema._def || zodSchema.def;
        if (!def) return { type: "string" };
        
        const typeName = def.typeName || def.type;

        if (typeName === "ZodObject" || typeName === "object") {
          const props: Record<string, any> = {};
          const shape = typeof def.shape === "function" ? def.shape() : def.shape;
          for (const [k, v] of Object.entries(shape || {})) {
            props[k] = mapZodToSchema(v);
          }
          return { type: "object", properties: props };
        }
        if (typeName === "ZodString" || typeName === "string") return { type: "string" };
        if (typeName === "ZodNumber" || typeName === "number") return { type: "number" };
        if (typeName === "ZodEnum" || typeName === "enum") return { type: "string", enum: def.values || Object.values(def.entries || {}) };
        if (typeName === "ZodOptional" || typeName === "optional" || typeName === "ZodDefault" || typeName === "default") {
          return mapZodToSchema(def.innerType);
        }
        if (typeName === "ZodArray" || typeName === "array") return { type: "array", items: mapZodToSchema(def.type) };
        return { type: "string" };
      }

      return {
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: mapZodToSchema(t.schema)
        }))
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const mockContext: Context = { userId: "system", tenantId: "tenant_abc", permissions: [] };
      
      try {
        const result = await mcpRegistry.executeTool(request.params.name, request.params.arguments, mockContext);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  public async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("Unfract MCP Server running on stdio");
  }
}

