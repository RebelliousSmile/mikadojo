const http = require("http");
const fs = require("fs");
const path = require("path");

const { execFile } = require("child_process");

const port = Number(process.env.PORT) || 5173;
const staticRoot = __dirname;
const mikadoDir = process.env.MIKADO_DIR || path.join(__dirname, "mikado");
const statusOptions = ["todo", "doing", "in-progress", "blocked", "done"];
let lastChangeTimestamp = Date.now();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": contentTypes[".json"] });
  res.end(JSON.stringify(data, null, 2));
}

function listGraphs() {
  return new Promise((resolve) => {
    fs.readdir(mikadoDir, (error, files) => {
      if (error) {
        resolve({ graphs: [], errors: [{ file: mikadoDir, message: error.message }] });
        return;
      }

      const jsonFiles = files.filter((file) => file.toLowerCase().endsWith(".json"));
      const graphs = [];
      const errors = [];

      if (jsonFiles.length === 0) {
        resolve({ graphs, errors });
        return;
      }

      let pending = jsonFiles.length;
      jsonFiles.forEach((file) => {
        const filePath = path.join(mikadoDir, file);
        fs.readFile(filePath, "utf-8", (readError, content) => {
          if (readError) {
            errors.push({ file, message: readError.message });
          } else {
            try {
              const parsed = JSON.parse(content);
              const graph = parsed.mikado_graph || parsed;
              if (!graph || !graph.nodes) {
                errors.push({ file, message: "Missing mikado_graph.nodes" });
              } else {
                graphs.push({ name: file.replace(/\.json$/i, ""), graph });
              }
            } catch (parseError) {
              errors.push({ file, message: parseError.message });
            }
          }

          pending -= 1;
          if (pending === 0) {
            graphs.sort((a, b) => a.name.localeCompare(b.name));
            resolve({ graphs, errors });
          }
        });
      });
    });
  });
}

function resolveGraphPath(graphName) {
  if (!graphName || !/^[a-z0-9-_]+$/i.test(graphName)) return null;
  const filePath = path.join(mikadoDir, `${graphName}.json`);
  console.log(`Resolving graph path: ${filePath}`);
  if (!filePath.startsWith(mikadoDir)) return null;
  return filePath;
}

function updateGraphStatus(graphName, nodeId, status) {
  return new Promise((resolve) => {
    const filePath = resolveGraphPath(graphName);
    if (!filePath) {
      resolve({ ok: false, statusCode: 400, message: "Invalid graph name." });
      return;
    }

    fs.readFile(filePath, "utf-8", (readError, content) => {
      if (readError) {
        resolve({ ok: false, statusCode: 404, message: readError.message });
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        resolve({ ok: false, statusCode: 400, message: "Invalid JSON." });
        return;
      }

      const wrapped = !!parsed.mikado_graph;
      const graph = parsed.mikado_graph || parsed;
      if (!graph || !graph.nodes || !graph.nodes[nodeId]) {
        resolve({ ok: false, statusCode: 404, message: "Node not found." });
        return;
      }

      const now = new Date().toISOString();
      graph.nodes[nodeId].status = status;
      graph.nodes[nodeId].updated_at = now;
      graph.updated_at = now;

      const payload = wrapped ? { ...parsed, mikado_graph: graph } : graph;
      const output = JSON.stringify(payload, null, 2);
      fs.writeFile(filePath, output, "utf-8", (writeError) => {
        if (writeError) {
          resolve({ ok: false, statusCode: 500, message: writeError.message });
          return;
        }
        resolve({ ok: true, graph });
      });
    });
  });
}

function runShellCommand(command, cwd) {
  return new Promise((resolve) => {
    const isWin = process.platform === "win32";
    const shell = isWin ? "cmd" : "/bin/sh";
    const flag = isWin ? "/c" : "-c";
    execFile(shell, [flag, command], { cwd, maxBuffer: 5 * 1024 * 1024, timeout: 120000 }, (error, stdout, stderr) => {
      resolve({ stdout: String(stdout), stderr: String(stderr), exitCode: error ? 1 : 0 });
    });
  });
}

function executeAction(action, cwd) {
  const actionCwd = action.config && action.config.cwd ? action.config.cwd : cwd;
  switch (action.type) {
    case "claude-code": {
      const prompt = (action.config.prompt || "").replace(/"/g, '\\"');
      return runShellCommand(`claude --print -p "${prompt}"`, actionCwd);
    }
    case "gh-cli":
      return runShellCommand(`gh ${action.config.command || ""}`, actionCwd);
    case "shell":
      return runShellCommand(action.config.command || "echo no command", actionCwd);
    default:
      return Promise.resolve({ stdout: "", stderr: `Unknown action type: ${action.type}`, exitCode: 1 });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) { reject(new Error("Payload too large")); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("Invalid JSON")); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || "/", `http://localhost:${port}`);
  const urlPath = urlObj.pathname;

  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (urlPath === "/api/graphs") {
    const payload = await listGraphs();
    sendJson(res, 200, payload);
    return;
  }

  if (urlPath === "/api/last-change") {
    sendJson(res, 200, { timestamp: lastChangeTimestamp });
    return;
  }

  // POST /api/actions/execute — execute a single action
  if (urlPath === "/api/actions/execute" && req.method === "POST") {
    try {
      const payload = await readBody(req);
      const { action, cwd } = payload;
      if (!action || !action.type) {
        sendJson(res, 400, { error: "Missing action or action.type" });
        return;
      }
      const result = await executeAction(action, cwd || process.cwd());
      sendJson(res, 200, { success: result.exitCode === 0, ...result });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/graphs/:name/nodes/:id/run-actions — execute all node actions sequentially
  const runActionsMatch = urlPath.match(/^\/api\/graphs\/([^/]+)\/nodes\/([^/]+)\/run-actions$/);
  if (runActionsMatch && req.method === "POST") {
    const graphName = decodeURIComponent(runActionsMatch[1]);
    const nodeId = decodeURIComponent(runActionsMatch[2]);
    const filePath = resolveGraphPath(graphName);
    if (!filePath) { sendJson(res, 400, { error: "Invalid graph name" }); return; }

    try {
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const wrapped = !!content.mikado_graph;
      const graph = content.mikado_graph || content;
      const node = graph.nodes && graph.nodes[nodeId];
      if (!node) { sendJson(res, 404, { error: "Node not found" }); return; }
      if (!node.actions || node.actions.length === 0) { sendJson(res, 400, { error: "Node has no actions" }); return; }

      const results = [];
      let prevResult = null;

      for (const action of node.actions) {
        action.status = "running";
        const now = new Date().toISOString();
        graph.updated_at = now;
        const savePayload = wrapped ? { ...content, mikado_graph: graph } : graph;
        fs.writeFileSync(filePath, JSON.stringify(savePayload, null, 2), "utf-8");

        // Substitute {{prev_result}}
        const actionCopy = JSON.parse(JSON.stringify(action));
        if (prevResult && actionCopy.config) {
          for (const key of Object.keys(actionCopy.config)) {
            if (typeof actionCopy.config[key] === "string") {
              actionCopy.config[key] = actionCopy.config[key].replace(/\{\{prev_result\}\}/g, prevResult);
            }
          }
        }

        const result = await executeAction(actionCopy, actionCopy.config && actionCopy.config.cwd ? actionCopy.config.cwd : process.cwd());
        if (result.exitCode === 0) {
          action.status = "done";
          action.result = result.stdout;
          prevResult = result.stdout;
          results.push({ id: action.id, status: "done", result: result.stdout });
        } else {
          action.status = "failed";
          action.result = result.stderr || result.stdout;
          results.push({ id: action.id, status: "failed", result: action.result });
          // Save and stop
          graph.updated_at = new Date().toISOString();
          const failPayload = wrapped ? { ...content, mikado_graph: graph } : graph;
          fs.writeFileSync(filePath, JSON.stringify(failPayload, null, 2), "utf-8");
          sendJson(res, 200, { partial: true, results });
          return;
        }
      }

      graph.updated_at = new Date().toISOString();
      const finalPayload = wrapped ? { ...content, mikado_graph: graph } : graph;
      fs.writeFileSync(filePath, JSON.stringify(finalPayload, null, 2), "utf-8");
      sendJson(res, 200, { success: true, results });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  const updateMatch = urlPath.match(/^\/api\/graphs\/([^/]+)\/nodes\/([^/]+)\/status$/);
  if (updateMatch && req.method === "POST") {
    const graphName = decodeURIComponent(updateMatch[1]);
    const nodeId = decodeURIComponent(updateMatch[2]);

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        res.writeHead(413);
        res.end("Payload too large");
        req.destroy();
      }
    });

    req.on("end", async () => {
      let payload;
      try {
        payload = JSON.parse(body || "{}");
      } catch (error) {
        sendJson(res, 400, { error: "Invalid JSON" });
        return;
      }

      const status = payload.status;
      if (!statusOptions.includes(status)) {
        sendJson(res, 400, { error: "Invalid status" });
        return;
      }

      const result = await updateGraphStatus(graphName, nodeId, status);
      if (!result.ok) {
        sendJson(res, result.statusCode || 500, { error: result.message || "Update failed" });
        return;
      }

      sendJson(res, 200, { ok: true, graph: result.graph });
    });
    return;
  }

  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(staticRoot, safePath);

  if (!filePath.startsWith(staticRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "text/plain" });
    res.end(content);
  });
});

server.listen(port, () => {
  console.log(`Mikado Kanban server running on http://localhost:${port}`);
  console.log(`Using mikado directory: ${mikadoDir}`);
});

// Watch mikado/ directory for changes and update timestamp
try {
  fs.watch(mikadoDir, { recursive: false }, (eventType, filename) => {
    if (filename && filename.endsWith(".json")) {
      lastChangeTimestamp = Date.now();
    }
  });
} catch {
  console.warn("Could not watch mikado directory for changes");
}
