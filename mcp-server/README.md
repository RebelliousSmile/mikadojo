# Kanban MCP Server

An MCP (Model Context Protocol) server that exposes your local Mikado/Kanban board to AI agents. External repositories can connect to it through Claude Code and manage task graphs, track dependencies, and execute actions -- all reflected in real time on the kanban web UI.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Servers](#running-the-servers)
- [Connecting a Repository](#connecting-a-repository)
- [Available MCP Tools](#available-mcp-tools)
- [Available MCP Resources](#available-mcp-resources)
- [Usage Examples](#usage-examples)
- [Action Templates](#action-templates)
- [Auto-Refresh](#auto-refresh)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- **Node.js 18+**
- **npm**
- **Claude Code CLI** -- required for `claude-code` action types
- **GitHub CLI (`gh`)** -- required for `gh-cli` action types

## Installation

```bash
cd C:\dev-perso\kanban-view\mcp-server
npm install
npm run build
```

The `build` step compiles TypeScript to the `dist/` directory.

## Running the Servers

You need two terminals: one for the kanban web UI and one for the MCP server.

**Terminal 1 -- Web UI (port 5173):**

```bash
cd C:\dev-perso\kanban-view
node server.js
```

**Terminal 2 -- MCP Server (port 3100):**

```bash
cd C:\dev-perso\kanban-view\mcp-server
npm start
```

For development (uses `tsx`, no build step needed):

```bash
npm run dev
```

Open your browser at [http://localhost:5173](http://localhost:5173) to see the kanban board.

Both servers read and write the same `mikado/*.json` files on disk. Changes made through MCP tools appear on the web UI automatically.

## Connecting a Repository

To connect a repository (e.g. `C:\dev-perso\meal-planner`) to the kanban, configure Claude Code's MCP client to point at the running server. There are two options.

### Option A: Project-level configuration

Create a `.mcp.json` file at the root of your repository:

```bash
# C:\dev-perso\meal-planner\.mcp.json
```

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

This makes the kanban tools available only when Claude Code is running inside `meal-planner`.

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

The server exposes 17 tools organized into four categories.

### Graph Management

| Tool           | Description                           |
| -------------- | ------------------------------------- |
| `list_graphs`  | List all available Mikado graph names |
| `get_graph`    | Get the full data of a Mikado graph   |
| `create_graph` | Create a new graph with a root node   |
| `delete_graph` | Delete a graph                        |

### Node Management

| Tool                   | Description                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- |
| `get_node`             | Get a specific node from a graph                                                |
| `add_node`             | Add a new node to a graph                                                       |
| `update_node`          | Update fields of an existing node                                               |
| `delete_node`          | Delete a node and clean up references                                           |
| `update_node_status`   | Change the status of a node (`todo`, `doing`, `in-progress`, `blocked`, `done`) |
| `get_actionable_nodes` | Get nodes whose dependencies are all done and that are not done themselves      |

### Repo Interaction

| Tool                  | Description                                                          |
| --------------------- | -------------------------------------------------------------------- |
| `register_repo`       | Register an external repository by name and absolute path            |
| `list_repos`          | List all registered repositories                                     |
| `read_repo_directory` | List files and subdirectories in a repo (supports recursive listing) |
| `read_repo_file`      | Read the contents of a file in a registered repo                     |

### Actions

| Tool                    | Description                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| `list_action_templates` | List available action templates (centralized + repo overrides)           |
| `execute_action`        | Execute a single action on a repository                                  |
| `execute_node_actions`  | Execute all actions of a node sequentially, passing results between them |

## Available MCP Resources

Resources provide read-only data that AI agents can reference.

| URI                                          | Description                                              |
| -------------------------------------------- | -------------------------------------------------------- |
| `mikado://graphs`                            | List of graph names                                      |
| `mikado://graphs/{graphName}`                | Full graph data                                          |
| `mikado://graphs/{graphName}/nodes/{nodeId}` | Single node data                                         |
| `mikado://repos`                             | Registered repositories                                  |
| `mikado://schema`                            | JSON schema describing graph, node, and action structure |
| `mikado://guide`                             | Usage guide for AI agents                                |

## Usage Examples

The examples below show conversations with Claude Code from within the `meal-planner` repository, after [connecting it](#connecting-a-repository) to the kanban.

### 1. Create a graph for a project

**You:**

> Create a mikado graph for the meal-planner Firebase migration.

**Claude calls:**

```
create_graph(
  graphName: "meal-planner-firebase",
  goal: "Migrate meal-planner to Firebase",
  rootNodeId: "migrate-firebase",
  rootDescription: "Complete Firebase migration"
)
```

This creates `mikado/meal-planner-firebase.json` and the graph appears in the web UI.

### 2. Add nodes with dependencies

**You:**

> Add three tasks: setup-firestore (leaf), create-data-models (depends on setup-firestore), migrate-recipes (depends on create-data-models).

**Claude calls `add_node` three times:**

```
add_node(graphName: "meal-planner-firebase", nodeId: "setup-firestore",
         description: "Set up Firestore SDK and configuration",
         depends_on: ["migrate-firebase"])

add_node(graphName: "meal-planner-firebase", nodeId: "create-data-models",
         description: "Create Firestore data models for recipes",
         depends_on: ["setup-firestore"])

add_node(graphName: "meal-planner-firebase", nodeId: "migrate-recipes",
         description: "Migrate recipe data to Firestore",
         depends_on: ["create-data-models"])
```

In the Mikado method, leaf nodes (those with no further dependencies) are tackled first. `setup-firestore` is the first actionable node here.

### 3. Register a repo and check progress

**You:**

> Register the meal-planner repo and show me what I can work on next.

**Claude calls:**

```
register_repo(
  repoName: "meal-planner",
  repoPath: "C:/dev-perso/meal-planner"
)

get_actionable_nodes(graphName: "meal-planner-firebase")
```

`get_actionable_nodes` returns every node whose dependencies are all `done` and whose own status is not `done` -- these are the tasks you can start right now.

### 4. Add actions to a node

**You:**

> Add a claude-code action to setup-firestore that installs the Firebase SDK, and a shell action that runs the tests afterward.

**Claude calls:**

```
update_node(
  graphName: "meal-planner-firebase",
  nodeId: "setup-firestore",
  actions: [
    {
      id: "install-firebase",
      type: "claude-code",
      label: "Install Firebase SDK",
      config: {
        prompt: "Install the Firebase JS SDK and initialize a Firestore instance in src/lib/firebase.ts",
        cwd: "C:/dev-perso/meal-planner",
        allowedTools: ["Read", "Write", "Bash"]
      },
      status: "pending",
      result: null
    },
    {
      id: "run-tests",
      type: "shell",
      label: "Run tests",
      config: {
        command: "npm test",
        cwd: "C:/dev-perso/meal-planner"
      },
      status: "pending",
      result: null
    }
  ]
)
```

Actions execute sequentially. Each action receives the previous action's output via the `{{prev_result}}` placeholder if used in its config.

### 5. Execute actions and use the web UI

**From Claude Code:**

> Run the actions on setup-firestore.

**Claude calls:**

```
execute_node_actions(
  graphName: "meal-planner-firebase",
  nodeId: "setup-firestore"
)
```

This runs each action in order, updating their status (`running` / `done` / `failed`) in the JSON file as it goes. The kanban web UI picks up these changes automatically.

**From the web UI:** each card with actions displays a **Run All** button. Clicking it triggers `execute_node_actions` for that node through the MCP server.

## Action Templates

Action templates are reusable action definitions stored as JSON files.

### Centralized templates

Located in `mcp-server/action-templates/`. These ship with the kanban:

| Template           | Type          | Description                                     |
| ------------------ | ------------- | ----------------------------------------------- |
| `ai-task-prompt`   | `any AI harness` | Run a generic AI task with a provided prompt    |
| `claude-code-task` | `claude-code` | Run Claude CLI with a prompt on the target repo |
| `gh-pr-create`     | `gh-cli`      | Create a GitHub Pull Request                    |
| `gh-issue-create`  | `gh-cli`      | Create a GitHub Issue                           |
| `run-tests`        | `shell`       | Run `npm test`                                  |

### Per-repo overrides

A repository can override or add templates by placing JSON files in `.mikado/actions/` at the repo root:

```
C:\dev-perso\meal-planner\
  .mikado/
    actions/
      run-tests.json       # overrides the centralized run-tests template
      deploy-preview.json  # adds a new template
```

When `list_action_templates` is called with a `repoPath`, repo templates take precedence over centralized ones with the same `id`.

### Template format

```json
{
  "id": "run-tests",
  "type": "shell",
  "label": "Run tests",
  "description": "Run the project test suite",
  "config": {
    "command": "npm test"
  }
}
```

Supported action types: `AI`, `claude-code`, `gh-cli`, `shell`, `repo-template`.

## Auto-Refresh

The kanban web UI polls the graph JSON files and auto-refreshes every 3 seconds. Any change made through MCP tools -- adding nodes, updating statuses, running actions -- appears in the browser without a manual reload.

## Troubleshooting

**Port 3100 already in use**
Another process is occupying the MCP port. Find and stop it, or check if another instance of the MCP server is already running.

**Claude Code does not see the kanban tools**

- Verify the MCP server is running (`http://localhost:3100/mcp` should be reachable).
- Check that `.mcp.json` (or `~/.claude.json`) contains the correct URL (`type: "http"`, not `"sse"`).
- Restart your Claude Code session after adding the configuration.

**Actions fail with "claude not found" or "gh not found"**
The `claude-code` action type requires the Claude Code CLI to be installed and on your PATH. The `gh-cli` type requires the GitHub CLI (`gh`) to be installed and authenticated (`gh auth login`).

**Graph changes do not appear in the web UI**
Make sure the web UI server is running on port 5173 (`node server.js` from the kanban-view root). The browser tab must be open to receive auto-refresh updates.

**Path issues on Windows**
Use forward slashes (`C:/dev-perso/meal-planner`) in MCP tool arguments and action configs. The server normalizes paths internally.
