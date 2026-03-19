import type { Graph, Node, NodeStatus } from "../schemas.js";

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

  return {
    ...graph,
    nodes: { ...graph.nodes, [input.id]: newNode },
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
  if (input.depends_on !== undefined) updatedNode.depends_on = input.depends_on;
  if (input.assignee !== undefined) updatedNode.assignee = input.assignee;

  return {
    ...graph,
    nodes: { ...graph.nodes, [nodeId]: updatedNode },
    updated_at: now,
  };
}
