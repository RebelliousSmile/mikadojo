# Installation

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js 18+** | Required |
| **pnpm** | Package manager used by this project |
| **GitHub CLI (`gh`)** | Optional — required for GitHub Issues integration and team features (`gh auth login` to authenticate) |

## Installation

```bash
cd mcp-server
pnpm install
pnpm run build
```

The `build` step compiles TypeScript to the `dist/` directory.

## Starting the Server

```bash
node dist/index.js
```

A single process serves both the web UI and the MCP protocol on **port 3100**.

Open [http://localhost:3100](http://localhost:3100) to access the Kanban board.

## Development Mode

```bash
cd mcp-server
pnpm run dev
```

Uses `tsx` in watch mode — no build step needed. The server restarts automatically when source files change.

## Accessing the Kanban Board

Once the server is running, open your browser at:

```
http://localhost:3100
```

The UI polls the server every 3 seconds, so any change made through MCP tools appears automatically without a manual reload.
