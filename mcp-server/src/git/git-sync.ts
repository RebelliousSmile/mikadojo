import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

// Simple async mutex: all git operations run one at a time
let mutexChain = Promise.resolve();

function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const result = mutexChain.then(fn, fn);
  mutexChain = result.then(() => {}, () => {});
  return result;
}

async function git(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd: repoPath });
  return stdout.trim();
}

export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    await git(repoPath, ["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
  }
}

export async function gitPull(repoPath: string): Promise<{ changed: boolean }> {
  return withMutex(async () => {
    const headBefore = await git(repoPath, ["rev-parse", "HEAD"]);
    try {
      await git(repoPath, ["pull", "--ff-only"]);
    } catch {
      // pull may fail if no remote or no upstream — not critical
      return { changed: false };
    }
    const headAfter = await git(repoPath, ["rev-parse", "HEAD"]);
    return { changed: headBefore !== headAfter };
  });
}

export async function gitCommitAndPush(
  repoPath: string,
  files: string[],
  message: string,
): Promise<void> {
  return withMutex(async () => {
    // Stage specific files (ignore errors for missing files)
    try {
      await git(repoPath, ["add", "--", ...files]);
    } catch {
      // files may not exist (e.g. after delete)
    }

    // Check if there are staged changes
    try {
      await git(repoPath, ["diff", "--cached", "--quiet"]);
      // No error = no changes staged, skip
      return;
    } catch {
      // diff --cached --quiet exits non-zero when there are changes — good
    }

    await git(repoPath, ["commit", "-m", message]);

    // Push with retry on rejection
    const backoffs = [500, 1000, 2000];
    for (let attempt = 0; attempt <= backoffs.length; attempt++) {
      try {
        await git(repoPath, ["push"]);
        return;
      } catch {
        if (attempt >= backoffs.length) {
          // Last attempt failed, give up silently (server still works)
          console.warn("git push failed after retries, continuing without sync");
          return;
        }
        await new Promise((r) => setTimeout(r, backoffs[attempt]));
        try {
          await git(repoPath, ["pull", "--rebase"]);
        } catch {
          // rebase failed — give up
          console.warn("git pull --rebase failed, continuing without sync");
          return;
        }
      }
    }
  });
}
