import { UnfractMcpServer } from "../lib/mcp/core/server";

async function main() {
  const server = new UnfractMcpServer();
  await server.start();
}

main().catch((error) => {
  console.error("Fatal error starting MCP Server:", error);
  process.exit(1);
});
