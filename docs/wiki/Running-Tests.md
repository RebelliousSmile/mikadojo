# Running Tests

## Unit Tests (Vitest)

The MCP server has a suite of unit tests powered by [Vitest](https://vitest.dev/).

```bash
cd mcp-server
pnpm run test
```

This runs all tests in watch mode. To run once without watching:

```bash
cd mcp-server
pnpm run test --run
```

## E2E Tests (Playwright)

End-to-end tests for the web UI use [Playwright](https://playwright.dev/).

```bash
pnpm exec playwright test
```

Run from the **repository root** (not inside `mcp-server/`).

To run in headed mode (visible browser):

```bash
pnpm exec playwright test --headed
```

To run a specific test file:

```bash
pnpm exec playwright test e2e/kanban.spec.ts
```
