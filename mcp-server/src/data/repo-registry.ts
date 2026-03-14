import fs from "node:fs/promises";
import { REPO_REGISTRY_PATH } from "../config.js";

interface RepoRegistry {
  [name: string]: string; // name → absolute path
}

async function readRegistry(): Promise<RepoRegistry> {
  try {
    const raw = await fs.readFile(REPO_REGISTRY_PATH, "utf-8");
    return JSON.parse(raw) as RepoRegistry;
  } catch {
    return {};
  }
}

async function writeRegistry(registry: RepoRegistry): Promise<void> {
  await fs.writeFile(REPO_REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

export async function registerRepo(name: string, repoPath: string): Promise<void> {
  const registry = await readRegistry();
  registry[name] = repoPath;
  await writeRegistry(registry);
}

export async function listRepos(): Promise<RepoRegistry> {
  return readRegistry();
}

export async function getRepoPath(name: string): Promise<string | undefined> {
  const registry = await readRegistry();
  return registry[name];
}

export async function removeRepo(name: string): Promise<boolean> {
  const registry = await readRegistry();
  if (!(name in registry)) return false;
  delete registry[name];
  await writeRegistry(registry);
  return true;
}
