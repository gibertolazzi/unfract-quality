import { CreateTaskInput, SearchTasksInput, UpdateTaskInput } from "./schemas";
import { Context } from "../../core/types";

// Mocking an internal database layer
const MOCK_DB: Record<string, any[]> = {
  // Keyed by tenantId for strict isolation
  "tenant_abc": [
    { id: "task_1", title: "Review Q3 Marketing Deck", status: "todo", priority: "high" },
    { id: "task_2", title: "Setup MCP Server", status: "in_progress", priority: "medium" }
  ]
};

export async function handleCreateTask(input: CreateTaskInput, context: Context) {
  console.log(`[Tasks] create_task requested by ${context.userId} for tenant ${context.tenantId}`);
  
  if (!MOCK_DB[context.tenantId]) {
    MOCK_DB[context.tenantId] = [];
  }
  
  const newTask = {
    id: `task_${Date.now()}`,
    ...input,
    createdAt: new Date().toISOString()
  };
  
  MOCK_DB[context.tenantId].push(newTask);
  return { success: true, task: newTask };
}

export async function handleSearchTasks(input: SearchTasksInput, context: Context) {
  console.log(`[Tasks] search_tasks requested by ${context.userId} for tenant ${context.tenantId}`);
  
  const tenantTasks = MOCK_DB[context.tenantId] || [];
  
  let results = tenantTasks;
  
  if (input.status) {
    results = results.filter(t => t.status === input.status);
  }
  
  if (input.query) {
    const q = input.query.toLowerCase();
    results = results.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
  }
  
  return { tasks: results.slice(0, input.limit) };
}

export async function handleUpdateTask(input: UpdateTaskInput, context: Context) {
  console.log(`[Tasks] update_task requested by ${context.userId} for tenant ${context.tenantId}`);
  
  const tenantTasks = MOCK_DB[context.tenantId] || [];
  const taskIndex = tenantTasks.findIndex(t => t.id === input.taskId);
  
  if (taskIndex === -1) {
    throw new Error(`Task ${input.taskId} not found or you do not have permission.`);
  }
  
  if (input.status) {
    tenantTasks[taskIndex].status = input.status;
  }
  
  return { success: true, task: tenantTasks[taskIndex] };
}
