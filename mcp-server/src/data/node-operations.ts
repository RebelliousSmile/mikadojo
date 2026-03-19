import type { Graph, Node, NodeStatus } from "../schemas.js";

function hasCycle(
  nodes: Record<string, Node>,
  startId: string,
  newDeps: string[],
): boolean {
  const visited = new Set<string>();

  function dfs(currentId: string): boolean {
    if (currentId === startId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    const node = nodes[currentId];
    if (!node) return false;
    for (const depId of node.depends_on) {
      if (dfs(depId)) return true;
    }
    return false;
  }

  for (const depId of newDeps) {
    visited.clear();
    if (dfs(depId)) return true;
  }
  return false;
}

export function validateDependsOn(
  nodes: Record<string, Node>,
  nodeId: string,
  dependsOn: string[],
): void {
  for (const depId of dependsOn) {
    if (!nodes[depId]) {
      throw new Error(`Dependency "${depId}" does not exist in graph`);
    }
  }
  if (hasCycle(nodes, nodeId, dependsOn)) {
    throw new Error(
      `Adding depends_on would create a cycle involving node "${nodeId}"`,
    );
  }
}

export function getActionableNodes(graph: Graph): Node[] {
  return Object.values(graph.nodes).filter((node) => {
    if (node.status === "done") return false;
    return node.depends_on.every((depId) => {
      const dep = graph.nodes[depId];
      return dep && dep.status === "done";
    });
  });
}

export function deleteNode(graph: Graph, nodeId: string): Graph {
  if (!graph.nodes[nodeId]) {
    throw new Error(`Node "${nodeId}" not found`);
  }

  const { [nodeId]: _, ...remainingNodes } = graph.nodes;

  const cleanedNodes: Record<string, Node> = {};
  for (const [id, node] of Object.entries(remainingNodes)) {
    cleanedNodes[id] = {
      ...node,
      depends_on: node.depends_on.filter((dep) => dep !== nodeId),
    };
  }

  return {
    ...graph,
    nodes: cleanedNodes,
    updated_at: new Date().toISOString(),
  };
}

export interface AddNodeInput {
  id: string;
  description: string;
  status?: NodeStatus;
  depends_on?: string[];
  notes?: string;
}

export function addNode(graph: Graph, input: AddNodeInput): Graph {
  if (graph.nodes[input.id]) {
    throw new Error(`Node "${input.id}" already exists`);
  }

  const now = new Date().toISOString();
  const newNode: Node = {
    id: input.id,
    description: input.description,
    status: input.status ?? "todo",
    depends_on: input.depends_on ?? [],
    notes: input.notes,
    created_at: now,
    updated_at: now,
  };

  const nodesWithNew = { ...graph.nodes, [input.id]: newNode };

  if (input.depends_on && input.depends_on.length > 0) {
    validateDependsOn(nodesWithNew, input.id, input.depends_on);
  }

  return {
    ...graph,
    nodes: nodesWithNew,
    updated_at: now,
  };
}

export interface UpdateNodeInput {
  status?: NodeStatus;
  description?: string;
  notes?: string;
  depends_on?: string[];
  assignee?: string | null;
}

export function updateNode(
  graph: Graph,
  nodeId: string,
  input: UpdateNodeInput,
): Graph {
  const node = graph.nodes[nodeId];
  if (!node) {
    throw new Error(`Node "${nodeId}" not found`);
  }

  const now = new Date().toISOString();
  const updatedNode: Node = { ...node, updated_at: now };

  if (input.status !== undefined) updatedNode.status = input.status;
  if (input.description !== undefined)
    updatedNode.description = input.description;
  if (input.notes !== undefined) updatedNode.notes = input.notes;
  if (input.depends_on !== undefined) {
    validateDependsOn(graph.nodes, nodeId, input.depends_on);
    updatedNode.depends_on = input.depends_on;
  }
  if (input.assignee !== undefined) updatedNode.assignee = input.assignee;

  if (input.status === "done" && nodeId === graph.root) {
    const unfinished = updatedNode.depends_on.filter((depId) => {
      const dep = graph.nodes[depId];
      return !dep || dep.status !== "done";
    });
    if (unfinished.length > 0) {
      throw new Error(
        `Cannot mark root node "${nodeId}" as done: dependencies [${unfinished.join(", ")}] are not done`,
      );
    }
  }

  return {
    ...graph,
    nodes: { ...graph.nodes, [nodeId]: updatedNode },
    updated_at: now,
  };
}
