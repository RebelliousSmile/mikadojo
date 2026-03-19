import { describe, it, expect, vi, beforeEach } from "vitest";
import * as childProcess from "node:child_process";

vi.mock("node:child_process", () => {
  const execFile = vi.fn();
  return { execFile };
});

const mockedExecFile = vi.mocked(childProcess.execFile);

function mockExecResult(stdout: string, stderr = ""): void {
  mockedExecFile.mockImplementation(
    ((_cmd: unknown, _args: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
      cb(null, { stdout, stderr });
    }) as typeof childProcess.execFile,
  );
}

function mockExecError(message: string): void {
  mockedExecFile.mockImplementation(
    ((_cmd: unknown, _args: unknown, cb: (err: Error | null) => void) => {
      cb(new Error(message));
    }) as typeof childProcess.execFile,
  );
}

// Dynamic import to get fresh module after mock setup
async function loadClient() {
  return await import("./gh-client.js");
}

describe("gh-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isGhAvailable", () => {
    it("returns true when gh auth status succeeds", async () => {
      mockExecResult("Logged in");
      const { isGhAvailable } = await loadClient();
      const result = await isGhAvailable();
      expect(result).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledWith(
        "gh",
        ["auth", "status"],
        expect.any(Function),
      );
    });

    it("returns false when gh auth status fails", async () => {
      mockExecError("not logged in");
      const { isGhAvailable } = await loadClient();
      const result = await isGhAvailable();
      expect(result).toBe(false);
    });
  });

  describe("getCurrentUser", () => {
    it("parses the username from gh output", async () => {
      mockExecResult("octocat\n");
      const { getCurrentUser } = await loadClient();
      const user = await getCurrentUser();
      expect(user).toBe("octocat");
      expect(mockedExecFile).toHaveBeenCalledWith(
        "gh",
        ["api", "user", "--jq", ".login"],
        expect.any(Function),
      );
    });

    it("throws when gh is not available", async () => {
      mockExecError("gh not found");
      const { getCurrentUser } = await loadClient();
      await expect(getCurrentUser()).rejects.toThrow("gh not found");
    });
  });

  describe("getUserPermission", () => {
    it("returns the permission level", async () => {
      mockExecResult("write\n");
      const { getUserPermission } = await loadClient();
      const perm = await getUserPermission("owner", "repo", "user1");
      expect(perm).toBe("write");
    });
  });

  describe("createIssue", () => {
    it("parses issue number from URL output", async () => {
      mockExecResult("https://github.com/owner/repo/issues/42\n");
      const { createIssue } = await loadClient();
      const num = await createIssue("owner", "repo", "My title");
      expect(num).toBe(42);
    });

    it("passes labels as separate --label flags", async () => {
      mockExecResult("https://github.com/owner/repo/issues/7\n");
      const { createIssue } = await loadClient();
      await createIssue("owner", "repo", "Title", "Body", ["bug", "urgent"]);
      expect(mockedExecFile).toHaveBeenCalledWith(
        "gh",
        [
          "issue", "create",
          "--repo", "owner/repo",
          "--title", "Title",
          "--body", "Body",
          "--label", "bug",
          "--label", "urgent",
        ],
        expect.any(Function),
      );
    });

    it("throws when output cannot be parsed", async () => {
      mockExecResult("unexpected output");
      const { createIssue } = await loadClient();
      await expect(createIssue("o", "r", "t")).rejects.toThrow("Could not parse issue number");
    });
  });

  describe("closeIssue", () => {
    it("calls gh issue close with correct args", async () => {
      mockExecResult("");
      const { closeIssue } = await loadClient();
      await closeIssue("owner", "repo", 10);
      expect(mockedExecFile).toHaveBeenCalledWith(
        "gh",
        ["issue", "close", "10", "--repo", "owner/repo"],
        expect.any(Function),
      );
    });
  });

  describe("assignIssue", () => {
    it("calls gh issue edit with --add-assignee", async () => {
      mockExecResult("");
      const { assignIssue } = await loadClient();
      await assignIssue("owner", "repo", 5, "alice");
      expect(mockedExecFile).toHaveBeenCalledWith(
        "gh",
        ["issue", "edit", "5", "--repo", "owner/repo", "--add-assignee", "alice"],
        expect.any(Function),
      );
    });
  });

  describe("unassignIssue", () => {
    it("calls gh issue edit with --remove-assignee", async () => {
      mockExecResult("");
      const { unassignIssue } = await loadClient();
      await unassignIssue("owner", "repo", 5, "bob");
      expect(mockedExecFile).toHaveBeenCalledWith(
        "gh",
        ["issue", "edit", "5", "--repo", "owner/repo", "--remove-assignee", "bob"],
        expect.any(Function),
      );
    });
  });
});
