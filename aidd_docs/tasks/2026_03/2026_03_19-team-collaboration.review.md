# Code Review — Team Collaboration Implementation

**Date**: 2026-03-19
**Branch**: feature/mcp-server
**Diff base**: master (fef9935)

---

## Score Table

| # | Title | Files | Score |
|---|-------|-------|-------|
| 1 | Permission check duplicated in lock_graph and unlock_subtree | graph-tools.ts:109-122, 146-158 | 1 |
| 2 | add_node mutates immutable result from addNode | node-tools.ts:74-75 | 2 |
| 3 | syncAfterWrite path is directory not file | node-tools.ts:80, web-routes.ts:103 | 1 |
| 4 | update_node has issue sync but also delegates to sharedUpdateNodeStatus for status-only | node-tools.ts:112-136 vs 191 | 1 |
| 5 | onNodeDeleted receives old graph instead of updated | node-tools.ts:168 | 1 |

**Total**: 0 critical, 1 major, 4 minor

---

## Details

### 1. Permission check duplicated (Score: 1)

`graph-tools.ts` lines 109-122 and 146-158 contain identical permission check logic for `lock_graph` and `unlock_subtree`. Should be extracted to a helper function like `checkMaintainerPermission(graph)`.

### 2. add_node mutates immutable result (Score: 2)

`node-tools.ts` line 74-75:
```typescript
const node = updated.nodes[nodeId];
node.issue_number = issueNumber;
```

`addNode()` returns an immutable new Graph object. Directly mutating `node.issue_number` on the returned object violates the immutability contract established by `node-operations.ts`. Should create a new node object:
```typescript
updated.nodes[nodeId] = { ...updated.nodes[nodeId], issue_number: issueNumber };
```

### 3. syncAfterWrite path is directory not specific file (Score: 1)

`syncAfterWrite([`mikado/${graphName}`], ...)` passes the directory path, not the specific file(s) changed. This means `git add mikado/graph-name` stages the entire directory. The plan specified "passer les fichiers specifiques modifies, pas tout mikado/". For single-node operations, should pass the specific YAML file: `mikado/${graphName}/${nodeId}.yaml`.

### 4. Dual path for status update in update_node (Score: 1)

`node-tools.ts` `update_node` handles status changes including `onNodeDone` (lines 122-125), while `update_node_status` delegates to `sharedUpdateNodeStatus`. If someone uses `update_node` with `{ status: "done" }`, the issue sync runs inline. If they use `update_node_status`, it runs via the shared module. Both work but the code paths are different, which could lead to subtle inconsistencies.

### 5. onNodeDeleted receives old graph (Score: 1)

`node-tools.ts` line 168:
```typescript
await onNodeDeleted(graph, issueNumber);
```
Passes the original `graph` (before deletion) instead of `updated` (after deletion). `onNodeDeleted` uses the graph only to check `graph.github`, so it still works. But semantically it should receive the current state.

---

## Positive observations

- **Clean separation**: git-sync, git-watcher, sync-after-write form a clean layered architecture
- **gh-client**: Safe use of `execFile` (no shell injection), clean error handling
- **issue-sync**: Single responsibility, graceful degradation everywhere
- **node-status-update.ts**: Good extraction to eliminate duplication between REST and MCP
- **phase-operations.ts**: Pure functions with clear pre-conditions and documentation
- **web-routes.ts**: Phase guards on assign/unassign, proper error responses
- **Mutex in git-sync**: Simple promise-chain mutex — effective and dependency-free
