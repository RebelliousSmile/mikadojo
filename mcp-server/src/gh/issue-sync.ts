import type { Graph } from "../schemas.js";
import {
  isGhAvailable,
  createIssue,
  closeIssue,
  assignIssue,
  unassignIssue,
} from "./gh-client.js";

function getGithubConfig(graph: Graph): { owner: string; repo: string } | null {
  if (!graph.github) return null;
  return { owner: graph.github.owner, repo: graph.github.repo };
}

export async function onNodeCreated(
  graph: Graph,
  nodeId: string,
  graphName: string,
): Promise<number | null> {
  const config = getGithubConfig(graph);
  if (!config) return null;

  try {
    if (!(await isGhAvailable())) return null;
    const node = graph.nodes[nodeId];
    if (!node) return null;
    const issueNumber = await createIssue(
      config.owner,
      config.repo,
      node.description,
      undefined,
      [graphName],
    );
    return issueNumber;
  } catch {
    console.warn(`issue-sync: failed to create issue for node ${nodeId}`);
    return null;
  }
}

export async function onNodeDeleted(
  graph: Graph,
  issueNumber: number | null,
): Promise<void> {
  if (issueNumber == null) return;
  const config = getGithubConfig(graph);
  if (!config) return;

  try {
    if (!(await isGhAvailable())) return;
    await closeIssue(config.owner, config.repo, issueNumber);
  } catch {
    console.warn(`issue-sync: failed to close issue #${issueNumber}`);
  }
}

export async function onNodeDone(
  graph: Graph,
  issueNumber: number | null,
): Promise<void> {
  if (issueNumber == null) return;
  const config = getGithubConfig(graph);
  if (!config) return;

  try {
    if (!(await isGhAvailable())) return;
    await closeIssue(config.owner, config.repo, issueNumber);
  } catch {
    console.warn(`issue-sync: failed to close issue #${issueNumber} on done`);
  }
}

export async function onAssigneeChanged(
  graph: Graph,
  issueNumber: number | null,
  oldAssignee: string | null,
  newAssignee: string | null,
): Promise<void> {
  if (issueNumber == null) return;
  const config = getGithubConfig(graph);
  if (!config) return;

  try {
    if (!(await isGhAvailable())) return;
    if (oldAssignee) {
      await unassignIssue(config.owner, config.repo, issueNumber, oldAssignee);
    }
    if (newAssignee) {
      await assignIssue(config.owner, config.repo, issueNumber, newAssignee);
    }
  } catch {
    console.warn(`issue-sync: failed to update assignee on issue #${issueNumber}`);
  }
}
