import { describe, it, expect } from "vitest";
import { Node, NodeStatus, Graph, Phase, GithubConfig } from "./schemas.js";

describe("NodeStatus", () => {
  it.each(["todo", "doing", "in-progress", "blocked", "done"])(
    "should accept valid status '%s'",
    (status) => {
      expect(NodeStatus.parse(status)).toBe(status);
    },
  );

  it("should reject an invalid status", () => {
    expect(() => NodeStatus.parse("invalid")).toThrow();
  });
});

describe("Node", () => {
  const validNode = {
    id: "node-1",
    description: "A task",
    status: "todo" as const,
    depends_on: [],
  };

  it("should accept a minimal valid node", () => {
    const result = Node.parse(validNode);
    expect(result.id).toBe("node-1");
    expect(result.description).toBe("A task");
    expect(result.status).toBe("todo");
    expect(result.depends_on).toEqual([]);
  });

  it("should accept a node with optional fields", () => {
    const result = Node.parse({
      ...validNode,
      notes: "some notes",
      created_at: "2026-01-01",
      updated_at: "2026-01-02",
      actions: [{ type: "test" }],
    });
    expect(result.notes).toBe("some notes");
  });

  it("should reject a node missing required fields", () => {
    expect(() => Node.parse({ id: "x" })).toThrow();
  });

  it("should reject a node with invalid status", () => {
    expect(() => Node.parse({ ...validNode, status: "unknown" })).toThrow();
  });

  it("should accept issue_number and assignee fields", () => {
    const result = Node.parse({
      ...validNode,
      issue_number: 42,
      assignee: "user1",
    });
    expect(result.issue_number).toBe(42);
    expect(result.assignee).toBe("user1");
  });

  it("should accept null issue_number and assignee", () => {
    const result = Node.parse({
      ...validNode,
      issue_number: null,
      assignee: null,
    });
    expect(result.issue_number).toBeNull();
    expect(result.assignee).toBeNull();
  });
});

describe("Graph", () => {
  const validGraph = {
    version: "1.0",
    goal: "Ship feature",
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
    root: "root-node",
    nodes: {
      "root-node": {
        id: "root-node",
        description: "Root",
        status: "todo",
        depends_on: [],
      },
    },
  };

  it("should accept a valid graph", () => {
    const result = Graph.parse(validGraph);
    expect(result.goal).toBe("Ship feature");
    expect(result.root).toBe("root-node");
    expect(Object.keys(result.nodes)).toHaveLength(1);
  });

  it("should reject a graph missing goal", () => {
    const { goal, ...rest } = validGraph;
    expect(() => Graph.parse(rest)).toThrow();
  });

  it("should reject a graph with invalid node inside", () => {
    expect(() =>
      Graph.parse({
        ...validGraph,
        nodes: { bad: { id: "bad" } },
      }),
    ).toThrow();
  });

  it("should default phase to design", () => {
    const result = Graph.parse(validGraph);
    expect(result.phase).toBe("design");
  });

  it("should accept phase field", () => {
    const result = Graph.parse({ ...validGraph, phase: "development" });
    expect(result.phase).toBe("development");
  });

  it("should reject invalid phase", () => {
    expect(() => Graph.parse({ ...validGraph, phase: "invalid" })).toThrow();
  });

  it("should accept github config", () => {
    const result = Graph.parse({
      ...validGraph,
      github: { owner: "user", repo: "repo" },
    });
    expect(result.github).toEqual({ owner: "user", repo: "repo" });
  });

  it("should accept graph without github config", () => {
    const result = Graph.parse(validGraph);
    expect(result.github).toBeUndefined();
  });
});

describe("Phase", () => {
  it.each(["design", "development"])("should accept valid phase '%s'", (phase) => {
    expect(Phase.parse(phase)).toBe(phase);
  });

  it("should reject an invalid phase", () => {
    expect(() => Phase.parse("invalid")).toThrow();
  });
});

describe("GithubConfig", () => {
  it("should accept valid github config", () => {
    const result = GithubConfig.parse({ owner: "user", repo: "repo" });
    expect(result.owner).toBe("user");
    expect(result.repo).toBe("repo");
  });

  it("should reject missing fields", () => {
    expect(() => GithubConfig.parse({ owner: "user" })).toThrow();
  });
});
