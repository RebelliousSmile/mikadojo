import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readGraph, writeGraph, writeNodeFile } from "../data/graph-store.js";
import {
  getActionableNodes,
  deleteNode,
  addNode,
  updateNode,
} from "../data/node-operations.js";
import { updateNodeStatus as sharedUpdateNodeStatus } from "../data/node-status-update.js";
import { syncAfterWrite } from "../git/sync-after-write.js";
import { getCurrentUser } from "../gh/gh-client.js";
import {
  onNodeCreated,
  onNodeDeleted,
  onNodeDone,
  onAssigneeChanged,
} from "../gh/issue-sync.js";
import { NodeStatus } from "../schemas.js";

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
    },
    async ({ graphName, nodeId, description, status, depends_on, notes }) => {
      try {
        const graph = await readGraph(graphName);
        if (graph.phase === "development") {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Cannot add nodes in development phase" }) }] };
        }
        try {
          const updated = addNode(graph, {
            id: nodeId,
            description,
            status,
            depends_on,
            notes,
          });
          await writeGraph(graphName, updated);

          // Issue sync: create issue if graph is in design phase and has github config
          if (updated.phase === "design" && updated.github) {
            const issueNumber = await onNodeCreated(updated, nodeId, graphName);
            if (issueNumber != null) {
              const nodeWithIssue = { ...updated.nodes[nodeId], issue_number: issueNumber };
              await writeNodeFile(graphName, nodeId, nodeWithIssue);
            }
          }

          await syncAfterWrite([`mikado/${graphName}/${nodeId}.yaml`, `mikado/${graphName}/_meta.yaml`], `mikado: add node ${nodeId} to ${graphName}`);
          return { content: [{ type: "text", text: JSON.stringify({ success: true, nodeId }) }] };
        } catch (validationErr) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Node "${nodeId}" already exists in graph "${graphName}"` }) }] };
        }
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
      status: NodeStatus.optional().describe("New status"),
      description: z.string().optional().describe("New description"),
      notes: z.string().optional().describe("New notes"),
      depends_on: z.array(z.string()).optional().describe("New dependency list"),
      assignee: z.string().nullable().optional().describe("Assignee GitHub username"),
    },
    async ({ graphName, nodeId, status, description, notes, depends_on, assignee }) => {
      try {
        const graph = await readGraph(graphName);
        try {
          const oldNode = graph.nodes[nodeId];
          if (!oldNode) {
            return { content: [{ type: "text", text: JSON.stringify({ error: `Node "${nodeId}" not found in graph "${graphName}"` }) }] };
          }

          const updated = updateNode(graph, nodeId, {
            status,
            description,
            notes,
            depends_on,
            assignee,
          });

          await writeNodeFile(graphName, nodeId, updated.nodes[nodeId]);

          // Issue sync: status done
          if (status === "done") {
            await onNodeDone(updated, oldNode.issue_number ?? null);
          }

          // Issue sync: assignee changed
          if (assignee !== undefined) {
            const oldAssignee = oldNode.assignee ?? null;
            const newAssignee = assignee;
            if (oldAssignee !== newAssignee) {
              await onAssigneeChanged(updated, oldNode.issue_number ?? null, oldAssignee, newAssignee);
            }
          }

          await syncAfterWrite([`mikado/${graphName}/${nodeId}.yaml`], `mikado: update node ${nodeId} in ${graphName}`);
          return { content: [{ type: "text", text: JSON.stringify({ success: true, nodeId }) }] };
        } catch (validationErr) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Node "${nodeId}" not found in graph "${graphName}"` }) }] };
        }
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
        if (graph.phase === "development") {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Cannot delete nodes in development phase" }) }] };
        }
        try {
          const nodeToDelete = graph.nodes[nodeId];
          const issueNumber = nodeToDelete?.issue_number ?? null;

          const updated = deleteNode(graph, nodeId);
          await writeGraph(graphName, updated);

          // Issue sync: close issue on delete
          await onNodeDeleted(updated, issueNumber);

          await syncAfterWrite([`mikado/${graphName}`], `mikado: delete node ${nodeId} from ${graphName}`);
          return { content: [{ type: "text", text: JSON.stringify({ success: true, nodeId }) }] };
        } catch (validationErr) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Node "${nodeId}" not found in graph "${graphName}"` }) }] };
        }
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
        await sharedUpdateNodeStatus(graphName, nodeId, status);
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
        const actionable = getActionableNodes(graph);
        return { content: [{ type: "text", text: JSON.stringify(actionable) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "get_current_user",
    "Get the GitHub username of the current user (via gh CLI)",
    {},
    async () => {
      try {
        const username = await getCurrentUser();
        return { content: [{ type: "text", text: JSON.stringify({ username }) }] };
      } catch {
        return { content: [{ type: "text", text: JSON.stringify({ error: "gh CLI not available" }) }] };
      }
    }
  );
}
