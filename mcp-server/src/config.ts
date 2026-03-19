import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MCP_PORT = Number(process.env.PORT) || 3100;
export const PROJECT_ROOT = path.resolve(__dirname, "../..");
export const MIKADO_DIR = process.env.MIKADO_DIR
  ? path.resolve(process.env.MIKADO_DIR)
  : path.resolve(__dirname, "../../mikado");
export const STATUS_OPTIONS = ["todo", "doing", "in-progress", "blocked", "done"] as const;
export const REPO_REGISTRY_PATH = path.resolve(__dirname, "../../mcp-server/repos.json");
