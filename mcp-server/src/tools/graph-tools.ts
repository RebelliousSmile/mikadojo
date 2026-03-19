import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listGraphs, readGraph, writeGraph, deleteGraph, graphExists } from "../data/graph-store.js";
import { syncAfterWrite } from "../git/sync-after-write.js";
import { lockGraph, unlockSubtree } from "../data/phase-operations.js";
import { isGhAvailable, getCurrentUser, getUserPermission } from "../gh/gh-client.js";
import type { Graph } from "../schemas.js";

async function checkMaintainerPermission(graph: Graph): Promise<string | null> {
  if (!graph.github) return null;
  try {
    if (!(await isGhAvailable())) return null;
    const username = await getCurrentUser();
    const permission = await getUserPermission(graph.github.owner, graph.github.repo, username);
    if (permission !== "admin" && permission !== "maintain") {
      return `Permission denied: "${permission}" is not sufficient. Requires "admin" or "maintain".`;
    }
  } catch {
    // gh not available, skip permission check
  }
  return null;
}

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
          phase: "design",
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
        await syncAfterWrite([`mikado/${graphName}`], `mikado: create graph ${graphName}`);
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
        await syncAfterWrite([`mikado/${graphName}`], `mikado: delete graph ${graphName}`);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, graphName }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "lock_graph",
    "Lock a graph from design to development phase",
    {
      graphName: z.string().describe("Name of the graph"),
    },
    async ({ graphName }) => {
      try {
        const graph = await readGraph(graphName);

        const permError = await checkMaintainerPermission(graph);
        if (permError) {
          return { content: [{ type: "text", text: JSON.stringify({ error: permError }) }] };
        }

        const updated = lockGraph(graph);
        await writeGraph(graphName, updated);
        await syncAfterWrite([`mikado/${graphName}`], `mikado: lock graph ${graphName}`);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, graphName, phase: "development" }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "unlock_subtree",
    "Unlock a node and its descendants back to design phase",
    {
      graphName: z.string().describe("Name of the graph"),
      nodeId: z.string().describe("Root node of the subtree to unlock"),
    },
    async ({ graphName, nodeId }) => {
      try {
        const graph = await readGraph(graphName);

        const permError = await checkMaintainerPermission(graph);
        if (permError) {
          return { content: [{ type: "text", text: JSON.stringify({ error: permError }) }] };
        }

        const updated = unlockSubtree(graph, nodeId);
        await writeGraph(graphName, updated);
        await syncAfterWrite([`mikado/${graphName}`], `mikado: unlock subtree ${nodeId} in ${graphName}`);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, graphName, nodeId, phase: "design" }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );
}
