import fs from "node:fs/promises";
import path from "node:path";
import { MIKADO_DIR } from "../config.js";
import type { Graph } from "../schemas.js";

const GRAPH_NAME_REGEX = /^[a-z0-9\-_]+$/i;

function validateGraphName(name: string): void {
  if (!GRAPH_NAME_REGEX.test(name)) {
    throw new Error(`Invalid graph name "${name}". Must match /^[a-z0-9\\-_]+$/i`);
  }
}

function graphPath(name: string): string {
  return path.join(MIKADO_DIR, `${name}.json`);
}

export async function listGraphs(): Promise<string[]> {
  const entries = await fs.readdir(MIKADO_DIR);
  return entries
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export async function readGraph(name: string): Promise<Graph> {
  validateGraphName(name);
  const raw = await fs.readFile(graphPath(name), "utf-8");
  const parsed = JSON.parse(raw);
  if (parsed.mikado_graph) {
    return parsed.mikado_graph as Graph;
  }
  return parsed as Graph;
}

export async function writeGraph(name: string, graph: Graph): Promise<void> {
  validateGraphName(name);
  const wrapped = { mikado_graph: graph };
  await fs.writeFile(graphPath(name), JSON.stringify(wrapped, null, 2), "utf-8");
}

export async function deleteGraph(name: string): Promise<void> {
  validateGraphName(name);
  await fs.unlink(graphPath(name));
}

export async function graphExists(name: string): Promise<boolean> {
  validateGraphName(name);
  try {
    await fs.access(graphPath(name));
    return true;
  } catch {
    return false;
  }
}
