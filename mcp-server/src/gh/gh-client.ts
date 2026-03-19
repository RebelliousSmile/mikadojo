import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export async function isGhAvailable(): Promise<boolean> {
  try {
    await execFile("gh", ["auth", "status"]);
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentUser(): Promise<string> {
  const { stdout } = await execFile("gh", ["api", "user", "--jq", ".login"]);
  return stdout.trim();
}

export async function getUserPermission(
  owner: string,
  repo: string,
  username: string,
): Promise<string> {
  const { stdout } = await execFile("gh", [
    "api",
    `repos/${owner}/${repo}/collaborators/${username}/permission`,
    "--jq",
    ".permission",
  ]);
  return stdout.trim();
}

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[],
): Promise<number> {
  const args = [
    "issue",
    "create",
    "--repo",
    `${owner}/${repo}`,
    "--title",
    title,
  ];
  if (body) {
    args.push("--body", body);
  }
  if (labels && labels.length > 0) {
    for (const label of labels) {
      args.push("--label", label);
    }
  }
  const { stdout } = await execFile("gh", args);
  // gh returns a URL like https://github.com/owner/repo/issues/42
  const match = stdout.trim().match(/\/issues\/(\d+)/);
  if (!match) {
    throw new Error(`Could not parse issue number from gh output: ${stdout}`);
  }
  return parseInt(match[1], 10);
}

export async function closeIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<void> {
  await execFile("gh", [
    "issue",
    "close",
    String(issueNumber),
    "--repo",
    `${owner}/${repo}`,
  ]);
}

export async function assignIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  username: string,
): Promise<void> {
  await execFile("gh", [
    "issue",
    "edit",
    String(issueNumber),
    "--repo",
    `${owner}/${repo}`,
    "--add-assignee",
    username,
  ]);
}

export async function unassignIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  username: string,
): Promise<void> {
  await execFile("gh", [
    "issue",
    "edit",
    String(issueNumber),
    "--repo",
    `${owner}/${repo}`,
    "--remove-assignee",
    username,
  ]);
}
