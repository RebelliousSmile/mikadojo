import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { MIKADO_DIR } from "../config.js";

export interface LegacyNode {
  id: string;
  description: string;
  status: string;
  depends_on?: string[];
  notes?: string;
  actions?: unknown[];
  issue_number?: number | null;
  assignee?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyGraph {
  version: string;
  goal: string;
  created_at: string;
  updated_at: string;
  nodes: Record<string, LegacyNode>;
  root: string;
}

export async function migrate(dir: string = MIKADO_DIR): Promise<void> {
  const entries = await fs.readdir(dir);
  const jsonFiles = entries.filter((f) => f.endsWith(".json"));

  if (jsonFiles.length === 0) {
    console.log("No JSON files found to migrate.");
    return;
  }

  for (const file of jsonFiles) {
    const name = file.replace(/\.json$/, "");
    const jsonPath = path.join(dir, file);
    const dirPath = path.join(dir, name);

    console.log(`Migrating ${file} -> ${name}/`);

    const raw = await fs.readFile(jsonPath, "utf-8");
    const parsed = JSON.parse(raw);
    const graph: LegacyGraph = parsed.mikado_graph ?? parsed;

    // Create directory
    await fs.mkdir(dirPath, { recursive: true });

    // Write _meta.yaml
    const meta = {
      version: graph.version,
      goal: graph.goal,
      root: graph.root,
      phase: "design",
      created_at: graph.created_at,
      updated_at: graph.updated_at,
    };
    await fs.writeFile(
      path.join(dirPath, "_meta.yaml"),
      yaml.dump(meta, { lineWidth: -1 }),
      "utf-8",
    );

    // Write node files
    for (const [nodeId, node] of Object.entries(graph.nodes)) {
      const { id: _, actions: _a, ...nodeWithoutId } = node;
      // Ensure depends_on is always present (default to empty array if missing)
      const nodeData = { ...nodeWithoutId, depends_on: nodeWithoutId.depends_on ?? [] };
      await fs.writeFile(
        path.join(dirPath, `${nodeId}.yaml`),
        yaml.dump(nodeData, { lineWidth: -1 }),
        "utf-8",
      );
    }

    // Backup original JSON
    const backupPath = `${jsonPath}.bak`;
    await fs.rename(jsonPath, backupPath);
    console.log(`  Backed up to ${file}.bak`);
  }

  console.log("Migration complete.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
