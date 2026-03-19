import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { MIKADO_DIR } from "../config.js";

interface LegacyNode {
  id: string;
  description: string;
  status: string;
  depends_on: string[];
  notes?: string;
  actions?: unknown[];
  issue_number?: number | null;
  assignee?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface LegacyGraph {
  version: string;
  goal: string;
  created_at: string;
  updated_at: string;
  nodes: Record<string, LegacyNode>;
  root: string;
}

async function migrate(): Promise<void> {
  const entries = await fs.readdir(MIKADO_DIR);
  const jsonFiles = entries.filter((f) => f.endsWith(".json"));

  if (jsonFiles.length === 0) {
    console.log("No JSON files found to migrate.");
    return;
  }

  for (const file of jsonFiles) {
    const name = file.replace(/\.json$/, "");
    const jsonPath = path.join(MIKADO_DIR, file);
    const dirPath = path.join(MIKADO_DIR, name);

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
      await fs.writeFile(
        path.join(dirPath, `${nodeId}.yaml`),
        yaml.dump(
          { depends_on: [], ...nodeWithoutId },
          { lineWidth: -1 },
        ),
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

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
