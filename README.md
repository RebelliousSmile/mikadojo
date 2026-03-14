# Mikado Kanban View

A tiny local app to render a Mikado graph JSON into a Kanban board with dependencies.

## Usage

### Auto-load with symlink (recommended)

1. Create a symlink named `mikado` inside this folder that points to your JSON directory.
2. Run the local server.
3. Open http://localhost:5173 and it auto-loads all JSON files as tabs.

Example (PowerShell):

```powershell
New-Item -ItemType SymbolicLink -Path .\mikado -Target ..\docs\mikado
node .\server.js
```

### Manual load

1. Open `index.html` in a browser.
2. Click **Load JSON files** and select multiple Mikado JSON files.
   - In Chromium-based browsers you can pick a folder and it will load all JSON files inside.

## Notes

- Dependencies are listed on each card.
- Unmet dependencies are highlighted in orange.
- Each JSON file becomes a tab.
- Auto-load uses `server.js` and reads JSON from the `mikado` symlink.
