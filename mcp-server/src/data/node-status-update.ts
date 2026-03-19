import { readGraph, writeNodeFile } from "./graph-store.js";
import { updateNode } from "./node-operations.js";
import { syncAfterWrite } from "../git/sync-after-write.js";
import { onNodeDone } from "../gh/issue-sync.js";
import type { Graph, NodeStatus } from "../schemas.js";

export interface StatusUpdateResult {
  graph: Graph;
}

export async function updateNodeStatus(
  graphName: string,
  nodeId: string,
  status: NodeStatus,
): Promise<StatusUpdateResult> {
  const graph = await readGraph(graphName);
  const oldNode = graph.nodes[nodeId];
  if (!oldNode) {
    throw new Error(`Node "${nodeId}" not found`);
  }

  const updated = updateNode(graph, nodeId, { status });
  await writeNodeFile(graphName, nodeId, updated.nodes[nodeId]);

  if (status === "done") {
    await onNodeDone(updated, oldNode.issue_number ?? null);
  }

  await syncAfterWrite([`mikado/${graphName}/${nodeId}.yaml`], `mikado: ${nodeId} -> ${status}`);
  return { graph: updated };
}
