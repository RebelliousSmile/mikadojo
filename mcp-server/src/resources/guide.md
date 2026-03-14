# Mikado Graph Guide

## Concepts

A Mikado graph is a dependency-based task decomposition tool. It consists of:

- **Root goal**: The top-level objective you want to achieve. It depends on all sub-tasks being completed.
- **Nodes**: Individual tasks or sub-goals. Each node can depend on other nodes.
- **Dependencies** (`depends_on`): A node cannot be started until all its dependencies are marked as "done".
- **Leaf nodes**: Nodes with no dependencies. These are the first tasks to work on.

## Status Values

| Status        | Meaning                                      |
|---------------|----------------------------------------------|
| `todo`        | Not started, waiting to be picked up         |
| `doing`       | Currently being worked on                    |
| `in-progress` | Work has started but is not yet complete      |
| `blocked`     | Cannot proceed due to an external issue       |
| `done`        | Completed successfully                        |

## Workflow

1. **Create a graph**: Use `create_graph` with a goal, root node ID, and root description.
2. **Decompose**: Add child nodes with `add_node`, specifying `depends_on` to link them to the root or other nodes.
3. **Identify actionable nodes**: Use `get_actionable_nodes` to find leaf nodes (all deps done, node itself not done).
4. **Work on nodes**: Update status with `update_node_status` as you progress (todo -> doing -> done).
5. **Propagate**: Once all dependencies of a parent node are done, that parent becomes actionable.
6. **Complete**: When the root node's dependencies are all done, mark the root as done.

## Conventions

- **nodeId**: Use kebab-case (e.g., `setup-database`, `create-api-endpoint`).
- **depends_on**: Must reference existing node IDs in the same graph.
- **Graph names**: Alphanumeric with hyphens and underscores only (e.g., `my-project`, `2026-02-07-mikado_graph`).

## Example

Creating a simple graph for a "Deploy web app" goal:

```
create_graph(graphName: "deploy-webapp", goal: "Deploy web app to production", rootNodeId: "deploy-webapp", rootDescription: "Deploy web app to production")

add_node(graphName: "deploy-webapp", nodeId: "setup-ci", description: "Configure CI pipeline", depends_on: [])
add_node(graphName: "deploy-webapp", nodeId: "write-tests", description: "Write unit tests", depends_on: [])
add_node(graphName: "deploy-webapp", nodeId: "setup-staging", description: "Set up staging environment", depends_on: ["setup-ci", "write-tests"])

update_node(graphName: "deploy-webapp", nodeId: "deploy-webapp", depends_on: ["setup-staging"])
```

This creates a graph where:
- `setup-ci` and `write-tests` are leaf nodes (actionable immediately)
- `setup-staging` depends on both leaf nodes
- `deploy-webapp` (root) depends on `setup-staging`

## Action Types

Nodes can have optional `actions` that automate work:

- **`claude-code`**: Runs a Claude CLI command with a prompt on a target repository.
- **`gh-cli`**: Executes a GitHub CLI command (e.g., create PR, create issue).
- **`shell`**: Runs an arbitrary shell command in a specified working directory.
- **`repo-template`**: Loads and executes an action template from a target repository.

Actions are executed sequentially. The result of a previous action can be referenced in the next action's config using `{{prev_result}}`.
