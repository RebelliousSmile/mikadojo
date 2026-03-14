import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import express from "express";
import { MCP_PORT } from "./config.js";
import { registerGraphResources } from "./resources/graph-resources.js";
import { registerActionTools } from "./tools/action-tools.js";
import { registerGraphTools } from "./tools/graph-tools.js";
import { registerNodeTools } from "./tools/node-tools.js";
import { registerRepoTools } from "./tools/repo-tools.js";

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "kanban-mcp", version: "1.0.0" });
  registerGraphTools(server);
  registerNodeTools(server);
  registerRepoTools(server);
  registerActionTools(server);
  registerGraphResources(server);
  return server;
}

const app = express();
app.use(express.json());

const transports = new Map<string, StreamableHTTPServerTransport>();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;

  // Route to existing session
  if (sessionId) {
    const existing = transports.get(sessionId);
    if (existing) {
      await existing.handleRequest(req, res, req.body);
      return;
    }
  }

  // New session — each gets its own McpServer instance
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      transports.set(id, transport);
    },
  });
  transport.onclose = () => {
    if (transport.sessionId) transports.delete(transport.sessionId);
  };
  await createMcpServer().connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "Unknown session" });
    return;
  }
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "Unknown session" });
    return;
  }
  await transport.handleRequest(req, res);
});

app.listen(MCP_PORT, () => {
  console.log(`kanban-mcp server listening on http://localhost:${MCP_PORT}/mcp`);
});
