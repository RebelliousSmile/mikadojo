# Troubleshooting

## Port 3100 already in use

Another process is occupying port 3100. Find and stop it:

```bash
# On Linux/macOS
lsof -i :3100
kill <PID>

# On Windows
netstat -ano | findstr :3100
taskkill /PID <PID> /F
```

Alternatively, start Mikadojo on a different port:

```bash
PORT=4000 node dist/index.js
```

And update your `.mcp.json` to use `http://localhost:4000/mcp`.

## Claude Code does not see the kanban tools

1. Verify the MCP server is running — open `http://localhost:3100/mcp` in your browser. You should get a JSON response.
2. Check that `.mcp.json` contains the correct URL and `type: "http"`:
   ```json
   {
     "mcpServers": {
       "kanban": {
         "type": "http",
         "url": "http://localhost:3100/mcp"
       }
     }
   }
   ```
3. Restart your Claude Code session after adding or changing the configuration.
4. If using global config (`~/.claude.json`), make sure the file is valid JSON.

## Path issues on Windows

Use **forward slashes** in MCP tool arguments (e.g., `C:/Users/alice/my-project`). The server normalizes paths internally, but backslashes in JSON strings can cause parsing errors.

## GitHub Issues not being created

The GitHub Issues integration requires the `gh` CLI:

1. Install the [GitHub CLI](https://cli.github.com/).
2. Authenticate: `gh auth login`.
3. Ensure the `github` section is present in `_meta.yaml` for your graph:
   ```yaml
   github:
     owner: my-org
     repo: my-repo
   ```

## Changes not appearing for other developers

- Git sync runs every 30 seconds by default. Wait for the next pull cycle, or trigger a manual `git pull` in the `mikado/` directory.
- Ensure all developers have push access to the shared remote and that their local remotes point to the same URL.
