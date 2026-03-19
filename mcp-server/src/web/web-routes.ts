import { Router } from "express";
import { listGraphs, readGraph, writeNodeFile } from "../data/graph-store.js";
import { updateNode } from "../data/node-operations.js";
import { updateNodeStatus } from "../data/node-status-update.js";
import { STATUS_OPTIONS } from "../config.js";
import { syncAfterWrite } from "../git/sync-after-write.js";
import { getCurrentUser } from "../gh/gh-client.js";
import { onAssigneeChanged } from "../gh/issue-sync.js";
import type { NodeStatus } from "../schemas.js";

let lastChangeTimestamp = Date.now();

export function setLastChangeTimestamp(ts: number): void {
  lastChangeTimestamp = ts;
}

export function createWebRouter(): Router {
  const router = Router();

  router.get("/api/graphs", async (_req, res) => {
    try {
      const names = await listGraphs();
      const graphs: Array<{ name: string; graph: unknown }> = [];
      const errors: Array<{ file: string; message: string }> = [];

      for (const name of names) {
        try {
          const graph = await readGraph(name);
          graphs.push({ name, graph });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push({ file: `${name}.json`, message });
        }
      }

      graphs.sort((a, b) => a.name.localeCompare(b.name));
      res.json({ graphs, errors });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.json({ graphs: [], errors: [{ file: "mikado/", message }] });
    }
  });

  router.post("/api/graphs/:name/nodes/:id/status", async (req, res) => {
    const { name, id } = req.params;
    const { status } = req.body as { status?: string };

    if (!status || !STATUS_OPTIONS.includes(status as NodeStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    try {
      const result = await updateNodeStatus(name, id, status as NodeStatus);
      res.json({ ok: true, graph: result.graph });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not found")) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  });

  router.get("/api/last-change", (_req, res) => {
    res.json({ timestamp: lastChangeTimestamp });
  });

  router.post("/api/graphs/:name/nodes/:id/assign", async (req, res) => {
    const { name, id } = req.params;
    const { username } = req.body as { username?: string };

    try {
      const graph = await readGraph(name);

      if (graph.phase !== "development") {
        res.status(400).json({ error: "Cannot assign nodes outside development phase" });
        return;
      }

      const node = graph.nodes[id];

      if (!node) {
        res.status(404).json({ error: "Node not found." });
        return;
      }

      let assignee = username;
      if (!assignee) {
        try {
          assignee = await getCurrentUser();
        } catch {
          res.status(400).json({ error: "No username provided and gh not available" });
          return;
        }
      }

      const oldAssignee = node.assignee ?? null;
      const updated = updateNode(graph, id, { assignee });
      await writeNodeFile(name, id, updated.nodes[id]);
      await onAssigneeChanged(updated, node.issue_number ?? null, oldAssignee, assignee);
      await syncAfterWrite([`mikado/${name}/${id}.yaml`], `mikado: assign ${id} to ${assignee}`);
      res.json({ ok: true, graph: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.post("/api/graphs/:name/nodes/:id/unassign", async (req, res) => {
    const { name, id } = req.params;

    try {
      const graph = await readGraph(name);

      if (graph.phase !== "development") {
        res.status(400).json({ error: "Cannot unassign nodes outside development phase" });
        return;
      }

      const node = graph.nodes[id];

      if (!node) {
        res.status(404).json({ error: "Node not found." });
        return;
      }

      const oldAssignee = node.assignee ?? null;
      const updated = updateNode(graph, id, { assignee: null });
      await writeNodeFile(name, id, updated.nodes[id]);
      await onAssigneeChanged(updated, node.issue_number ?? null, oldAssignee, null);
      await syncAfterWrite([`mikado/${name}/${id}.yaml`], `mikado: unassign ${id}`);
      res.json({ ok: true, graph: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  let cachedUser: string | null | undefined;

  router.get("/api/me", async (_req, res) => {
    if (cachedUser === undefined) {
      try {
        cachedUser = await getCurrentUser();
      } catch {
        cachedUser = null;
      }
    }
    if (cachedUser) {
      res.json({ username: cachedUser });
    } else {
      res.json({ username: null, error: "gh not available" });
    }
  });

  return router;
}
