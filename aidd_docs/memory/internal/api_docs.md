# API Documentation

## Dev Server REST API

- **Base URL**: http://localhost:5173
- **Format**: REST/JSON
- **Authentication**: None

### Endpoints

- `GET /api/graphs` - List all graph names from `mikado/` directory
- `GET /api/last-change` - Get last file change timestamp (polling support)
- `POST /api/graphs/:name/nodes/:id/status` - Update node status
  - Body: `{ status: "todo"|"doing"|"in-progress"|"blocked"|"done" }`
- `POST /api/graphs/:name/nodes/:id/run-actions` - Execute all actions on a node sequentially
- `POST /api/actions/execute` - Execute a single action
  - Body: `{ action, cwd }`

## MCP Server API

- **Base URL**: http://localhost:3100/mcp
- **Protocol**: MCP over HTTP Streaming
- **Endpoints**: `POST/GET/DELETE /mcp`
- **Schema**: `mcp-server/src/schemas.ts` (Zod: Graph, Node, Action)

### Tools

#### graph-tools (`mcp-server/src/tools/graph-tools.ts`)
- `list_graphs` - List all available Mikado graph names
- `get_graph(graphName)` - Get full graph data
- `create_graph(graphName, goal, rootNodeId, rootDescription)` - Create graph with root node
- `delete_graph(graphName)` - Delete a graph

#### node-tools (`mcp-server/src/tools/node-tools.ts`)
- `get_node(graphName, nodeId)` - Get a specific node
- `add_node(graphName, nodeId, description, status?, depends_on?, notes?, actions?)` - Add node to graph
- `update_node(graphName, nodeId, status?, description?, notes?, depends_on?, actions?)` - Update node fields
- `delete_node(graphName, nodeId)` - Delete node and clean up dependency references
- `update_node_status(graphName, nodeId, status)` - Change node status
- `get_actionable_nodes(graphName)` - Get nodes with all deps done and not done themselves

#### action-tools (`mcp-server/src/tools/action-tools.ts`)
- `list_action_templates(repoPath?)` - List available action templates (centralized + repo overrides)
- `execute_action(repoPath, action)` - Execute a single action (server-side only, client actions rejected)
- `execute_node_actions(graphName, nodeId)` - Execute all server actions sequentially, skip client actions
- `get_node_actions(graphName, nodeId)` - Get action definitions with client execution hints (no execution)
- `update_action_status(graphName, nodeId, actionId, status, result)` - Report client-executed action result

#### repo-tools (`mcp-server/src/tools/repo-tools.ts`)
- `register_repo(repoName, repoPath)` - Register external repo by name and path
- `list_repos` - List all registered repositories
- `read_repo_directory(repoPath, directory?, recursive?)` - List files in repo directory (max depth 3)
- `read_repo_file(repoPath, filePath)` - Read file contents (path traversal protected)

### Resources (`mcp-server/src/resources/graph-resources.ts`)
- `mikado://graphs` - List of all graph names
- `mikado://graphs/{graphName}` - Full graph data
- `mikado://graphs/{graphName}/nodes/{nodeId}` - Specific node data
- `mikado://repos` - List of registered repositories
- `mikado://schema` - JSON schema for graph/node/action structure
- `mikado://guide` - Usage guide (markdown)

### Schemas (`mcp-server/src/schemas.ts`)
- **NodeStatus**: `todo | doing | in-progress | blocked | done`
- **ActionStatus**: `pending | running | done | failed`
- **ActionExecution**: `server | client` (default: client)
- **Action types**: `claude-code | gh-cli | shell | repo-template`
