import { mcpRegistry } from "../lib/mcp/core/registry";
import { Context } from "../lib/mcp/core/types";

async function run() {
  const contextA: Context = {
    userId: "user_A",
    tenantId: "tenant_abc",
    permissions: []
  };
  
  const contextB: Context = {
    userId: "user_B",
    tenantId: "tenant_xyz",
    permissions: []
  };

  console.log("--- Testing Tenant A Tasks ---");
  const resultA = await mcpRegistry.executeTool("search_tasks", {}, contextA);
  console.log("Tenant A Initial Tasks:", resultA.tasks);

  console.log("\n--- Tenant B Attempts to Read ---");
  const resultB = await mcpRegistry.executeTool("search_tasks", {}, contextB);
  console.log("Tenant B Initial Tasks:", resultB.tasks); // Should be empty!

  console.log("\n--- Tenant B Creates a Task ---");
  await mcpRegistry.executeTool("create_task", {
    title: "Hack the mainframe",
    priority: "high"
  }, contextB);
  
  const resultB_after = await mcpRegistry.executeTool("search_tasks", {}, contextB);
  console.log("Tenant B Tasks After Creation:", resultB_after.tasks);
  
  console.log("\n--- Tenant A verifies isolation ---");
  const resultA_after = await mcpRegistry.executeTool("search_tasks", {}, contextA);
  console.log("Tenant A Tasks (Should not see Tenant B's):", resultA_after.tasks.length);
}

run();
