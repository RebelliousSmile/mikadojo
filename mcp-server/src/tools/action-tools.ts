import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ACTION_TEMPLATES_DIR } from "../config.js";
import { readGraph, writeGraph } from "../data/graph-store.js";
import { runClaude } from "../executors/claude-executor.js";
import { runGh } from "../executors/gh-executor.js";
import { runShell } from "../executors/shell-executor.js";
import type { Action } from "../schemas.js";

interface ActionTemplate {
  id: string;
  type: string;
  label: string;
  description?: string;
  config: Record<string, unknown>;
}

async function loadTemplatesFromDir(dir: string): Promise<ActionTemplate[]> {
  try {
    const files = await fs.readdir(dir);
    const templates: ActionTemplate[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      templates.push(JSON.parse(raw) as ActionTemplate);
    }
    return templates;
  } catch {
    return [];
  }
}

async function loadAllTemplates(repoPath?: string): Promise<ActionTemplate[]> {
  const centralized = await loadTemplatesFromDir(ACTION_TEMPLATES_DIR);
  const templateMap = new Map<string, ActionTemplate>();
  for (const t of centralized) templateMap.set(t.id, t);

  if (repoPath) {
    const repoTemplates = await loadTemplatesFromDir(path.join(repoPath, ".mikado", "actions"));
    for (const t of repoTemplates) templateMap.set(t.id, t); // repo overrides
  }

  return Array.from(templateMap.values());
}

function substitutePlaceholders(text: string, prevResult: string | null): string {
  if (!prevResult) return text;
  return text.replace(/\{\{prev_result\}\}/g, prevResult);
}

async function executeAction(action: Action, prevResult: string | null): Promise<string> {
  const cwd = action.config.cwd ?? process.cwd();

  switch (action.type) {
    case "claude-code": {
      const prompt = substitutePlaceholders(action.config.prompt ?? "", prevResult);
      const result = await runClaude({ prompt, cwd, allowedTools: action.config.allowedTools });
      if (result.exitCode !== 0) {
        throw new Error(`Claude failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`);
      }
      return result.stdout;
    }
    case "gh-cli": {
      const command = substitutePlaceholders(action.config.command ?? "", prevResult);
      const result = await runGh(command, cwd);
      if (result.exitCode !== 0) {
        throw new Error(`gh failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`);
      }
      return result.stdout;
    }
    case "shell": {
      const command = substitutePlaceholders(action.config.command ?? "", prevResult);
      const result = await runShell(command, cwd);
      if (result.exitCode !== 0) {
        throw new Error(`Shell failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`);
      }
      return result.stdout;
    }
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

export function registerActionTools(server: McpServer): void {
  server.tool(
    "list_action_templates",
    "List available action templates (centralized + repo overrides)",
    {
      repoPath: z.string().optional().describe("Optional repo path to include repo-specific templates"),
    },
    async ({ repoPath }) => {
      try {
        const templates = await loadAllTemplates(repoPath);
        return { content: [{ type: "text", text: JSON.stringify(templates) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "execute_action",
    "Execute a single action on a repository",
    {
      repoPath: z.string().describe("Absolute path to the repo (used as cwd)"),
      action: z.object({
        id: z.string(),
        type: z.enum(["claude-code", "gh-cli", "shell", "repo-template"]),
        label: z.string(),
        config: z.object({
          prompt: z.string().optional(),
          command: z.string().optional(),
          cwd: z.string().optional(),
          allowedTools: z.array(z.string()).optional(),
        }),
      }).describe("Action definition to execute"),
    },
    async ({ repoPath, action }) => {
      try {
        const fullAction: Action = {
          ...action,
          config: { ...action.config, cwd: action.config.cwd ?? repoPath },
          status: "running",
          result: null,
        };
        const result = await executeAction(fullAction, null);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "execute_node_actions",
    "Execute all actions of a node sequentially, passing results between them",
    {
      graphName: z.string().describe("Name of the graph"),
      nodeId: z.string().describe("ID of the node whose actions to execute"),
    },
    async ({ graphName, nodeId }) => {
      try {
        const graph = await readGraph(graphName);
        const node = graph.nodes[nodeId];
        if (!node) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Node "${nodeId}" not found` }) }] };
        }
        if (!node.actions?.length) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Node "${nodeId}" has no actions` }) }] };
        }

        const results: { id: string; status: string; result: string | null }[] = [];
        let prevResult: string | null = null;

        for (const action of node.actions) {
          action.status = "running";
          graph.updated_at = new Date().toISOString();
          await writeGraph(graphName, graph);

          try {
            const result = await executeAction(action, prevResult);
            action.status = "done";
            action.result = result;
            prevResult = result;
            results.push({ id: action.id, status: "done", result });
          } catch (err) {
            action.status = "failed";
            action.result = String(err);
            results.push({ id: action.id, status: "failed", result: String(err) });
            // Save and stop on failure
            graph.updated_at = new Date().toISOString();
            await writeGraph(graphName, graph);
            return { content: [{ type: "text", text: JSON.stringify({ partial: true, results }) }] };
          }
        }

        graph.updated_at = new Date().toISOString();
        await writeGraph(graphName, graph);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, results }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );
}
