# REST API

The server exposes a JSON REST API under the `/api/` prefix.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/graphs` | List all graphs with their full data |
| `POST` | `/api/graphs/:name/nodes/:id/status` | Update the status of a node |
| `POST` | `/api/graphs/:name/nodes/:id/assign` | Self-assign a node (development phase only) |
| `POST` | `/api/graphs/:name/nodes/:id/unassign` | Release a node assignment |
| `GET` | `/api/me` | Get the current GitHub username |
| `GET` | `/api/last-change` | Timestamp of the last change (used for polling) |

## Details

### `GET /api/graphs`

Returns an array of graph objects. Each graph includes its metadata and all nodes.

### `POST /api/graphs/:name/nodes/:id/status`

Request body:

```json
{ "status": "done" }
```

Valid status values: `todo`, `doing`, `in-progress`, `blocked`, `done`.

### `POST /api/graphs/:name/nodes/:id/assign`

Assigns the node to the current user (identified via `gh` CLI). The graph must be in the **development** phase and the node must be actionable.

### `POST /api/graphs/:name/nodes/:id/unassign`

Releases the current user's assignment on the node.

### `GET /api/me`

Returns:

```json
{ "login": "alice" }
```

Requires the `gh` CLI to be authenticated (`gh auth login`).

### `GET /api/last-change`

Returns:

```json
{ "timestamp": 1710000000000 }
```

The web UI polls this endpoint every 3 seconds to detect changes and refresh the board.
