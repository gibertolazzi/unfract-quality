import { mcpHost } from "../lib/mcp/core/host";

async function run() {
  console.log("--- Starting MCP Host Test ---");
  
  // We launch our own server as a subprocess using tsx
  const serverConfig = {
    id: "unfract-internal",
    command: "npx",
    args: ["tsx", "scripts/run-mcp-server.ts"]
  };

  try {
    await mcpHost.connectToServer(serverConfig);
    
    console.log("\n--- Listing Tools ---");
    const tools = await mcpHost.getServerTools("unfract-internal");
    tools.forEach(t => console.log(`- ${t.name}: ${t.description}`));

    console.log("\n--- Executing a Tool via MCP ---");
    const result = await mcpHost.callServerTool("unfract-internal", "search_tasks", {
      status: "todo"
    });
    
    console.log("Result:", JSON.stringify(result, null, 2));

    console.log("\n--- Execution Complete ---");
    process.exit(0);
  } catch (err: any) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

run();
