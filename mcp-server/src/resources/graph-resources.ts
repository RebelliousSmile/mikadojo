import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listGraphs, readGraph } from "../data/graph-store.js";
import { listRepos } from "../data/repo-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA_DOC = {
  graph: {
    version: "string",
    goal: "string",
    created_at: "string (ISO 8601)",
    updated_at: "string (ISO 8601)",
    nodes: "Record<string, Node>",
    root: "string (node ID)",
  },
  node: {
    id: "string (kebab-case)",
    description: "string",
    status: "todo | doing | in-progress | blocked | done",
    depends_on: "string[] (node IDs)",
    notes: "string (optional)",
    created_at: "string (ISO 8601, optional)",
    updated_at: "string (ISO 8601, optional)",
  },
};

export function registerGraphResources(server: McpServer): void {
  server.resource(
    "graphs-list",
    "mikado://graphs",
    { description: "List of all available Mikado graph names" },
    async () => {
      const graphs = await listGraphs();
      return {
        contents: [
          {
            uri: "mikado://graphs",
            text: JSON.stringify(graphs),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  server.resource(
    "graph-by-name",
    new ResourceTemplate("mikado://graphs/{graphName}", { list: undefined }),
    { description: "Full data of a specific Mikado graph" },
    async (uri, variables) => {
      const graphName = variables.graphName as string;
      const graph = await readGraph(graphName);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(graph),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  server.resource(
    "node-by-id",
    new ResourceTemplate("mikado://graphs/{graphName}/nodes/{nodeId}", { list: undefined }),
    { description: "Data of a specific node in a Mikado graph" },
    async (uri, variables) => {
      const graphName = variables.graphName as string;
      const nodeId = variables.nodeId as string;
      const graph = await readGraph(graphName);
      const node = graph.nodes[nodeId];
      if (!node) {
        throw new Error(`Node "${nodeId}" not found in graph "${graphName}"`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(node),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  server.resource(
    "repos-list",
    "mikado://repos",
    { description: "List of all registered repositories" },
    async () => {
      const repos = await listRepos();
      return {
        contents: [
          {
            uri: "mikado://repos",
            text: JSON.stringify(repos),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  server.resource(
    "schema",
    "mikado://schema",
    { description: "JSON schema describing graph and node structure" },
    async () => {
      return {
        contents: [
          {
            uri: "mikado://schema",
            text: JSON.stringify(SCHEMA_DOC, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  server.resource(
    "guide",
    "mikado://guide",
    { description: "Mikado graph usage guide with concepts, workflows, and examples" },
    async () => {
      const projectRoot = path.resolve(__dirname, "../..");
      const guidePath = path.join(projectRoot, "src", "resources", "guide.md");
      const content = await fs.readFile(guidePath, "utf-8");
      return {
        contents: [
          {
            uri: "mikado://guide",
            text: content,
            mimeType: "text/markdown",
          },
        ],
      };
    }
  );
}
