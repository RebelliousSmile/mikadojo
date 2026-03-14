import { execFile } from "node:child_process";

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runShell(command: string, cwd: string): Promise<ShellResult> {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd" : "/bin/sh";
    const shellFlag = isWindows ? "/c" : "-c";

    execFile(shell, [shellFlag, command], { cwd, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: error ? (error as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0,
      });
    });
  });
}
