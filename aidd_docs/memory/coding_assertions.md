# Coding Guidelines

> Those rules must be minimal because they MUST be checked after EVERY CODE GENERATION.

## Requirements to complete a feature

- MCP server TypeScript code must compile without errors (`strict: true`)

## Commands to run

### Before commit
| Order | Command | Description |
|-------|---------|-------------|
| 1 | `cd mcp-server && pnpm run build` | TypeScript compilation (tsc, strict mode) |

### Before push
| Order | Command | Description |
|-------|---------|-------------|
| 1 | `cd mcp-server && pnpm run build` | Ensure MCP server compiles cleanly |
