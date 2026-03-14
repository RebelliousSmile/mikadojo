import { runShell, type ShellResult } from "./shell-executor.js";

export async function runGh(command: string, cwd: string): Promise<ShellResult> {
  return runShell(`gh ${command}`, cwd);
}
