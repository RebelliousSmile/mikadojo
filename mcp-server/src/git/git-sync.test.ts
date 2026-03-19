import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitCommitAndPush, gitPull, isGitRepo } from "./git-sync.js";

function gitInit(dir: string): void {
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-sync-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("isGitRepo", () => {
  it("returns true for a git repo", async () => {
    gitInit(tmpDir);
    expect(await isGitRepo(tmpDir)).toBe(true);
  });

  it("returns false for a non-git directory", async () => {
    expect(await isGitRepo(tmpDir)).toBe(false);
  });
});

describe("gitCommitAndPush", () => {
  let bareDir: string;
  let cloneDir: string;

  beforeEach(() => {
    // Create a bare remote repo
    bareDir = path.join(tmpDir, "remote.git");
    fs.mkdirSync(bareDir);
    execFileSync("git", ["init", "--bare", "--initial-branch=main"], { cwd: bareDir });

    // Clone it
    cloneDir = path.join(tmpDir, "clone");
    execFileSync("git", ["clone", bareDir, cloneDir]);
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: cloneDir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: cloneDir });
  });

  it("commits and pushes a new file", async () => {
    fs.writeFileSync(path.join(cloneDir, "file.txt"), "hello");
    await gitCommitAndPush(cloneDir, ["file.txt"], "add file");

    const log = execFileSync("git", ["log", "--oneline"], { cwd: cloneDir }).toString();
    expect(log).toContain("add file");

    // Verify it was pushed
    const remoteLog = execFileSync("git", ["log", "--oneline"], { cwd: bareDir }).toString();
    expect(remoteLog).toContain("add file");
  });

  it("skips silently when nothing to commit", async () => {
    // Need at least one commit first
    fs.writeFileSync(path.join(cloneDir, "init.txt"), "init");
    execFileSync("git", ["add", "init.txt"], { cwd: cloneDir });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: cloneDir });

    // This should not throw
    await gitCommitAndPush(cloneDir, ["nonexistent.txt"], "no changes");
  });
});

describe("gitPull", () => {
  let bareDir: string;
  let clone1Dir: string;
  let clone2Dir: string;

  beforeEach(() => {
    bareDir = path.join(tmpDir, "remote.git");
    fs.mkdirSync(bareDir);
    execFileSync("git", ["init", "--bare", "--initial-branch=main"], { cwd: bareDir });

    clone1Dir = path.join(tmpDir, "clone1");
    execFileSync("git", ["clone", bareDir, clone1Dir]);
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: clone1Dir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: clone1Dir });

    clone2Dir = path.join(tmpDir, "clone2");
    execFileSync("git", ["clone", bareDir, clone2Dir]);
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: clone2Dir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: clone2Dir });

    // Make initial commit so HEAD exists
    fs.writeFileSync(path.join(clone1Dir, "init.txt"), "init");
    execFileSync("git", ["add", "init.txt"], { cwd: clone1Dir });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: clone1Dir });
    execFileSync("git", ["push"], { cwd: clone1Dir });
    execFileSync("git", ["pull"], { cwd: clone2Dir });
  });

  it("detects changes after pull", async () => {
    // Push from clone1
    fs.writeFileSync(path.join(clone1Dir, "new.txt"), "data");
    execFileSync("git", ["add", "new.txt"], { cwd: clone1Dir });
    execFileSync("git", ["commit", "-m", "new file"], { cwd: clone1Dir });
    execFileSync("git", ["push"], { cwd: clone1Dir });

    // Pull from clone2
    const result = await gitPull(clone2Dir);
    expect(result.changed).toBe(true);
  });

  it("returns changed=false when no new commits", async () => {
    const result = await gitPull(clone2Dir);
    expect(result.changed).toBe(false);
  });
});

describe("mutex serialization", () => {
  it("serializes concurrent git operations", async () => {
    const bareDir = path.join(tmpDir, "remote.git");
    fs.mkdirSync(bareDir);
    execFileSync("git", ["init", "--bare", "--initial-branch=main"], { cwd: bareDir });

    const cloneDir = path.join(tmpDir, "clone");
    execFileSync("git", ["clone", bareDir, cloneDir]);
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: cloneDir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: cloneDir });

    // Create two files and commit them concurrently
    fs.writeFileSync(path.join(cloneDir, "a.txt"), "a");
    fs.writeFileSync(path.join(cloneDir, "b.txt"), "b");

    const p1 = gitCommitAndPush(cloneDir, ["a.txt"], "add a");
    const p2 = gitCommitAndPush(cloneDir, ["b.txt"], "add b");

    await Promise.all([p1, p2]);

    const log = execFileSync("git", ["log", "--oneline"], { cwd: cloneDir }).toString();
    expect(log).toContain("add a");
    expect(log).toContain("add b");
  });
});
