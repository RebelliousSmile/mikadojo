# Team Workflow

## Deployment Model

Each developer runs their **own Mikadojo instance** on their machine, from their own Git clone. The `gh` CLI authenticates each developer with their own GitHub account, so assignments and issue interactions are attributed correctly.

There is no central server — Git is the synchronization layer.

## Phases

A graph moves through two phases:

| Phase | Who | What |
|-------|-----|------|
| **Design** | Maintainers | Decompose the goal, add/remove/reorganize nodes. Each node creates a GitHub Issue. |
| **Development** | All developers | Structure is locked. Developers self-assign nodes and work on them. |

## Typical Workflow

1. **Maintainer** creates a graph and decomposes it into nodes (design phase).
2. **Maintainer** locks the graph (`lock_graph`) — switches to development phase.
3. **Developer** opens the Kanban board, clicks **Take** on an actionable node — assigns the GitHub Issue to themselves.
4. **Developer** works on the task, clicks **Done** — closes the GitHub Issue.
5. All changes are auto-committed and pushed. Other developers see updates after their next Git pull (automatic every 30 s).

## Reverting to Design

A maintainer can unlock a subtree (`unlock_subtree`) to restructure it, **as long as no node in the subtree is currently assigned**. This follows the Mikado principle: revert and re-decompose as needed rather than forcing a half-finished structure.

## Actionable Nodes

A node is **actionable** when:
- All of its dependencies have status `done`
- Its own status is not `done`

Only actionable nodes can be taken (self-assigned) by developers. This enforces the bottom-up Mikado execution order automatically.
