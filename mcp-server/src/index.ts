import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import express from "express";
import { MCP_PORT, MIKADO_DIR, PROJECT_ROOT } from "./config.js";
import { isGitRepo } from "./git/git-sync.js";
import { startGitWatcher } from "./git/git-watcher.js";
import { registerGraphResources } from "./resources/graph-resources.js";
import { registerGraphTools } from "./tools/graph-tools.js";
import { registerNodeTools } from "./tools/node-tools.js";
import { registerRepoTools } from "./tools/repo-tools.js";
import { createWebRouter, setLastChangeTimestamp } from "./web/web-routes.js";

const mcpServers: Set<McpServer> = new Set();

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "kanban-mcp", version: "1.0.0" });
  registerGraphTools(server);
  registerNodeTools(server);
  registerRepoTools(server);
  registerGraphResources(server);
  mcpServers.add(server);
  return server;
}

function broadcastResourceListChanged(): void {
  for (const server of mcpServers) {
    try {
      server.sendResourceListChanged();
    } catch {
      // session may be closed
    }
  }
}

const app = express();
app.use(express.json());

// CORS for local dev
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Web API routes (before MCP routes)
app.use(createWebRouter());

// Static files from project root
app.use(express.static(PROJECT_ROOT));

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
  const server = createMcpServer();
  transport.onclose = () => {
    if (transport.sessionId) transports.delete(transport.sessionId);
    mcpServers.delete(server);
  };
  await server.connect(transport);
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

const GIT_PULL_INTERVAL = Number(process.env.GIT_PULL_INTERVAL) || 30000;

app.listen(MCP_PORT, async () => {
  console.log(`kanban-mcp server listening on http://localhost:${MCP_PORT}/mcp`);
  console.log(`Web UI available at http://localhost:${MCP_PORT}/`);
  console.log(`Using mikado directory: ${MIKADO_DIR}`);

  // Start git watcher if project is a git repo
  const gitEnabled = await isGitRepo(PROJECT_ROOT);
  if (gitEnabled) {
    startGitWatcher({
      repoPath: PROJECT_ROOT,
      mikadoDir: MIKADO_DIR,
      pullIntervalMs: GIT_PULL_INTERVAL,
      onExternalChange: () => {
        setLastChangeTimestamp(Date.now());
        broadcastResourceListChanged();
      },
    });
    console.log(`Git sync enabled (pull every ${GIT_PULL_INTERVAL / 1000}s)`);
  } else {
    // Fallback: simple file watcher without git
    const { watch } = await import("chokidar");
    try {
      const watcher = watch(MIKADO_DIR, { ignoreInitial: true });
      watcher.on("all", (_event, filePath) => {
        if (filePath.endsWith(".json") || filePath.endsWith(".yaml")) {
          setLastChangeTimestamp(Date.now());
        }
      });
    } catch {
      console.warn("Could not watch mikado directory for changes");
    }
    console.log("Git sync disabled (not a git repo)");
  }
});
