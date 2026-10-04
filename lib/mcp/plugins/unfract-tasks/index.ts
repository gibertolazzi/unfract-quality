import { McpPlugin } from "../../core/types";
import { CreateTaskSchema, SearchTasksSchema, UpdateTaskSchema } from "./schemas";
import { handleCreateTask, handleSearchTasks, handleUpdateTask } from "./handlers";

export const UnfractTasksPlugin: McpPlugin = {
  name: "unfract-tasks",
  tools: [
    {
      name: "create_task",
      description: "Create a new task or action item in Unfract Tasks.",
      schema: CreateTaskSchema,
      handler: handleCreateTask,
    },
    {
      name: "search_tasks",
      description: "Search for existing tasks within the user's Unfract workspace.",
      schema: SearchTasksSchema,
      handler: handleSearchTasks,
    },
    {
      name: "update_task",
      description: "Update an existing task (e.g., change its status).",
      schema: UpdateTaskSchema,
      handler: handleUpdateTask,
    }
  ]
};

export default UnfractTasksPlugin;
