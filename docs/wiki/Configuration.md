# Configuration

Mikadojo is configured through environment variables. All variables have sensible defaults and the server works out of the box without any configuration.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | The port the unified server listens on |
| `MIKADO_DIR` | `<project-root>/mikado` | Absolute or relative path to the directory where graph YAML files are stored |
| `GIT_PULL_INTERVAL` | `30000` | Interval in milliseconds between automatic `git pull` operations (set to `0` to disable) |

## Examples

Run on a different port:

```bash
PORT=4000 node dist/index.js
```

Store graphs in a custom directory:

```bash
MIKADO_DIR=/home/alice/my-graphs node dist/index.js
```

Disable automatic git pull:

```bash
GIT_PULL_INTERVAL=0 node dist/index.js
```
