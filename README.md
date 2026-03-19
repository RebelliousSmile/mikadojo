# Mikadojo

A collaborative Mikado/Kanban board for development teams. Decompose complex goals into dependency graphs, track progress visually, and coordinate work through GitHub Issues -- all driven by AI agents via MCP.

## What is the Mikado Method?

The [Mikado Method](https://mikadomethod.info/) is a structured approach to large-scale code changes. You start with a goal, attempt it, discover what breaks, and recursively decompose until you find leaf tasks with no dependencies. You then work bottom-up: complete leaf tasks first, and propagate upward until the goal is done.

Mikadojo turns this into a visual Kanban board with dependency tracking, team collaboration, and AI agent integration.

## Features

- **Kanban + Graph views** -- visualize your Mikado graph as a Kanban board or a dependency graph (D3/Dagre)
- **MCP server** -- AI agents (Claude Code) can create graphs, add nodes, update statuses via MCP tools
- **Team collaboration** -- phases (design/development), self-assignment, GitHub Issues integration
- **Git sync** -- every change is committed and pushed automatically, periodic pull keeps everyone in sync
- **YAML multi-file storage** -- one file per node, minimal merge conflicts

## Quick Start

```bash
# Install
cd mcp-server
pnpm install
pnpm run build

# Run
node dist/index.js
```

Open [http://localhost:3100](http://localhost:3100) to see the Kanban board.

## Prerequisites

- **Node.js 18+**
- **pnpm**
- **GitHub CLI (`gh`)** -- optional, required for GitHub Issues integration and team features (`gh auth login` to authenticate)

## Architecture

A single Express process (port 3100) serves everything:

```
Browser ──── HTTP ──────► Unified server (port 3100)
                            ├── Web UI (static files)
                            ├── REST API (/api/*)
                            ├── MCP protocol (/mcp)
                            ├── Git sync (auto commit/push/pull)
                            ├── GitHub Issues (via gh CLI)
                            └── File watcher (chokidar)
                                  │
Claude Code ── MCP (HTTP) ──────┘
```

## Connecting an AI Agent

Configure Claude Code to connect to the running Mikadojo server.

**Project-level** (`.mcp.json` at repo root):

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

**Global** (`~/.claude.json`):

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

Restart Claude Code after adding the configuration.

## Team Workflow

### Deployment Model

Each developer runs their own Mikadojo instance on their machine, from their own git clone. The `gh` CLI authenticates each dev with their own GitHub account.

### Phases

A graph has two phases:

| Phase | Who | What |
|-------|-----|------|
| **Design** | Maintainers | Decompose the goal, add/remove/reorganize nodes. Each node creates a GitHub Issue. |
| **Development** | All devs | Structure is locked. Devs self-assign nodes and work on them. |

### Typical Flow

1. **Maintainer** creates a graph and decomposes it into nodes (design phase)
2. **Maintainer** locks the graph (`lock_graph`) -- switches to development phase
3. **Dev** opens the Kanban board, clicks **Take** on an actionable node -- assigns the GitHub Issue to themselves
4. **Dev** works on the task, clicks **Done** -- closes the GitHub Issue
5. All changes are auto-committed and pushed. Other devs see updates after git pull.

### Reverting to Design

A maintainer can unlock a subtree (`unlock_subtree`) to restructure it, as long as no node in the subtree is assigned. This follows the Mikado principle: revert and re-decompose as needed.

## Storage Format

Graphs are stored as YAML directories in `mikado/`:

```
mikado/
  my-project/
    _meta.yaml           # goal, root, version, phase, github config
    setup-ci.yaml        # description, status, depends_on, assignee, issue_number
    write-tests.yaml
    deploy-staging.yaml
```

Node `id` is derived from the filename (no `id` field in the YAML).

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/graphs` | List all graphs with their data |
| `POST` | `/api/graphs/:name/nodes/:id/status` | Update node status |
| `POST` | `/api/graphs/:name/nodes/:id/assign` | Self-assign a node (development phase) |
| `POST` | `/api/graphs/:name/nodes/:id/unassign` | Release a node |
| `GET` | `/api/me` | Current GitHub username |
| `GET` | `/api/last-change` | Timestamp of last change (for polling) |

## MCP Tools

### Graph Management

| Tool | Description |
|------|-------------|
| `list_graphs` | List all graph names |
| `get_graph` | Get full graph data |
| `create_graph` | Create a new graph with a root node |
| `delete_graph` | Delete a graph |
| `lock_graph` | Lock graph: design -> development |
| `unlock_subtree` | Unlock a subtree back to design |

### Node Management

| Tool | Description |
|------|-------------|
| `get_node` | Get a specific node |
| `add_node` | Add a node (design phase only) |
| `update_node` | Update node fields |
| `delete_node` | Delete a node (design phase only) |
| `update_node_status` | Change node status |
| `get_actionable_nodes` | Get nodes ready to work on |
| `get_current_user` | Get current GitHub username |

### Repository Interaction

| Tool | Description |
|------|-------------|
| `register_repo` | Register a repo by name and path |
| `list_repos` | List registered repos |
| `read_repo_directory` | List files in a repo |
| `read_repo_file` | Read a file from a repo |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3100` | Server port |
| `MIKADO_DIR` | `../mikado` | Path to the mikado graphs directory |
| `GIT_PULL_INTERVAL` | `30000` | Git pull interval in milliseconds |

## Running Tests

```bash
# Unit tests (108 tests)
cd mcp-server
pnpm run test

# E2E tests (10 tests)
cd ..
pnpm exec playwright test
```

## Development

```bash
cd mcp-server
pnpm run dev    # tsx watch mode, no build needed
```

## Credits

Created by [Emmanuel Conrardy](https://github.com/EmmanuelConrardy) -- original concept, Mikado graph engine, and Kanban visualization.

## License

[MIT](LICENSE)
