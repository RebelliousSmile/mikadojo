# PROJECT_BRIEF.md

## Executive Summary
- **Project Name**: Mikado Kanban View
- **Vision**: Visualize Mikado method task graphs as interactive Kanban boards with dependency tracking
- **Mission**: Provide a local-first tool to manage and visualize Mikado method decomposition graphs, enabling developers to track task progress and dependencies through both Kanban board and graph views

### Full Description
- Local-first web tool that renders Mikado JSON graphs into interactive Kanban boards
- Supports dual visualization: columnar Kanban board and D3/dagre dependency graph
- Integrates with AI assistants via MCP server for programmatic graph management
- Designed for developers performing large-scale refactorings using the Mikado method

## Context

### Core Domain
- **Mikado Method**: structured approach to making large-scale code changes by decomposing goals into dependency graphs of smaller tasks

### Ubiquitous Language
| Term | Definition | Synonyms |
|------|-----------|----------|
| Graph | A Mikado decomposition tree with a root goal and dependent nodes | Mikado Graph |
| Node | A single task/step within a graph, with status and dependencies | Task, Step |
| Root | The top-level goal node that all other nodes contribute to | - |
| Dependency | A prerequisite relationship between nodes (node B depends on node A being done) | - |
| Action | An executable operation attached to a node (`claude-code` task, `gh-cli` command, shell command) | - |
| Status | Current state of a node: `todo`, `doing`, `in-progress`, `blocked`, `done` | - |

## Features & Use-cases
- Load Mikado JSON graphs from local files or dev server via symlink
- Kanban board view with status columns (`todo`, `doing`, `in-progress`, `blocked`, `done`)
- Graph visualization using D3/dagre for dependency tree rendering
- Dependency tracking with visual highlighting of unmet dependencies (orange)
- Multi-graph support with tabs (one tab per JSON file)
- Auto-refresh on file changes (3s polling via `server.js`)
- Download updated JSON after status changes
- Action execution on nodes (`claude-code`, `gh-cli`, shell commands)
- MCP Server for AI assistant integration (graph CRUD, node management, action execution)
- Repository registry for multi-repo support

## User Journey maps (mermaid journey diagram)

### Developer
```mermaid
journey
    title Developer tracks a large refactoring
    section Setup
      Symlink mikado JSON directory: 5: Developer
      Start local server: 5: Developer
    section Daily workflow
      Open Kanban board in browser: 5: Developer
      Review task statuses and dependencies: 4: Developer
      Pick a task with met dependencies: 4: Developer
      Update task status to doing: 5: Developer
      Complete task and mark done: 5: Developer
      Download updated JSON: 3: Developer
    section Review
      Switch to graph view: 4: Developer
      Identify blocked paths: 4: Developer
      Reprioritize tasks: 3: Developer
```

### AI Assistant
```mermaid
journey
    title AI Assistant manages graphs via MCP
    section Discovery
      List available graphs: 5: AI Assistant
      Read graph structure: 5: AI Assistant
    section Task management
      Create new nodes: 5: AI Assistant
      Update node statuses: 5: AI Assistant
      Check dependency satisfaction: 4: AI Assistant
    section Execution
      Execute action on a node: 4: AI Assistant
      Report results back: 4: AI Assistant
```
