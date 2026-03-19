import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { MIKADO_DIR } from "../config.js";
import type { Graph, Node } from "../schemas.js";

const GRAPH_NAME_REGEX = /^[a-z0-9\-_]+$/i;

function validateGraphName(name: string): void {
  if (!GRAPH_NAME_REGEX.test(name)) {
    throw new Error(`Invalid graph name "${name}". Must match /^[a-z0-9\\-_]+$/i`);
  }
}

function graphDir(name: string): string {
  return path.join(MIKADO_DIR, name);
}

function metaPath(name: string): string {
  return path.join(graphDir(name), "_meta.yaml");
}

function legacyJsonPath(name: string): string {
  return path.join(MIKADO_DIR, `${name}.json`);
}

function nodeFilePath(graphName: string, nodeId: string): string {
  return path.join(graphDir(graphName), `${nodeId}.yaml`);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function listGraphs(): Promise<string[]> {
  const entries = await fs.readdir(MIKADO_DIR);
  const names: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(MIKADO_DIR, entry);
    if (await isDirectory(fullPath)) {
      const meta = path.join(fullPath, "_meta.yaml");
      if (await pathExists(meta)) {
        names.push(entry);
      }
    } else if (entry.endsWith(".json")) {
      names.push(entry.replace(/\.json$/, ""));
    }
  }

  return [...new Set(names)];
}

async function readGraphYaml(name: string): Promise<Graph> {
  const metaRaw = await fs.readFile(metaPath(name), "utf-8");
  const meta = yaml.load(metaRaw) as Record<string, unknown>;

  const dir = graphDir(name);
  const files = await fs.readdir(dir);
  const nodeFiles = files.filter(
    (f) => f.endsWith(".yaml") && f !== "_meta.yaml",
  );

  const nodes: Record<string, Node> = {};
  for (const file of nodeFiles) {
    const nodeId = file.replace(/\.yaml$/, "");
    const raw = await fs.readFile(path.join(dir, file), "utf-8");
    const nodeData = yaml.load(raw) as Record<string, unknown>;
    nodes[nodeId] = {
      id: nodeId,
      ...nodeData,
    } as Node;
  }

  return {
    version: meta.version as string,
    goal: meta.goal as string,
    root: meta.root as string,
    phase: meta.phase as Graph["phase"],
    github: meta.github as Graph["github"],
    created_at: meta.created_at as string,
    updated_at: meta.updated_at as string,
    nodes,
  };
}

async function readGraphJson(name: string): Promise<Graph> {
  const raw = await fs.readFile(legacyJsonPath(name), "utf-8");
  const parsed = JSON.parse(raw);
  if (parsed.mikado_graph) {
    return parsed.mikado_graph as Graph;
  }
  return parsed as Graph;
}

export async function readGraph(name: string): Promise<Graph> {
  validateGraphName(name);

  const dir = graphDir(name);
  if (await isDirectory(dir) && await pathExists(metaPath(name))) {
    return readGraphYaml(name);
  }

  return readGraphJson(name);
}

export async function writeGraph(name: string, graph: Graph): Promise<void> {
  validateGraphName(name);

  const dir = graphDir(name);
  await fs.mkdir(dir, { recursive: true });

  const meta: Record<string, unknown> = {
    version: graph.version,
    goal: graph.goal,
    root: graph.root,
    phase: graph.phase ?? "design",
    created_at: graph.created_at,
    updated_at: graph.updated_at,
  };
  if (graph.github) {
    meta.github = graph.github;
  }

  await fs.writeFile(metaPath(name), yaml.dump(meta, { lineWidth: -1 }), "utf-8");

  const existingFiles = await fs.readdir(dir);
  const existingNodeFiles = new Set(
    existingFiles.filter((f) => f.endsWith(".yaml") && f !== "_meta.yaml"),
  );

  const currentNodeFiles = new Set<string>();
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    const filePath = nodeFilePath(name, nodeId);
    const { id: _, ...nodeWithoutId } = node;
    await fs.writeFile(filePath, yaml.dump(nodeWithoutId, { lineWidth: -1 }), "utf-8");
    currentNodeFiles.add(`${nodeId}.yaml`);
  }

  for (const file of existingNodeFiles) {
    if (!currentNodeFiles.has(file)) {
      await fs.unlink(path.join(dir, file));
    }
  }
}

export async function deleteGraph(name: string): Promise<void> {
  validateGraphName(name);

  const dir = graphDir(name);
  if (await isDirectory(dir)) {
    await fs.rm(dir, { recursive: true, force: true });
  }

  const jsonPath = legacyJsonPath(name);
  if (await pathExists(jsonPath)) {
    await fs.unlink(jsonPath);
  }
}

export async function graphExists(name: string): Promise<boolean> {
  validateGraphName(name);

  const dir = graphDir(name);
  if (await isDirectory(dir) && await pathExists(metaPath(name))) {
    return true;
  }

  return pathExists(legacyJsonPath(name));
}

export async function writeNodeFile(
  graphName: string,
  nodeId: string,
  nodeData: Node,
): Promise<void> {
  validateGraphName(graphName);
  const filePath = nodeFilePath(graphName, nodeId);
  const { id: _, ...nodeWithoutId } = nodeData;
  await fs.writeFile(filePath, yaml.dump(nodeWithoutId, { lineWidth: -1 }), "utf-8");
}

export async function deleteNodeFile(
  graphName: string,
  nodeId: string,
): Promise<void> {
  validateGraphName(graphName);
  const filePath = nodeFilePath(graphName, nodeId);
  await fs.unlink(filePath);
}
