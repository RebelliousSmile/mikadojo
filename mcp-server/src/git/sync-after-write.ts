import { PROJECT_ROOT } from "../config.js";
import { isGitRepo, gitCommitAndPush } from "./git-sync.js";
import { setLocalWriteInProgress } from "./git-watcher.js";

let gitAvailable: boolean | undefined;

async function checkGitAvailable(): Promise<boolean> {
  if (gitAvailable === undefined) {
    gitAvailable = await isGitRepo(PROJECT_ROOT);
  }
  return gitAvailable;
}

export async function syncAfterWrite(files: string[], message: string): Promise<void> {
  if (!(await checkGitAvailable())) return;

  setLocalWriteInProgress(true);
  try {
    await gitCommitAndPush(PROJECT_ROOT, files, message);
  } catch {
    console.warn("git sync failed, continuing without sync");
  } finally {
    setLocalWriteInProgress(false);
  }
}
