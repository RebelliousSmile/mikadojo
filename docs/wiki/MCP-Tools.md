# MCP Tools

Mikadojo exposes an MCP (Model Context Protocol) server at `http://localhost:3100/mcp`. AI agents such as Claude Code can connect to it and use the tools below.

## Configuration

### Project-level (`.mcp.json` at repo root)

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

### Global (`~/.claude.json`)

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

Restart Claude Code after adding the configuration. The MCP server must be running for the connection to succeed.

## Graph Management Tools

| Tool | Description |
|------|-------------|
| `list_graphs` | List all available Mikado graph names |
| `get_graph` | Get the full data of a Mikado graph |
| `create_graph` | Create a new graph with a root node |
| `delete_graph` | Delete a graph |
| `lock_graph` | Lock a graph from design to development phase |
| `unlock_subtree` | Unlock a subtree back to design phase |

## Node Management Tools

| Tool | Description |
|------|-------------|
| `get_node` | Get a specific node from a graph |
| `add_node` | Add a new node to a graph (design phase only) |
| `update_node` | Update fields of an existing node |
| `delete_node` | Delete a node and clean up references (design phase only) |
| `update_node_status` | Change the status of a node (`todo`, `doing`, `in-progress`, `blocked`, `done`) |
| `get_actionable_nodes` | Get nodes whose dependencies are all done and that are not done themselves |
| `get_current_user` | Get the GitHub username of the current user |

## Repository Interaction Tools

| Tool | Description |
|------|-------------|
| `register_repo` | Register an external repository by name and absolute path |
| `list_repos` | List all registered repositories |
| `read_repo_directory` | List files and subdirectories in a repo (supports recursive listing) |
| `read_repo_file` | Read the contents of a file in a registered repo |

## MCP Resources

| URI | Description |
|-----|-------------|
| `mikado://graphs` | List of graph names |
| `mikado://graphs/{graphName}` | Full graph data |
| `mikado://graphs/{graphName}/nodes/{nodeId}` | Single node data |
| `mikado://repos` | Registered repositories |
| `mikado://schema` | JSON schema describing graph and node structure |
| `mikado://guide` | Usage guide for AI agents |

## Usage Examples

### Create a graph

```
create_graph(
  graphName: "deploy-webapp",
  goal: "Deploy web app to production",
  rootNodeId: "deploy-webapp",
  rootDescription: "Deploy web app to production"
)
```

### Add nodes with dependencies

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

### Get actionable nodes

```
get_actionable_nodes(graphName: "deploy-webapp")
```

Returns nodes whose dependencies are all `done` and whose own status is not `done`.
