import { z } from "zod";
import { STATUS_OPTIONS } from "./config.js";

export const NodeStatus = z.enum(STATUS_OPTIONS);
export type NodeStatus = z.infer<typeof NodeStatus>;

export const Node = z.object({
  id: z.string(),
  description: z.string(),
  status: NodeStatus,
  depends_on: z.array(z.string()),
  notes: z.string().optional(),
  actions: z.array(z.any()).optional(),
  issue_number: z.number().nullable().optional(),
  assignee: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Node = z.infer<typeof Node>;

export const Phase = z.enum(["design", "development"]);
export type Phase = z.infer<typeof Phase>;

export const GithubConfig = z.object({
  owner: z.string(),
  repo: z.string(),
});
export type GithubConfig = z.infer<typeof GithubConfig>;

export const Graph = z.object({
  version: z.string(),
  goal: z.string(),
  phase: Phase.default("design"),
  github: GithubConfig.optional(),
  created_at: z.string(),
  updated_at: z.string(),
  nodes: z.record(z.string(), Node),
  root: z.string(),
});
export type Graph = z.infer<typeof Graph>;
