import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MCP_PORT = 3100;
export const MIKADO_DIR = path.resolve(__dirname, "../../mikado");
export const STATUS_OPTIONS = ["todo", "doing", "in-progress", "blocked", "done"] as const;
export const REPO_REGISTRY_PATH = path.resolve(__dirname, "../../mcp-server/repos.json");
export const ACTION_TEMPLATES_DIR = path.resolve(__dirname, "../../mcp-server/action-templates");
