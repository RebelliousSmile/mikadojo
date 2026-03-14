import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readGraph, writeGraph, graphExists } from "../data/graph-store.js";
import { NodeStatus, ActionStatus, Action } from "../schemas.js";

const ActionConfigSchema = z.object({
  prompt: z.string().optional(),
  command: z.string().optional(),
  cwd: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
});

const ActionSchema = z.object({
  id: z.string(),
  type: z.enum(["claude-code", "gh-cli", "shell", "repo-template"]),
  label: z.string(),
  config: ActionConfigSchema,
  status: ActionStatus,
  result: z.string().nullable(),
});

export function registerNodeTools(server: McpServer): void {
  server.tool(
    "get_node",
    "Get a specific node from a Mikado graph",
    {
      graphName: z.string().describe("Name of the graph"),
      nodeId: z.string().describe("ID of the node"),
    },
    async ({ graphName, nodeId }) => {
      try {
        const graph = await readGraph(graphName);
        const node = graph.nodes[nodeId];
        if (!node) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Node "${nodeId}" not found in graph "${graphName}"` }) }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(node) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "add_node",
    "Add a new node to a Mikado graph",
    {
      graphName: z.string().describe("Name of the graph"),
      nodeId: z.string().describe("ID of the new node (kebab-case)"),
      description: z.string().describe("Description of the node"),
      status: NodeStatus.optional().describe("Initial status (default: todo)"),
      depends_on: z.array(z.string()).optional().describe("Array of node IDs this node depends on"),
      notes: z.string().optional().describe("Optional notes"),
      actions: z.array(ActionSchema).optional().describe("Optional actions for the node"),
    },
    async ({ graphName, nodeId, description, status, depends_on, notes, actions }) => {
      try {
        const graph = await readGraph(graphName);
        if (graph.nodes[nodeId]) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Node "${nodeId}" already exists in graph "${graphName}"` }) }] };
        }
        const now = new Date().toISOString();
        graph.nodes[nodeId] = {
          id: nodeId,
          description,
          status: status ?? "todo",
          depends_on: depends_on ?? [],
          notes: notes,
          actions: actions,
          created_at: now,
          updated_at: now,
        };
        graph.updated_at = now;
        await writeGraph(graphName, graph);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, nodeId }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "update_node",
    "Update fields of an existing node in a Mikado graph",
    {
      graphName: z.string().describe("Name of the graph"),
      nodeId: z.string().describe("ID of the node to update"),
      description: z.string().optional().describe("New description"),
      notes: z.string().optional().describe("New notes"),
      depends_on: z.array(z.string()).optional().describe("New dependency list"),
      actions: z.array(ActionSchema).optional().describe("New actions list"),
    },
    async ({ graphName, nodeId, description, notes, depends_on, actions }) => {
      try {
        const graph = await readGraph(graphName);
        const node = graph.nodes[nodeId];
        if (!node) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Node "${nodeId}" not found in graph "${graphName}"` }) }] };
        }
        const now = new Date().toISOString();
        if (description !== undefined) node.description = description;
        if (notes !== undefined) node.notes = notes;
        if (depends_on !== undefined) node.depends_on = depends_on;
        if (actions !== undefined) node.actions = actions;
        node.updated_at = now;
        graph.updated_at = now;
        await writeGraph(graphName, graph);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, nodeId }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "delete_node",
    "Delete a node from a Mikado graph and clean up references",
    {
      graphName: z.string().describe("Name of the graph"),
      nodeId: z.string().describe("ID of the node to delete"),
    },
    async ({ graphName, nodeId }) => {
      try {
        const graph = await readGraph(graphName);
        if (!graph.nodes[nodeId]) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Node "${nodeId}" not found in graph "${graphName}"` }) }] };
        }
        delete graph.nodes[nodeId];
        for (const node of Object.values(graph.nodes)) {
          node.depends_on = node.depends_on.filter((dep) => dep !== nodeId);
        }
        graph.updated_at = new Date().toISOString();
        await writeGraph(graphName, graph);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, nodeId }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "update_node_status",
    "Change the status of a node in a Mikado graph",
    {
      graphName: z.string().describe("Name of the graph"),
      nodeId: z.string().describe("ID of the node"),
      status: NodeStatus.describe("New status value"),
    },
    async ({ graphName, nodeId, status }) => {
      try {
        const graph = await readGraph(graphName);
        const node = graph.nodes[nodeId];
        if (!node) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Node "${nodeId}" not found in graph "${graphName}"` }) }] };
        }
        const now = new Date().toISOString();
        node.status = status;
        node.updated_at = now;
        graph.updated_at = now;
        await writeGraph(graphName, graph);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, nodeId, status }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "get_actionable_nodes",
    "Get nodes where all dependencies are done and the node itself is not done",
    {
      graphName: z.string().describe("Name of the graph"),
    },
    async ({ graphName }) => {
      try {
        const graph = await readGraph(graphName);
        const actionable = Object.values(graph.nodes).filter((node) => {
          if (node.status === "done") return false;
          return node.depends_on.every((depId) => {
            const dep = graph.nodes[depId];
            return dep && dep.status === "done";
          });
        });
        return { content: [{ type: "text", text: JSON.stringify(actionable) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );
}
