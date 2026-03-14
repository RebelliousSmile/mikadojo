import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRepo, listRepos } from "../data/repo-registry.js";

export function registerRepoTools(server: McpServer): void {
  server.tool(
    "register_repo",
    "Register an external repository by name and absolute path",
    {
      repoName: z.string().describe("Short name for the repo (e.g. 'meal-planner')"),
      repoPath: z.string().describe("Absolute path to the repo on disk"),
    },
    async ({ repoName, repoPath }) => {
      try {
        const stat = await fs.stat(repoPath);
        if (!stat.isDirectory()) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `"${repoPath}" is not a directory` }) }] };
        }
        await registerRepo(repoName, repoPath);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, repoName, repoPath }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "list_repos",
    "List all registered repositories",
    {},
    async () => {
      try {
        const repos = await listRepos();
        return { content: [{ type: "text", text: JSON.stringify(repos) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "read_repo_directory",
    "List files and subdirectories in a repo directory",
    {
      repoPath: z.string().describe("Absolute path to the repo"),
      directory: z.string().optional().describe("Relative directory path within the repo (default: root)"),
      recursive: z.boolean().optional().describe("List recursively (default: false, max depth 3)"),
    },
    async ({ repoPath, directory, recursive }) => {
      try {
        const targetDir = directory ? path.join(repoPath, directory) : repoPath;
        const stat = await fs.stat(targetDir);
        if (!stat.isDirectory()) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `"${targetDir}" is not a directory` }) }] };
        }

        const entries = await listDir(targetDir, repoPath, recursive ? 3 : 0, 0);
        return { content: [{ type: "text", text: JSON.stringify(entries) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );

  server.tool(
    "read_repo_file",
    "Read the contents of a file in a repository",
    {
      repoPath: z.string().describe("Absolute path to the repo"),
      filePath: z.string().describe("Relative file path within the repo"),
    },
    async ({ repoPath, filePath }) => {
      try {
        const fullPath = path.join(repoPath, filePath);
        // Prevent path traversal
        if (!fullPath.startsWith(repoPath)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }] };
        }
        const content = await fs.readFile(fullPath, "utf-8");
        return { content: [{ type: "text", text: content }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
      }
    }
  );
}

interface DirEntry {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: DirEntry[];
}

async function listDir(
  dirPath: string,
  basePath: string,
  maxDepth: number,
  currentDepth: number
): Promise<DirEntry[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result: DirEntry[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, "/");

    const item: DirEntry = {
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
      path: relativePath,
    };

    if (entry.isDirectory() && currentDepth < maxDepth) {
      item.children = await listDir(fullPath, basePath, maxDepth, currentDepth + 1);
    }

    result.push(item);
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
