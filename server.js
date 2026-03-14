const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 5173;
const staticRoot = __dirname;
const mikadoDir = process.env.MIKADO_DIR || path.join(__dirname, "mikado");
const statusOptions = ["todo", "doing", "in-progress", "blocked", "done"];

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

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || "/").split("?")[0];

  if (urlPath === "/api/graphs") {
    const payload = await listGraphs();
    sendJson(res, 200, payload);
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
