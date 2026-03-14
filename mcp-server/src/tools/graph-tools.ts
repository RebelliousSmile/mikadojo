import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listGraphs, readGraph, writeGraph, deleteGraph, graphExists } from "../data/graph-store.js";
import type { Graph } from "../schemas.js";

export function registerGraphTools(server: McpServer): void {
  server.tool(
    "list_graphs",
    "List all available Mikado graph names",
    {},
    async () => {
      try {
        const graphs = await listGraphs();
        return { content: [{ type: "text", text: JSON.stringify(graphs) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "get_graph",
    "Get the full data of a Mikado graph",
    { graphName: z.string().describe("Name of the graph (without .json extension)") },
    async ({ graphName }) => {
      try {
        const graph = await readGraph(graphName);
        return { content: [{ type: "text", text: JSON.stringify(graph) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "create_graph",
    "Create a new Mikado graph with a root node",
    {
      graphName: z.string().describe("Name of the graph (alphanumeric, hyphens, underscores)"),
      goal: z.string().describe("The top-level goal of the graph"),
      rootNodeId: z.string().describe("ID of the root node (kebab-case)"),
      rootDescription: z.string().describe("Description of the root node"),
    },
    async ({ graphName, goal, rootNodeId, rootDescription }) => {
      try {
        if (await graphExists(graphName)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Graph "${graphName}" already exists` }) }] };
        }
        const now = new Date().toISOString();
        const graph: Graph = {
          version: "1.0",
          goal,
          created_at: now,
          updated_at: now,
          nodes: {
            [rootNodeId]: {
              id: rootNodeId,
              description: rootDescription,
              status: "todo",
              depends_on: [],
              notes: "",
              created_at: now,
              updated_at: now,
            },
          },
          root: rootNodeId,
        };
        await writeGraph(graphName, graph);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, graphName }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "delete_graph",
    "Delete a Mikado graph",
    { graphName: z.string().describe("Name of the graph to delete") },
    async ({ graphName }) => {
      try {
        if (!(await graphExists(graphName))) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Graph "${graphName}" not found` }) }] };
        }
        await deleteGraph(graphName);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, graphName }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );
}
