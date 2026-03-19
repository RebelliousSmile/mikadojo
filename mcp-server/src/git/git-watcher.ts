import { watch, type FSWatcher } from "chokidar";
import { gitPull } from "./git-sync.js";

export interface GitWatcherOptions {
  repoPath: string;
  mikadoDir: string;
  pullIntervalMs: number;
  onExternalChange: () => void;
}

let watcher: FSWatcher | undefined;
let pullInterval: ReturnType<typeof setInterval> | undefined;
let localWriteInProgress = false;

export function setLocalWriteInProgress(value: boolean): void {
  localWriteInProgress = value;
}

export function startGitWatcher(options: GitWatcherOptions): void {
  const { repoPath, mikadoDir, pullIntervalMs, onExternalChange } = options;

  // File watcher — only fires for external changes
  watcher = watch(mikadoDir, { ignoreInitial: true });
  watcher.on("all", (_event, filePath) => {
    if (localWriteInProgress) return;
    if (filePath.endsWith(".json") || filePath.endsWith(".yaml")) {
      onExternalChange();
    }
  });

  // Periodic git pull
  pullInterval = setInterval(async () => {
    try {
      const { changed } = await gitPull(repoPath);
      if (changed) {
        onExternalChange();
      }
    } catch {
      // pull failed — not critical
    }
  }, pullIntervalMs);
}

export function stopGitWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = undefined;
  }
  if (pullInterval) {
    clearInterval(pullInterval);
    pullInterval = undefined;
  }
}
