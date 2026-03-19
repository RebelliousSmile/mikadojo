# Architecture

## Language/Framework

- Frontend: Vanilla HTML/CSS/JS, D3 (CDN), Dagre (CDN) -- no framework, no bundler
- Dev Server: Node CommonJS, vanilla `http` module (`server.js`)
- MCP Server: Node TypeScript ESM, Express, `@modelcontextprotocol/sdk`, Zod (`mcp-server/package.json`)

```mermaid
---
title: Tech Stack
---
flowchart TD
    FE["Frontend - Vanilla HTML/JS/CSS"]
    D3["D3 - Graph Rendering"]
    DAG["Dagre - Graph Layout"]
    DS["Dev Server - Node http"]
    MCP["MCP Server - Express + MCP SDK"]
    ZOD["Zod - Validation"]
    TS["TypeScript"]
    FS["Mikado JSON Files"]

    FE --> D3
    FE --> DAG
    FE --> DS
    DS --> FS
    MCP --> ZOD
    MCP --> TS
    MCP --> FS
```

### Naming Conventions

- Files: kebab-case
- Functions/Variables: camelCase
- Constants: UPPER_CASE
- Types/Interfaces: PascalCase

## Services communication

### Frontend to Dev Server

- `GET /api/graphs` -- list all Mikado graphs from `mikado/` directory
- `POST /api/graphs/:name/nodes/:id/status` -- update node status
- `POST /api/graphs/:name/nodes/:id/run-actions` -- trigger node actions
- `GET /api/last-change` -- poll for file changes (timestamp)
- Static files served from project root

### MCP Server

- Exposes MCP protocol over HTTP streaming at `/mcp` (POST/GET/DELETE)
- Port 3100
- Modular structure: `tools/` (graph-tools, node-tools, action-tools, repo-tools), `resources/`, `data/`, `executors/`
- Executors: `claude-executor` (subprocess), `gh-executor` (subprocess), `shell-executor` (subprocess)
- Both servers read/write Mikado JSON files from `mikado/` directory
- No external services, no auth, no DB

```mermaid
---
title: Services Communication
---
C4Context
    Person(user, "User", "Browser")
    Person(agent, "AI Agent", "Claude Code")

    System(fe, "Frontend", "Vanilla HTML/JS/CSS on port 5173")
    System(ds, "Dev Server", "Node http on port 5173")
    System(mcp, "MCP Server", "Express on port 3100")
    SystemDb(fs, "Mikado JSON Files", "mikado/ directory")

    Rel(user, fe, "Opens browser")
    Rel(fe, ds, "REST API + static files")
    Rel(agent, mcp, "MCP protocol over HTTP /mcp")
    Rel(ds, fs, "Reads/Writes JSON")
    Rel(mcp, fs, "Reads/Writes JSON")
```
