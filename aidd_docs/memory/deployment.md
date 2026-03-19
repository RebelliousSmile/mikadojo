# Deployment

## Environments

- **Development only** -- no staging, no production

## URLs

- Kanban UI: http://localhost:5173
- MCP endpoint: http://localhost:3100/mcp

## How to Run

- Dev server: `node server.js` (port 5173)
- MCP server: `pnpm run dev` or `pnpm run start` (port 3100)

## Environment Variables

- `PORT` -- Dev server port (default: `5173`)
- `MIKADO_DIR` -- Path to mikado JSON files directory (default: `./mikado`)

## Data

- JSON files stored in `./mikado/` directory -- no database

## Project Layout

```
kanban-view/
├── server.js         # Dev server (port 5173)
├── mcp-server/       # MCP server (port 3100)
│   └── src/
├── mikado/           # Data directory (JSON files)
└── .mcp.json         # MCP servers config
```
