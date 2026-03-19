# Plan : Retrait chirurgical du système d'actions

## Context

Le système d'actions permet d'attacher des opérations exécutables (claude-code, gh-cli, shell) aux nodes d'un graphe Mikado. Emmanuel a confirmé que cette couche rend le projet instable et inachevé. On la retire tout en conservant le MCP server (graph-tools, node-tools, repo-tools, resources) et la visualisation Kanban/Graph.

Les fichiers JSON dans `mikado/` ne sont pas touchés — les `actions` déjà présentes servent d'exemples.

## Fichiers à supprimer (entiers)

| Fichier/Dossier | Raison |
|---|---|
| `mcp-server/src/tools/action-tools.ts` | 5 outils MCP action |
| `mcp-server/src/executors/` (dossier entier) | 3 exécuteurs (claude, gh, shell) |
| `mcp-server/action-templates/` (dossier entier) | 5 templates JSON d'actions |

## Fichiers à modifier

### 1. `mcp-server/src/schemas.ts`
- **Supprimer** : `ActionStatus`, `ActionExecution`, `ActionConfig`, `Action` (lignes 7-30)
- **Modifier** : champ `actions` dans `Node` → `z.array(z.any()).optional()` (préserve la lecture des JSON existants)

### 2. `mcp-server/src/config.ts`
- **Supprimer** : `ACTION_TEMPLATES_DIR` (ligne 10)

### 3. `mcp-server/src/index.ts`
- **Supprimer** : import `registerActionTools` (ligne 7)
- **Supprimer** : appel `registerActionTools(server)` (ligne 17)

### 4. `mcp-server/src/tools/node-tools.ts`
- **Supprimer** : import `ActionExecution, ActionStatus` de `schemas.js` (ligne 4) — garder uniquement `NodeStatus`
- **Supprimer** : définition locale `ActionConfigSchema` + `ActionSchema` (lignes 6-21)
- **Supprimer** dans `add_node` :
  - Paramètre `actions` du schéma (ligne 55)
  - `actions` dans le destructuring callback (ligne 57)
  - `actions: actions` dans l'objet node (ligne 70)
- **Supprimer** dans `update_node` :
  - Paramètre `actions` du schéma (ligne 93)
  - `actions` dans le destructuring callback (ligne 95)
  - `if (actions !== undefined) node.actions = actions;` (ligne 107)

### 5. `mcp-server/src/resources/graph-resources.ts`
- **Supprimer** : bloc `action` dans `SCHEMA_DOC` (lignes 30-43)
- **Supprimer** : `actions: "Action[] (optional)"` dans le node schema doc (ligne 26)
- **Modifier** : description resource `schema` (ligne 129) → `"JSON schema describing graph and node structure"`

### 6. `mcp-server/src/resources/guide.md`
- **Supprimer** : sections "Action Types" et "Execution Model" (lignes 56-83)

### 7. `mcp-server/README.md`
- **Modifier** : description du projet (ligne 3) — retirer "execute actions"
- **Supprimer** : prérequis Claude Code CLI et GitHub CLI (lignes 22-23)
- **Supprimer** : "Action Templates" du sommaire (ligne 14)
- **Modifier** : nombre de tools "19" → "14" (ligne 107)
- **Supprimer** : table "Actions" (lignes 138-147)
- **Supprimer** : exemples 4 et 5 (lignes 227-287)
- **Supprimer** : section "Execution Model" (lignes 289-321)
- **Supprimer** : section "Action Templates" (lignes 323-368)
- **Modifier** : section "Auto-Refresh" — retirer "running actions" (ligne 372)
- **Modifier** : troubleshooting — retirer entrée "claude/gh not found" (lignes 385-386)

### 8. `server.js`
- **Supprimer** : import `execFile` (ligne 5)
- **Supprimer** : `runShellCommand()` (lignes 128-137)
- **Supprimer** : `executeAction()` (lignes 139-153)
- **Supprimer** : `readBody()` (lignes 155-166) — utilisé uniquement par endpoint actions
- **Supprimer** : endpoint `POST /api/actions/execute` (lignes 189-204)
- **Supprimer** : endpoint `POST /api/graphs/:name/nodes/:id/run-actions` (lignes 206-269)

### 9. `app.js`
- **Supprimer** : `actionStatusIcons` (ligne 17)
- **Supprimer** : bloc conditionnel action panel dans `renderBoard()` (lignes 343-347)
- **Supprimer** : `buildActionPanel()` (lignes 716-829)
- **Supprimer** : `getActionConfigValue()` (lignes 831-847)
- **Supprimer** : `formatActionConfig()` (lignes 849-859)
- **Conserver** : `reloadActiveGraph()` (utilisé par `startAutoRefresh()`)

### 10. `styles.css`
- **Supprimer** : tous les styles `.action-*` (lignes ~495-643)

## Ordre d'exécution

1. Supprimer les fichiers/dossiers entiers (action-tools.ts, executors/, action-templates/)
2. Modifier les fichiers backend MCP (schemas → config → index → node-tools → graph-resources → guide.md → README.md)
3. Modifier `server.js`
4. Modifier `app.js`
5. Modifier `styles.css`
6. Clean build MCP server (`rm -rf dist && pnpm run build`)

## Vérification

- `cd mcp-server && rm -rf dist && pnpm run build` — compilation sans erreur
- `node server.js` — démarrage sans crash
- Ouvrir http://localhost:5173 — cartes Kanban affichées sans panneau d'actions
- Les JSON `mikado/` avec `actions` se chargent normalement (pas de crash de parsing)
