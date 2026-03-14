import { z } from "zod";
import { STATUS_OPTIONS } from "./config.js";

export const NodeStatus = z.enum(STATUS_OPTIONS);
export type NodeStatus = z.infer<typeof NodeStatus>;

export const ActionStatus = z.enum(["pending", "running", "done", "failed"]);
export type ActionStatus = z.infer<typeof ActionStatus>;

export const ActionConfig = z.object({
  prompt: z.string().optional(),
  command: z.string().optional(),
  cwd: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
});
export type ActionConfig = z.infer<typeof ActionConfig>;

export const Action = z.object({
  id: z.string(),
  type: z.enum(["claude-code", "gh-cli", "shell", "repo-template"]),
  label: z.string(),
  config: ActionConfig,
  status: ActionStatus,
  result: z.string().nullable(),
});
export type Action = z.infer<typeof Action>;

export const Node = z.object({
  id: z.string(),
  description: z.string(),
  status: NodeStatus,
  depends_on: z.array(z.string()),
  notes: z.string().optional(),
  actions: z.array(Action).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Node = z.infer<typeof Node>;

export const Graph = z.object({
  version: z.string(),
  goal: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  nodes: z.record(z.string(), Node),
  root: z.string(),
});
export type Graph = z.infer<typeof Graph>;
