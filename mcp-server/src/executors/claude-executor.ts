import { runShell, type ShellResult } from "./shell-executor.js";

export interface ClaudeConfig {
  prompt: string;
  cwd: string;
  allowedTools?: string[];
}

export async function runClaude(config: ClaudeConfig): Promise<ShellResult> {
  const toolsArg = config.allowedTools?.length
    ? ` --allowedTools ${config.allowedTools.map((t) => `"${t}"`).join(",")}`
    : "";
  const prompt = config.prompt.replace(/"/g, '\\"');
  const command = `claude --print -p "${prompt}"${toolsArg}`;
  return runShell(command, config.cwd);
}
