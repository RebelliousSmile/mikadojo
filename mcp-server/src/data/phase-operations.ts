import type { Graph } from "../schemas.js";

export function getDescendants(graph: Graph, nodeId: string): string[] {
  if (!graph.nodes[nodeId]) {
    throw new Error(`Node "${nodeId}" not found`);
  }

  const descendants: Set<string> = new Set();
  const queue: string[] = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [id, node] of Object.entries(graph.nodes)) {
      if (node.depends_on.includes(current) && !descendants.has(id)) {
        descendants.add(id);
        queue.push(id);
      }
    }
  }

  return [...descendants];
}

export function lockGraph(graph: Graph): Graph {
  if (graph.phase === "development") {
    throw new Error("Graph is already in development phase");
  }

  if (graph.github) {
    for (const [id, node] of Object.entries(graph.nodes)) {
      if (node.issue_number == null) {
        throw new Error(`Node "${id}" is missing issue_number (required when github config is present)`);
      }
    }
  }

  return {
    ...graph,
    phase: "development",
    updated_at: new Date().toISOString(),
  };
}

export function canUnlockSubtree(
  graph: Graph,
  nodeId: string,
): { canUnlock: boolean; blockers: string[] } {
  if (!graph.nodes[nodeId]) {
    throw new Error(`Node "${nodeId}" not found`);
  }

  const descendants = getDescendants(graph, nodeId);
  const subtree = [nodeId, ...descendants];
  const blockers: string[] = [];

  for (const id of subtree) {
    const node = graph.nodes[id];
    if (node && node.assignee) {
      blockers.push(id);
    }
  }

  return {
    canUnlock: blockers.length === 0,
    blockers,
  };
}

// unlockSubtree reverts the ENTIRE graph to "design" phase, not just the subtree.
// This is intentional: structural changes require the graph to be in design phase.
// The pre-condition (canUnlockSubtree) only checks the subtree for assignees,
// but the phase change affects the whole graph.
export function unlockSubtree(graph: Graph, nodeId: string): Graph {
  if (graph.phase !== "development") {
    throw new Error("Graph is not in development phase");
  }

  if (!graph.nodes[nodeId]) {
    throw new Error(`Node "${nodeId}" not found`);
  }

  const { canUnlock, blockers } = canUnlockSubtree(graph, nodeId);
  if (!canUnlock) {
    throw new Error(`Cannot unlock subtree: nodes [${blockers.join(", ")}] have assignees`);
  }

  return {
    ...graph,
    phase: "design",
    updated_at: new Date().toISOString(),
  };
}
