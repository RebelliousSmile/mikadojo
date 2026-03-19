# Mikadojo Wiki

Welcome to the **Mikadojo** wiki — a collaborative Mikado/Kanban board for development teams.

## What is Mikadojo?

Mikadojo combines three powerful ideas:

- **Kanban board** — visualize your work as cards in columns (todo / in-progress / done)
- **Mikado Method** — decompose complex goals into dependency graphs, work bottom-up on leaf tasks
- **MCP (Model Context Protocol)** — AI agents (Claude Code) can read and update the board through structured tools

The result is a tool where a team and their AI agents share a single source of truth for task decomposition, assignment, and progress tracking — all backed by Git.

## Features

| Feature | Description |
|---------|-------------|
| **Kanban + Graph views** | Visualize your Mikado graph as a Kanban board or a dependency graph (D3/Dagre) |
| **MCP server** | AI agents (Claude Code) can create graphs, add nodes, and update statuses via MCP tools |
| **Team collaboration** | Design and development phases, self-assignment, GitHub Issues integration |
| **Git sync** | Every change is auto-committed and pushed; periodic pull keeps all instances in sync |
| **YAML multi-file storage** | One file per node — minimal merge conflicts |

## Quick Links

| Page | Description |
|------|-------------|
| [Installation](Installation) | Prerequisites, installation steps, and how to start the server |
| [Architecture](Architecture) | Server architecture and component overview |
| [Team-Workflow](Team-Workflow) | Deployment model, phases, and typical team workflow |
| [Storage-Format](Storage-Format) | YAML directory layout and field descriptions |
| [REST-API](REST-API) | HTTP endpoints exposed by the server |
| [MCP-Tools](MCP-Tools) | MCP tools and resources available to AI agents |
| [Configuration](Configuration) | Environment variables |
| [Running-Tests](Running-Tests) | How to run unit and E2E tests |
| [Troubleshooting](Troubleshooting) | Common issues and solutions |

## Repository

[https://github.com/RebelliousSmile/mikadojo](https://github.com/RebelliousSmile/mikadojo)

---

🇫🇷 [Version française](fr/Home)
