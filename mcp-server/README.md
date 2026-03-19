# Mikadojo — MCP Server

An MCP (Model Context Protocol) server that exposes your local Mikado/Kanban board to AI agents. External repositories can connect to it through Claude Code and manage task graphs and track dependencies -- all reflected in real time on the kanban web UI.

## Prerequisites

- **Node.js 18+**
- **pnpm**

## Installation

```bash
cd mcp-server
pnpm install
pnpm run build
```

The `build` step compiles TypeScript to the `dist/` directory.

## Running

A single process serves both the web UI and the MCP protocol on port 3100:

```bash
cd mcp-server
node dist/index.js
```

For development (uses `tsx`, no build step needed):

```bash
pnpm run dev
```

Open your browser at [http://localhost:3100](http://localhost:3100) to see the kanban board.

## Connecting a Repository

To connect a repository to the kanban, configure Claude Code's MCP client to point at the running server.

### Option A: Project-level configuration

Create a `.mcp.json` file at the root of your repository:

```json
{
  "mcpServers": {
    "kanban": {
      "type": "http",
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

### Option B: Global configuration

Add the server to `~/.claude.json` so it is available in every project:

```json
{
  "mcpServers": {
    "kanban": {
      "type": "http",
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

After adding the configuration, restart Claude Code (or start a new session). The MCP server must be running for the connection to succeed.

## Available MCP Tools

### Graph Management

| Tool           | Description                           |
| -------------- | ------------------------------------- |
| `list_graphs`  | List all available Mikado graph names |
| `get_graph`    | Get the full data of a Mikado graph   |
| `create_graph` | Create a new graph with a root node   |
| `delete_graph` | Delete a graph                        |
| `lock_graph`   | Lock a graph from design to development phase |
| `unlock_subtree` | Unlock a subtree back to design phase |

### Node Management

| Tool                   | Description                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- |
| `get_node`             | Get a specific node from a graph                                                |
| `add_node`             | Add a new node to a graph (design phase only)                                   |
| `update_node`          | Update fields of an existing node                                               |
| `delete_node`          | Delete a node and clean up references (design phase only)                       |
| `update_node_status`   | Change the status of a node (`todo`, `doing`, `in-progress`, `blocked`, `done`) |
| `get_actionable_nodes` | Get nodes whose dependencies are all done and that are not done themselves      |
| `get_current_user`     | Get the GitHub username of the current user                                     |

### Repo Interaction

| Tool                  | Description                                                          |
| --------------------- | -------------------------------------------------------------------- |
| `register_repo`       | Register an external repository by name and absolute path            |
| `list_repos`          | List all registered repositories                                     |
| `read_repo_directory` | List files and subdirectories in a repo (supports recursive listing) |
| `read_repo_file`      | Read the contents of a file in a registered repo                     |

## Available MCP Resources

| URI                                          | Description                                     |
| -------------------------------------------- | ----------------------------------------------- |
| `mikado://graphs`                            | List of graph names                             |
| `mikado://graphs/{graphName}`                | Full graph data                                 |
| `mikado://graphs/{graphName}/nodes/{nodeId}` | Single node data                                |
| `mikado://repos`                             | Registered repositories                         |
| `mikado://schema`                            | JSON schema describing graph and node structure |
| `mikado://guide`                             | Usage guide for AI agents                       |

## Usage Examples

### 1. Create a graph for a project

```
create_graph(
  graphName: "deploy-webapp",
  goal: "Deploy web app to production",
  rootNodeId: "deploy-webapp",
  rootDescription: "Deploy web app to production"
)
```

### 2. Add nodes with dependencies

```
add_node(graphName: "deploy-webapp", nodeId: "setup-ci",
         description: "Configure CI pipeline", depends_on: [])

add_node(graphName: "deploy-webapp", nodeId: "write-tests",
         description: "Write unit tests", depends_on: [])

add_node(graphName: "deploy-webapp", nodeId: "setup-staging",
         description: "Set up staging environment",
         depends_on: ["setup-ci", "write-tests"])

update_node(graphName: "deploy-webapp", nodeId: "deploy-webapp",
            depends_on: ["setup-staging"])
```

### 3. Check actionable nodes

```
get_actionable_nodes(graphName: "deploy-webapp")
```

Returns nodes whose dependencies are all `done` and whose own status is not `done`.

## Storage Format

Graphs are stored as YAML directories in `mikado/`:

```
mikado/
  deploy-webapp/
    _meta.yaml           # goal, root, version, phase
    setup-ci.yaml        # description, status, depends_on
    write-tests.yaml
    setup-staging.yaml
```

## Auto-Refresh

The kanban web UI polls the server every 3 seconds. Any change made through MCP tools appears in the browser without a manual reload.

## Troubleshooting

**Port 3100 already in use**
Another process is occupying the port. Find and stop it.

**Claude Code does not see the kanban tools**
- Verify the MCP server is running (`http://localhost:3100/mcp` should be reachable).
- Check that `.mcp.json` contains the correct URL (`type: "http"`).
- Restart your Claude Code session after adding the configuration.

**Path issues on Windows**
Use forward slashes in MCP tool arguments. The server normalizes paths internally.
