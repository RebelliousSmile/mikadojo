import { describe, it, expect } from "vitest";
import type { Graph, Node } from "../schemas.js";
import {
  getActionableNodes,
  deleteNode,
  addNode,
  updateNode,
  validateDependsOn,
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

  it("should throw when depends_on references a non-existent node", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
    });
    expect(() =>
      addNode(graph, {
        id: "orphan",
        description: "has ghost dep",
        depends_on: ["does-not-exist"],
      }),
    ).toThrow('Dependency "does-not-exist" does not exist in graph');
  });

  it("should throw when depends_on creates a direct self-cycle", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
    });
    expect(() =>
      addNode(graph, {
        id: "a",
        description: "self-referencing",
        depends_on: ["a"],
      }),
    ).toThrow('Adding depends_on would create a cycle involving node "a"');
  });

  it("should throw when depends_on creates a transitive cycle (A → B → C → A)", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
      b: makeNode({ id: "b", depends_on: ["c"] }),
      c: makeNode({ id: "c", depends_on: ["a"] }),
    });
    // Adding "a" with depends_on: ["b"] would create a → b → c → a cycle
    expect(() =>
      addNode(graph, {
        id: "a",
        description: "creates cycle",
        depends_on: ["b"],
      }),
    ).toThrow('Adding depends_on would create a cycle involving node "a"');
  });

  it("should succeed when depends_on is valid with no cycle", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
      b: makeNode({ id: "b" }),
    });
    const result = addNode(graph, {
      id: "a",
      description: "depends on b",
      depends_on: ["b"],
    });
    expect(result.nodes["a"].depends_on).toEqual(["b"]);
  });

  it("should allow adding a node with status done and dependencies", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
      b: makeNode({ id: "b", status: "todo" }),
    });
    const result = addNode(graph, {
      id: "a",
      description: "done with deps",
      status: "done",
      depends_on: ["b"],
    });
    expect(result.nodes["a"].status).toBe("done");
    expect(result.nodes["a"].depends_on).toEqual(["b"]);
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

  it("should throw when depends_on references a non-existent node", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    expect(() =>
      updateNode(graph, "a", { depends_on: ["ghost-1", "ghost-2"] }),
    ).toThrow('Dependency "ghost-1" does not exist in graph');
  });

  it("should throw when new depends_on creates a cycle", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b", depends_on: ["a"] }),
    });
    // Making a depend on b would create a → b → a
    expect(() => updateNode(graph, "a", { depends_on: ["b"] })).toThrow(
      'Adding depends_on would create a cycle involving node "a"',
    );
  });

  it("should throw when marking root node done with unfinished dependencies", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root", depends_on: ["child"] }),
      child: makeNode({ id: "child", status: "todo" }),
    });
    expect(() => updateNode(graph, "root", { status: "done" })).toThrow(
      'Cannot mark root node "root" as done: dependencies [child] are not done',
    );
  });

  it("should allow marking root node done when all dependencies are done", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root", depends_on: ["child"] }),
      child: makeNode({ id: "child", status: "done" }),
    });
    const result = updateNode(graph, "root", { status: "done" });
    expect(result.nodes.root.status).toBe("done");
  });

  it("should allow marking root node done when it has no dependencies", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
    });
    const result = updateNode(graph, "root", { status: "done" });
    expect(result.nodes.root.status).toBe("done");
  });

  it("should allow marking a non-root node done even when its dependencies are not done", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
      a: makeNode({ id: "a", depends_on: ["b"] }),
      b: makeNode({ id: "b", status: "todo" }),
    });
    const result = updateNode(graph, "a", { status: "done" });
    expect(result.nodes.a.status).toBe("done");
  });

  it("should allow simultaneous depends_on + status=done on root when new deps are done", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root", depends_on: ["a"] }),
      a: makeNode({ id: "a", status: "todo" }),
      b: makeNode({ id: "b", status: "done" }),
    });
    // Replace deps with [b] (which is done) and mark root done at the same time
    const result = updateNode(graph, "root", {
      depends_on: ["b"],
      status: "done",
    });
    expect(result.nodes.root.status).toBe("done");
    expect(result.nodes.root.depends_on).toEqual(["b"]);
  });

  it("should throw simultaneous depends_on + status=done on root when new dep is not done", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root", depends_on: ["a"] }),
      a: makeNode({ id: "a", status: "done" }),
      c: makeNode({ id: "c", status: "todo" }),
    });
    // Replace deps with [c] (not done) and try to mark root done
    expect(() =>
      updateNode(graph, "root", { depends_on: ["c"], status: "done" }),
    ).toThrow(
      'Cannot mark root node "root" as done: dependencies [c] are not done',
    );
  });

  it("should throw when marking root done with ghost dependency", () => {
    const nodes: Record<string, Node> = {
      root: makeNode({ id: "root", depends_on: ["ghost"] }),
    };
    const graph: Graph = {
      version: "1.0",
      goal: "Test goal",
      phase: "design",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      root: "root",
      nodes,
    };
    expect(() => updateNode(graph, "root", { status: "done" })).toThrow(
      'Cannot mark root node "root" as done: dependencies [ghost] are not done',
    );
  });

  it("should list multiple unfinished deps in root-done error message", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root", depends_on: ["a", "b", "c"] }),
      a: makeNode({ id: "a", status: "done" }),
      b: makeNode({ id: "b", status: "todo" }),
      c: makeNode({ id: "c", status: "doing" }),
    });
    expect(() => updateNode(graph, "root", { status: "done" })).toThrow(
      'Cannot mark root node "root" as done: dependencies [b, c] are not done',
    );
  });

  it("should update and clear the assignee field", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    const result1 = updateNode(graph, "a", { assignee: "user1" });
    expect(result1.nodes.a.assignee).toBe("user1");

    const result2 = updateNode(result1, "a", { assignee: null });
    expect(result2.nodes.a.assignee).toBeNull();
  });

  it("should allow un-doing a done node even if dependents are done", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
      a: makeNode({ id: "a", status: "done" }),
      b: makeNode({ id: "b", status: "done", depends_on: ["a"] }),
    });
    const result = updateNode(graph, "a", { status: "todo" });
    expect(result.nodes.a.status).toBe("todo");
  });
});

describe("cross-feature integration", () => {
  it("should make dependent node actionable after deleting its dependency", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", status: "todo" }),
      b: makeNode({ id: "b", status: "todo", depends_on: ["a"] }),
    });
    const afterDelete = deleteNode(graph, "a");
    // b's depends_on should have been cleaned up
    expect(afterDelete.nodes.b.depends_on).toEqual([]);
    const actionable = getActionableNodes(afterDelete);
    expect(actionable).toEqual([afterDelete.nodes.b]);
  });
});

describe("validateDependsOn", () => {
  it("should not throw when all deps exist and no cycle", () => {
    const nodes: Record<string, Node> = {
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b" }),
    };
    expect(() => validateDependsOn(nodes, "a", ["b"])).not.toThrow();
  });

  it("should throw when a dependency does not exist", () => {
    const nodes: Record<string, Node> = {
      a: makeNode({ id: "a" }),
    };
    expect(() => validateDependsOn(nodes, "a", ["ghost"])).toThrow(
      'Dependency "ghost" does not exist in graph',
    );
  });

  it("should throw when depends_on creates a cycle", () => {
    const nodes: Record<string, Node> = {
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b", depends_on: ["a"] }),
    };
    expect(() => validateDependsOn(nodes, "a", ["b"])).toThrow(
      'Adding depends_on would create a cycle involving node "a"',
    );
  });

  it("should not throw for empty depends_on", () => {
    const nodes: Record<string, Node> = {
      a: makeNode({ id: "a" }),
    };
    expect(() => validateDependsOn(nodes, "a", [])).not.toThrow();
  });

  it("should throw for a longer transitive chain (4+ nodes)", () => {
    const nodes: Record<string, Node> = {
      a: makeNode({ id: "a", depends_on: ["b"] }),
      b: makeNode({ id: "b", depends_on: ["c"] }),
      c: makeNode({ id: "c", depends_on: ["d"] }),
      d: makeNode({ id: "d" }),
    };
    // d -> a would create d -> a -> b -> c -> d
    expect(() => validateDependsOn(nodes, "d", ["a"])).toThrow(
      'Adding depends_on would create a cycle involving node "d"',
    );
  });

  it("should throw when one of multiple deps creates a cycle", () => {
    const nodes: Record<string, Node> = {
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b", depends_on: ["a"] }),
      x: makeNode({ id: "x" }),
    };
    // a depends on [x, b]: x is fine, but b -> a creates a -> b -> a
    expect(() => validateDependsOn(nodes, "a", ["x", "b"])).toThrow(
      'Adding depends_on would create a cycle involving node "a"',
    );
  });

  it("should not throw for diamond dependency (no false positive)", () => {
    const nodes: Record<string, Node> = {
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b", depends_on: ["d"] }),
      c: makeNode({ id: "c", depends_on: ["d"] }),
      d: makeNode({ id: "d" }),
    };
    // a -> [b, c], both b and c -> d: diamond shape, no cycle
    expect(() => validateDependsOn(nodes, "a", ["b", "c"])).not.toThrow();
  });
});
