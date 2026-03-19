# Storage Format

## Overview

Graphs are stored as **YAML directories** inside the `mikado/` folder at the project root. Each graph is a subdirectory, and each node is a separate YAML file within that directory.

## Directory Structure

```
mikado/
  my-project/
    _meta.yaml           # graph-level metadata
    root-node.yaml       # root node
    setup-ci.yaml        # a child node
    write-tests.yaml
    deploy-staging.yaml
```

Node `id` is derived from the filename — there is no `id` field inside the YAML itself.

## `_meta.yaml` Fields

| Field | Description |
|-------|-------------|
| `goal` | Human-readable description of the graph's top-level goal |
| `root` | ID of the root node (matches a filename without `.yaml`) |
| `version` | Schema version (currently `1`) |
| `phase` | `design` or `development` |
| `github` | (optional) GitHub repository info for Issues integration |

Example:

```yaml
goal: Deploy web app to production
root: deploy-webapp
version: 1
phase: development
github:
  owner: my-org
  repo: my-repo
```

## Node File Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | What this node represents |
| `status` | string | `todo`, `doing`, `in-progress`, `blocked`, or `done` |
| `depends_on` | list | IDs of nodes that must be `done` before this one is actionable |
| `assignee` | string | GitHub username of the developer who took this node |
| `issue_number` | number | GitHub Issue number linked to this node |

Example (`setup-ci.yaml`):

```yaml
description: Configure CI pipeline
status: todo
depends_on: []
```

Example with assignment (`deploy-staging.yaml`):

```yaml
description: Set up staging environment
status: doing
depends_on:
  - setup-ci
  - write-tests
assignee: alice
issue_number: 42
```

## Complete Example

```
mikado/
  deploy-webapp/
    _meta.yaml
    deploy-webapp.yaml   # root node
    setup-ci.yaml
    write-tests.yaml
    setup-staging.yaml
```

`_meta.yaml`:
```yaml
goal: Deploy web app to production
root: deploy-webapp
version: 1
phase: development
```

`deploy-webapp.yaml`:
```yaml
description: Deploy web app to production
status: todo
depends_on:
  - setup-staging
```

## Migration from JSON

If you have graphs stored in the legacy JSON format, use the migration script:

```bash
cd mcp-server
npx tsx src/scripts/migrate-json-to-yaml.ts
```

This converts all JSON graph files in `mikado/` to the YAML multi-file format.
