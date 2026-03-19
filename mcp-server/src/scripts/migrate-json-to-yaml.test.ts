import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import yaml from "js-yaml";
import { migrate } from "./migrate-json-to-yaml.js";

const RECIPE_PLANNING_JSON = {
  mikado_graph: {
    version: "1.0",
    goal: "Recipe Planning Workflow",
    created_at: "2026-03-19T16:55:23.284Z",
    updated_at: "2026-03-19T16:59:31.975Z",
    root: "start-planning",
    nodes: {
      "start-planning": {
        id: "start-planning",
        description: "Start planning a new recipe.",
        status: "todo",
        depends_on: [],
        notes: "",
        created_at: "2026-03-19T16:55:23.284Z",
        updated_at: "2026-03-19T16:55:23.284Z",
      },
      "define-dietary-requirements": {
        id: "define-dietary-requirements",
        description: "Identify dietary restrictions and preferences for the meal plan.",
        status: "todo",
        depends_on: ["start-planning"],
        created_at: "2026-03-19T16:59:31.946Z",
        updated_at: "2026-03-19T16:59:31.946Z",
      },
      "set-meal-schedule": {
        id: "set-meal-schedule",
        description: "Determine the schedule and number of meals to plan for.",
        status: "todo",
        depends_on: ["start-planning"],
        created_at: "2026-03-19T16:59:31.975Z",
        updated_at: "2026-03-19T16:59:31.975Z",
      },
    },
  },
};

const NODE_WITH_ACTIONS_JSON = {
  mikado_graph: {
    version: "1.0",
    goal: "Goal with actions",
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-01T00:00:00.000Z",
    root: "root-node",
    nodes: {
      "root-node": {
        id: "root-node",
        description: "Root node with actions that should be excluded.",
        status: "todo",
        depends_on: ["child-node"],
        actions: [{ id: "act1", type: "manual", label: "Do something" }],
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
      "child-node": {
        id: "child-node",
        description: "Child node without depends_on field.",
        status: "done",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    },
  },
};

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mikado-migrate-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("migrate-json-to-yaml", () => {
  it("preserves depends_on for all nodes (empty and non-empty)", async () => {
    await fs.writeFile(
      path.join(tmpDir, "recipe-planning.json"),
      JSON.stringify(RECIPE_PLANNING_JSON),
      "utf-8",
    );

    await migrate(tmpDir);

    const dirPath = path.join(tmpDir, "recipe-planning");

    const startPlanning = yaml.load(
      await fs.readFile(path.join(dirPath, "start-planning.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(startPlanning.depends_on).toEqual([]);

    const dietary = yaml.load(
      await fs.readFile(path.join(dirPath, "define-dietary-requirements.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(dietary.depends_on).toEqual(["start-planning"]);

    const schedule = yaml.load(
      await fs.readFile(path.join(dirPath, "set-meal-schedule.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(schedule.depends_on).toEqual(["start-planning"]);
  });

  it("excludes id and actions fields from node YAML", async () => {
    await fs.writeFile(
      path.join(tmpDir, "graph-with-actions.json"),
      JSON.stringify(NODE_WITH_ACTIONS_JSON),
      "utf-8",
    );

    await migrate(tmpDir);

    const rootNode = yaml.load(
      await fs.readFile(
        path.join(tmpDir, "graph-with-actions", "root-node.yaml"),
        "utf-8",
      ),
    ) as Record<string, unknown>;

    expect(rootNode.id).toBeUndefined();
    expect(rootNode.actions).toBeUndefined();
    expect(rootNode.depends_on).toEqual(["child-node"]);
  });

  it("defaults depends_on to empty array when field is absent in source", async () => {
    await fs.writeFile(
      path.join(tmpDir, "graph-with-actions.json"),
      JSON.stringify(NODE_WITH_ACTIONS_JSON),
      "utf-8",
    );

    await migrate(tmpDir);

    const childNode = yaml.load(
      await fs.readFile(
        path.join(tmpDir, "graph-with-actions", "child-node.yaml"),
        "utf-8",
      ),
    ) as Record<string, unknown>;

    expect(childNode.depends_on).toEqual([]);
  });

  it("writes _meta.yaml with correct graph metadata", async () => {
    await fs.writeFile(
      path.join(tmpDir, "recipe-planning.json"),
      JSON.stringify(RECIPE_PLANNING_JSON),
      "utf-8",
    );

    await migrate(tmpDir);

    const meta = yaml.load(
      await fs.readFile(path.join(tmpDir, "recipe-planning", "_meta.yaml"), "utf-8"),
    ) as Record<string, unknown>;

    expect(meta.goal).toBe("Recipe Planning Workflow");
    expect(meta.root).toBe("start-planning");
    expect(meta.version).toBe("1.0");
    expect(meta.phase).toBe("design");
  });

  it("backs up original JSON file after migration", async () => {
    const jsonPath = path.join(tmpDir, "recipe-planning.json");
    await fs.writeFile(jsonPath, JSON.stringify(RECIPE_PLANNING_JSON), "utf-8");

    await migrate(tmpDir);

    await expect(fs.access(`${jsonPath}.bak`)).resolves.toBeUndefined();
    await expect(fs.access(jsonPath)).rejects.toThrow();
  });

  it("does nothing when no JSON files are present", async () => {
    await migrate(tmpDir);

    const entries = await fs.readdir(tmpDir);
    expect(entries).toHaveLength(0);
  });
});
