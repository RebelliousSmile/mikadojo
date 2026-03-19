import { describe, it, expect } from "vitest";
import type { Graph, Node } from "../schemas.js";
import {
  getActionableNodes,
  deleteNode,
  addNode,
  updateNode,
} from "./node-operations.js";

function makeNode(overrides: Partial<Node> & { id: string }): Node {
  return {
    description: `Node ${overrides.id}`,
    status: "todo",
    depends_on: [],
    ...overrides,
  };
}

function makeGraph(nodes: Record<string, Node>): Graph {
  return {
    version: "1.0",
    goal: "Test goal",
    phase: "design",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    root: Object.keys(nodes)[0] ?? "root",
    nodes,
  };
}

describe("getActionableNodes", () => {
  it("should return nodes with no dependencies that are not done", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "todo", depends_on: [] }),
    });
    const result = getActionableNodes(graph);
    expect(result).toEqual([graph.nodes.a]);
  });

  it("should exclude done nodes", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "done", depends_on: [] }),
    });
    const result = getActionableNodes(graph);
    expect(result).toEqual([]);
  });

  it("should return node when all dependencies are done", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "done", depends_on: [] }),
      b: makeNode({ id: "b", status: "todo", depends_on: ["a"] }),
    });
    const result = getActionableNodes(graph);
    expect(result).toEqual([graph.nodes.b]);
  });

  it("should exclude node when some dependencies are not done", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "todo", depends_on: [] }),
      b: makeNode({ id: "b", status: "todo", depends_on: ["a"] }),
    });
    const result = getActionableNodes(graph);
    expect(result).toEqual([graph.nodes.a]);
  });

  it("should exclude node when dependency does not exist in graph", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "todo", depends_on: ["missing"] }),
    });
    const result = getActionableNodes(graph);
    expect(result).toEqual([]);
  });

  it("should return empty array when all nodes are done", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "done" }),
      b: makeNode({ id: "b", status: "done", depends_on: ["a"] }),
    });
    const result = getActionableNodes(graph);
    expect(result).toEqual([]);
  });

  it("should return empty array when graph has no nodes", () => {
    const graph = makeGraph({});
    const result = getActionableNodes(graph);
    expect(result).toEqual([]);
  });

  it("should treat a node that depends on itself as blocked", () => {
    // BUG/EDGE CASE: a node depending on itself is never actionable
    // because dep "a" is found but its status is "todo" (not "done"),
    // so the .every() check fails. This is accidental but correct behavior.
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "todo", depends_on: ["a"] }),
    });
    const result = getActionableNodes(graph);
    expect(result).toEqual([]);
  });

  it("should treat a self-referencing done node as actionable=false (already done)", () => {
    // A done node that depends on itself is excluded because status is "done",
    // not because of the self-dependency.
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "done", depends_on: ["a"] }),
    });
    const result = getActionableNodes(graph);
    expect(result).toEqual([]);
  });
});

describe("deleteNode", () => {
  it("should remove the node from the graph", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b" }),
    });
    const result = deleteNode(graph, "a");
    expect(result.nodes.a).toBeUndefined();
    expect(result.nodes.b).toBeDefined();
  });

  it("should clean up depends_on references in other nodes", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b", depends_on: ["a", "c"] }),
      c: makeNode({ id: "c" }),
    });
    const result = deleteNode(graph, "a");
    expect(result.nodes.b.depends_on).toEqual(["c"]);
  });

  it("should throw when node does not exist", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    expect(() => deleteNode(graph, "missing")).toThrow(
      'Node "missing" not found',
    );
  });

  it("should not mutate the original graph", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b", depends_on: ["a"] }),
    });
    deleteNode(graph, "a");
    expect(graph.nodes.a).toBeDefined();
    expect(graph.nodes.b.depends_on).toEqual(["a"]);
  });

  it("should clean up depends_on in multiple dependent nodes", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b", depends_on: ["a"] }),
      c: makeNode({ id: "c", depends_on: ["a", "b"] }),
    });
    const result = deleteNode(graph, "a");
    expect(result.nodes.b.depends_on).toEqual([]);
    expect(result.nodes.c.depends_on).toEqual(["b"]);
  });

  it("should allow deleting the root node", () => {
    // The root field still references the deleted node id — no cleanup.
    // This is a potential integrity issue but deleteNode does not check for it.
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
      child: makeNode({ id: "child", depends_on: ["root"] }),
    });
    const result = deleteNode(graph, "root");
    expect(result.nodes["root"]).toBeUndefined();
    expect(result.nodes["child"].depends_on).toEqual([]);
    // WARNING: graph.root still points to "root" which no longer exists
    expect(result.root).toBe("root");
  });
});

describe("addNode", () => {
  it("should add a new node with defaults", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
    });
    const result = addNode(graph, {
      id: "new-node",
      description: "A new node",
    });
    expect(result.nodes["new-node"]).toMatchObject({
      id: "new-node",
      description: "A new node",
      status: "todo",
      depends_on: [],
    });
    expect(result.nodes["new-node"].created_at).toBeDefined();
    expect(result.nodes["new-node"].updated_at).toBeDefined();
  });

  it("should accept optional fields", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
    });
    const result = addNode(graph, {
      id: "new-node",
      description: "A new node",
      status: "doing",
      depends_on: ["root"],
      notes: "some notes",
    });
    expect(result.nodes["new-node"].status).toBe("doing");
    expect(result.nodes["new-node"].depends_on).toEqual(["root"]);
    expect(result.nodes["new-node"].notes).toBe("some notes");
  });

  it("should throw when node already exists", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    expect(() =>
      addNode(graph, { id: "a", description: "duplicate" }),
    ).toThrow('Node "a" already exists');
  });

  it("should not mutate the original graph", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
    });
    addNode(graph, { id: "new", description: "new" });
    expect(graph.nodes["new"]).toBeUndefined();
  });

  it("should allow adding a node with depends_on referencing non-existent nodes", () => {
    // WARNING: no validation on depends_on references.
    // This creates a dangling dependency — getActionableNodes will treat
    // the node as blocked (non-existent dep is not "done").
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
    });
    const result = addNode(graph, {
      id: "orphan",
      description: "has ghost dep",
      depends_on: ["does-not-exist"],
    });
    expect(result.nodes["orphan"].depends_on).toEqual(["does-not-exist"]);
    // Confirm the orphan node is blocked because of the dangling reference
    const actionable = getActionableNodes(result);
    const actionableIds = actionable.map((n) => n.id);
    expect(actionableIds).not.toContain("orphan");
  });

  it("should allow adding a node with empty string id", () => {
    // WARNING: no validation on id format.
    // An empty string id is accepted and stored as a valid key.
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
    });
    const result = addNode(graph, {
      id: "",
      description: "empty id node",
    });
    expect(result.nodes[""]).toBeDefined();
    expect(result.nodes[""].id).toBe("");
  });
});

describe("updateNode", () => {
  it("should update status field", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "todo" }),
    });
    const result = updateNode(graph, "a", { status: "done" });
    expect(result.nodes.a.status).toBe("done");
  });

  it("should update description field", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    const result = updateNode(graph, "a", { description: "updated" });
    expect(result.nodes.a.description).toBe("updated");
  });

  it("should update depends_on field", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b" }),
    });
    const result = updateNode(graph, "a", { depends_on: ["b"] });
    expect(result.nodes.a.depends_on).toEqual(["b"]);
  });

  it("should update notes field", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    const result = updateNode(graph, "a", { notes: "new notes" });
    expect(result.nodes.a.notes).toBe("new notes");
  });

  it("should update updated_at timestamp", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    const result = updateNode(graph, "a", { status: "done" });
    expect(result.nodes.a.updated_at).toBeDefined();
    expect(result.updated_at).toBeDefined();
  });

  it("should throw when node does not exist", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    expect(() => updateNode(graph, "missing", { status: "done" })).toThrow(
      'Node "missing" not found',
    );
  });

  it("should not mutate the original graph", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "todo" }),
    });
    updateNode(graph, "a", { status: "done" });
    expect(graph.nodes.a.status).toBe("todo");
  });

  it("should only update provided fields", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "todo", notes: "keep me" }),
    });
    const result = updateNode(graph, "a", { status: "done" });
    expect(result.nodes.a.notes).toBe("keep me");
    expect(result.nodes.a.description).toBe("Node a");
  });

  it("should still update updated_at when called with empty object", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "todo" }),
    });
    const before = graph.updated_at;
    const result = updateNode(graph, "a", {});
    // updated_at on the node and graph should be refreshed
    expect(result.updated_at).not.toBe(before);
    expect(result.nodes.a.updated_at).toBeDefined();
    // No other fields changed
    expect(result.nodes.a.status).toBe("todo");
    expect(result.nodes.a.description).toBe("Node a");
  });

  it("should allow updating depends_on to reference non-existent nodes", () => {
    // WARNING: no validation on depends_on references.
    // This silently creates dangling dependencies.
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    const result = updateNode(graph, "a", { depends_on: ["ghost-1", "ghost-2"] });
    expect(result.nodes.a.depends_on).toEqual(["ghost-1", "ghost-2"]);
    // The node becomes blocked because ghost deps are not "done"
    expect(getActionableNodes(result)).toEqual([]);
  });
});
