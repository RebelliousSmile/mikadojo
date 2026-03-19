import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Graph } from "../schemas.js";

// Mock config to control MIKADO_DIR
vi.mock("../config.js", () => ({
  MIKADO_DIR: "/fake/mikado",
}));

// Mock node:fs/promises
vi.mock("node:fs/promises");

// Mock js-yaml
vi.mock("js-yaml", () => ({
  default: {
    load: (str: string) => JSON.parse(str),
    dump: (obj: unknown) => JSON.stringify(obj),
  },
}));

import {
  listGraphs,
  readGraph,
  writeGraph,
  deleteGraph,
  graphExists,
} from "./graph-store.js";
import fs from "node:fs/promises";

const mockedFs = vi.mocked(fs);

const sampleGraph: Graph = {
  version: "1.0",
  goal: "Test goal",
  phase: "design",
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
  root: "root",
  nodes: {
    root: {
      id: "root",
      description: "Root node",
      status: "todo",
      depends_on: [],
    },
  },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listGraphs", () => {
  it("should return graph names from directories with _meta.yaml", async () => {
    mockedFs.readdir.mockResolvedValue(["alpha", "beta", "readme.txt"] as any);
    // stat calls for each entry
    mockedFs.stat.mockImplementation(async (p) => {
      const name = String(p);
      if (name.includes("alpha") || name.includes("beta")) {
        return { isDirectory: () => true } as any;
      }
      return { isDirectory: () => false } as any;
    });
    // access calls for _meta.yaml
    mockedFs.access.mockImplementation(async (p) => {
      const name = String(p);
      if (name.includes("_meta.yaml")) {
        return;
      }
      throw new Error("ENOENT");
    });
    const result = await listGraphs();
    expect(result).toEqual(["alpha", "beta"]);
  });

  it("should return graph names from legacy JSON files", async () => {
    mockedFs.readdir.mockResolvedValue(["old-graph.json"] as any);
    mockedFs.stat.mockRejectedValue(new Error("not a dir"));
    const result = await listGraphs();
    expect(result).toEqual(["old-graph"]);
  });

  it("should return empty array when no graphs found", async () => {
    mockedFs.readdir.mockResolvedValue([] as any);
    const result = await listGraphs();
    expect(result).toEqual([]);
  });
});

describe("readGraph", () => {
  it("should read YAML format when directory exists", async () => {
    // isDirectory check
    mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    // access check for _meta.yaml
    mockedFs.access.mockResolvedValue(undefined);
    // readFile for _meta.yaml
    const metaData = JSON.stringify({
      version: "1.0",
      goal: "Test goal",
      root: "root",
      phase: "design",
      created_at: "2026-01-01",
      updated_at: "2026-01-02",
    });
    const nodeData = JSON.stringify({
      description: "Root node",
      status: "todo",
      depends_on: [],
    });
    mockedFs.readFile.mockImplementation(async (p) => {
      const name = String(p);
      if (name.includes("_meta.yaml")) return metaData;
      return nodeData;
    });
    mockedFs.readdir.mockResolvedValue(["_meta.yaml", "root.yaml"] as any);

    const result = await readGraph("test");
    expect(result.goal).toBe("Test goal");
    expect(result.nodes.root.id).toBe("root");
    expect(result.nodes.root.description).toBe("Root node");
  });

  it("should fall back to JSON format when directory does not exist", async () => {
    mockedFs.stat.mockRejectedValue(new Error("ENOENT"));
    mockedFs.readFile.mockResolvedValue(
      JSON.stringify({ mikado_graph: sampleGraph }),
    );
    const result = await readGraph("test");
    expect(result).toEqual(sampleGraph);
  });

  it("should reject invalid graph names", async () => {
    await expect(readGraph("bad name!")).rejects.toThrow("Invalid graph name");
  });
});

describe("writeGraph", () => {
  it("should create directory and write YAML files", async () => {
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.readdir.mockResolvedValue([] as any);
    await writeGraph("test", sampleGraph);
    // mkdir called
    expect(mockedFs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining("test"),
      { recursive: true },
    );
    // writeFile called for _meta.yaml and root.yaml
    expect(mockedFs.writeFile).toHaveBeenCalledTimes(2);
  });

  it("should clean up removed node files", async () => {
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.readdir.mockResolvedValue(["_meta.yaml", "root.yaml", "old-node.yaml"] as any);
    mockedFs.unlink.mockResolvedValue(undefined);
    await writeGraph("test", sampleGraph);
    // Should delete old-node.yaml
    expect(mockedFs.unlink).toHaveBeenCalledWith(
      expect.stringContaining("old-node.yaml"),
    );
  });

  it("should reject invalid graph names", async () => {
    await expect(writeGraph("bad/name", sampleGraph)).rejects.toThrow(
      "Invalid graph name",
    );
  });
});

describe("deleteGraph", () => {
  it("should remove the graph directory", async () => {
    mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockedFs.rm.mockResolvedValue(undefined);
    mockedFs.access.mockRejectedValue(new Error("ENOENT"));
    await deleteGraph("test");
    expect(mockedFs.rm).toHaveBeenCalledWith(
      expect.stringContaining("test"),
      { recursive: true, force: true },
    );
  });

  it("should also remove legacy JSON if present", async () => {
    mockedFs.stat.mockRejectedValue(new Error("not a dir"));
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.unlink.mockResolvedValue(undefined);
    await deleteGraph("test");
    expect(mockedFs.unlink).toHaveBeenCalledWith(
      expect.stringContaining("test.json"),
    );
  });

  it("should reject invalid graph names", async () => {
    await expect(deleteGraph("../escape")).rejects.toThrow(
      "Invalid graph name",
    );
  });
});

describe("graphExists", () => {
  it("should return true when YAML directory exists", async () => {
    mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockedFs.access.mockResolvedValue(undefined);
    const result = await graphExists("test");
    expect(result).toBe(true);
  });

  it("should return true when legacy JSON exists", async () => {
    mockedFs.stat.mockRejectedValue(new Error("not a dir"));
    mockedFs.access.mockResolvedValue(undefined);
    const result = await graphExists("test");
    expect(result).toBe(true);
  });

  it("should return false when neither exists", async () => {
    mockedFs.stat.mockRejectedValue(new Error("ENOENT"));
    mockedFs.access.mockRejectedValue(new Error("ENOENT"));
    const result = await graphExists("test");
    expect(result).toBe(false);
  });

  it("should reject invalid graph names", async () => {
    await expect(graphExists("has spaces")).rejects.toThrow(
      "Invalid graph name",
    );
  });
});
