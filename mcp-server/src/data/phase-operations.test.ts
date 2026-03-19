import { describe, it, expect } from "vitest";
import type { Graph, Node } from "../schemas.js";
import {
  lockGraph,
  unlockSubtree,
  getDescendants,
  canUnlockSubtree,
} from "./phase-operations.js";

function makeNode(overrides: Partial<Node> & { id: string }): Node {
  return {
    description: `Node ${overrides.id}`,
    status: "todo",
    depends_on: [],
    ...overrides,
  };
}

function makeGraph(nodes: Record<string, Node>, overrides?: Partial<Graph>): Graph {
  return {
    version: "1.0",
    goal: "Test goal",
    phase: "design",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    root: Object.keys(nodes)[0] ?? "root",
    nodes,
    ...overrides,
  };
}

describe("lockGraph", () => {
  it("should lock a graph in design phase", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
    });
    const result = lockGraph(graph);
    expect(result.phase).toBe("development");
  });

  it("should throw when graph is already in development", () => {
    const graph = makeGraph(
      { root: makeNode({ id: "root" }) },
      { phase: "development" },
    );
    expect(() => lockGraph(graph)).toThrow("already in development");
  });

  it("should throw when github config present but node missing issue_number", () => {
    const graph = makeGraph(
      { root: makeNode({ id: "root" }) },
      { github: { owner: "org", repo: "repo" } },
    );
    expect(() => lockGraph(graph)).toThrow("missing issue_number");
  });

  it("should succeed with github config when all nodes have issue_number", () => {
    const graph = makeGraph(
      { root: makeNode({ id: "root", issue_number: 1 }) },
      { github: { owner: "org", repo: "repo" } },
    );
    const result = lockGraph(graph);
    expect(result.phase).toBe("development");
  });

  it("should succeed without github config regardless of issue_number", () => {
    const graph = makeGraph({
      root: makeNode({ id: "root" }),
    });
    const result = lockGraph(graph);
    expect(result.phase).toBe("development");
  });

  it("should not mutate the original graph", () => {
    const graph = makeGraph({ root: makeNode({ id: "root" }) });
    lockGraph(graph);
    expect(graph.phase).toBe("design");
  });
});

describe("getDescendants", () => {
  it("should return empty array when node has no dependents", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b" }),
    });
    const result = getDescendants(graph, "a");
    expect(result).toEqual([]);
  });

  it("should return direct dependents", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b", depends_on: ["a"] }),
      c: makeNode({ id: "c", depends_on: ["a"] }),
    });
    const result = getDescendants(graph, "a");
    expect(result.sort()).toEqual(["b", "c"]);
  });

  it("should return transitive dependents", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b", depends_on: ["a"] }),
      c: makeNode({ id: "c", depends_on: ["b"] }),
    });
    const result = getDescendants(graph, "a");
    expect(result.sort()).toEqual(["b", "c"]);
  });

  it("should throw when node does not exist", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    expect(() => getDescendants(graph, "missing")).toThrow('Node "missing" not found');
  });
});

describe("unlockSubtree", () => {
  it("should unlock subtree with no assigned nodes", () => {
    const graph = makeGraph(
      {
        a: makeNode({ id: "a" }),
        b: makeNode({ id: "b", depends_on: ["a"] }),
      },
      { phase: "development" },
    );
    const result = unlockSubtree(graph, "a");
    expect(result.phase).toBe("design");
  });

  it("should throw when subtree has assigned node", () => {
    const graph = makeGraph(
      {
        a: makeNode({ id: "a" }),
        b: makeNode({ id: "b", depends_on: ["a"], assignee: "user1" }),
      },
      { phase: "development" },
    );
    expect(() => unlockSubtree(graph, "a")).toThrow("have assignees");
  });

  it("should throw when graph is in design phase", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    expect(() => unlockSubtree(graph, "a")).toThrow("not in development");
  });

  it("should throw when node does not exist", () => {
    const graph = makeGraph(
      { a: makeNode({ id: "a" }) },
      { phase: "development" },
    );
    expect(() => unlockSubtree(graph, "missing")).toThrow('Node "missing" not found');
  });

  it("should not mutate the original graph", () => {
    const graph = makeGraph(
      { a: makeNode({ id: "a" }) },
      { phase: "development" },
    );
    unlockSubtree(graph, "a");
    expect(graph.phase).toBe("development");
  });
});

describe("canUnlockSubtree", () => {
  it("should return canUnlock true when no assigned nodes", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
      b: makeNode({ id: "b", depends_on: ["a"] }),
    });
    const result = canUnlockSubtree(graph, "a");
    expect(result.canUnlock).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("should return canUnlock false with blockers when nodes are assigned", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a", assignee: "user1" }),
      b: makeNode({ id: "b", depends_on: ["a"], assignee: "user2" }),
    });
    const result = canUnlockSubtree(graph, "a");
    expect(result.canUnlock).toBe(false);
    expect(result.blockers.sort()).toEqual(["a", "b"]);
  });

  it("should throw when node does not exist", () => {
    const graph = makeGraph({
      a: makeNode({ id: "a" }),
    });
    expect(() => canUnlockSubtree(graph, "missing")).toThrow('Node "missing" not found');
  });
});
