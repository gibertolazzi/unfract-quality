import { z } from "zod";

export const CreateTaskSchema = z.object({
  title: z.string().min(1).describe("The title or primary objective of the task."),
  description: z.string().optional().describe("Detailed description of the task."),
  status: z.enum(["todo", "in_progress", "done"]).optional().default("todo").describe("Current status of the task."),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium").describe("Priority level."),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const SearchTasksSchema = z.object({
  query: z.string().optional().describe("Search term to match against task titles and descriptions."),
  status: z.enum(["todo", "in_progress", "done"]).optional().describe("Filter tasks by their status."),
  limit: z.number().min(1).max(50).optional().default(10).describe("Maximum number of tasks to return."),
});
export type SearchTasksInput = z.infer<typeof SearchTasksSchema>;

export const UpdateTaskSchema = z.object({
  taskId: z.string().describe("The unique ID of the task to update."),
  status: z.enum(["todo", "in_progress", "done"]).optional().describe("New status for the task."),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
