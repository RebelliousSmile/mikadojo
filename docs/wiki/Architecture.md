# Architecture

## Overview

Mikadojo runs as a **single Express process** on port 3100. This unified server handles the web UI, REST API, MCP protocol, Git synchronization, GitHub Issues integration, and file watching — all in one process.

## Architecture Diagram

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

## Components

| Component | Path | Description |
|-----------|------|-------------|
| **Web UI** | `/` | Static HTML/CSS/JS files served directly. Kanban board and dependency graph views built with D3/Dagre. |
| **REST API** | `/api/*` | JSON endpoints for reading graphs, updating node status, assignment, and polling. See [REST-API](REST-API). |
| **MCP protocol** | `/mcp` | HTTP-based MCP endpoint. AI agents (Claude Code) connect here to use structured tools. See [MCP-Tools](MCP-Tools). |
| **Git sync** | — | On every write, changes are auto-committed and pushed to the remote. A periodic pull (every 30 s by default) keeps the local copy up to date. |
| **GitHub Issues** | — | Uses the `gh` CLI to create, close, and assign GitHub Issues in sync with graph nodes. Requires `gh auth login`. |
| **File watcher** | — | `chokidar` watches the `mikado/` directory for external changes (e.g., manual edits, git pulls) and reloads the in-memory graph. |

## Design Decisions

- **Single port** — no separate frontend dev server or WebSocket server to manage.
- **YAML per node** — each node is its own file, which minimizes Git merge conflicts when multiple developers work in parallel.
- **MCP over HTTP** — standard HTTP transport means Claude Code can connect without any local process spawning or stdio piping.
