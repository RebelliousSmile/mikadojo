# Plan : MCP Server pour Kanban-View

## Contexte

Le projet kanban-view est un visualiseur Mikado/Kanban local (Node.js + vanilla JS + D3.js). Les graphs sont stockés en JSON dans `mikado/`. Le server.js expose 2 endpoints (list graphs, update status).

**Besoin** : Permettre à des repos externes (ex: `meal-planner`) d'interagir avec le kanban via leurs agents IA (Claude Code) et pouvoir lancer des actions sur ces repos depuis le kanban.

**Décisions prises** :
- MCP server sur l'hôte (pas Docker) — accès direct à claude CLI, gh CLI, filesystem
- Templates d'actions centralisés dans kanban-view + override par repo dans `.mikado/actions/`

---

## Architecture

```
[Repo externe: meal-planner]                [kanban-view]
  Claude Code ──── MCP (SSE) ──────────►  MCP Server (port 3100)
                                             ├── CRUD graphs/nodes
                                             ├── Lecture repos
                                             ├── Exécution actions (claude, gh, shell)
                                             └── Lit/écrit mikado/*.json
                                                    │
  Navigateur ◄──── HTTP ───────────────  server.js (port 5173)
                                             ├── UI Kanban/Graph
                                             ├── API actions (proxy vers MCP ou direct)
                                             └── Lit mikado/*.json
```

Repos configurent le MCP dans `.mcp.json` ou `~/.claude.json` :
```json
{ "mcpServers": { "kanban": { "type": "sse", "url": "http://localhost:3100/sse" } } }
```

---

## Structure du projet

```
kanban-view/
  mcp-server/
    package.json
    tsconfig.json
    src/
      index.ts                    # Entry point, SSE transport
      config.ts                   # Configuration (ports, chemins)
      schemas.ts                  # Zod schemas (graph, node, action)
      data/
        graph-store.ts            # Read/write/list/delete JSON mikado
        repo-registry.ts          # Registre repos (nom → chemin)
      tools/
        graph-tools.ts            # list_graphs, get_graph, create_graph, delete_graph
        node-tools.ts             # get/add/update/delete node, update_status, get_actionable
        action-tools.ts           # execute_action, execute_node_actions, list_templates
        repo-tools.ts             # register_repo, list_repos, read_dir, read_file
      resources/
        graph-resources.ts        # mikado://graphs/*, mikado://graphs/{name}/nodes/{id}
        guide.md                  # Contenu markdown du guide exposé via mikado://guide
      executors/
        claude-executor.ts        # Exécute claude --print
        gh-executor.ts            # Exécute gh ...
        shell-executor.ts         # Exécute commandes shell
    action-templates/             # Templates centralisés
      claude-code-task.json
      gh-pr-create.json
      gh-issue-create.json
      run-tests.json
  mikado/                         # Données graphs (existant)
  server.js                       # Serveur UI (existant, à enrichir)
  app.js                          # Frontend (existant, à enrichir)
  index.html
  styles.css
```

---

## MCP Tools

### Graph Management
| Tool | Params | Description |
|------|--------|-------------|
| `list_graphs` | — | Liste tous les graphs disponibles |
| `get_graph` | `graphName` | Retourne un graph complet |
| `create_graph` | `graphName, goal, rootNodeId, rootDescription` | Crée un nouveau graph |
| `delete_graph` | `graphName` | Supprime un graph |

### Node Management
| Tool | Params | Description |
|------|--------|-------------|
| `get_node` | `graphName, nodeId` | Retourne un noeud |
| `add_node` | `graphName, nodeId, description, status?, depends_on?, notes?, actions?` | Ajoute un noeud |
| `update_node` | `graphName, nodeId, description?, notes?, depends_on?, actions?` | Modifie un noeud |
| `delete_node` | `graphName, nodeId` | Supprime un noeud + nettoie les dépendances |
| `update_node_status` | `graphName, nodeId, status` | Change le statut |
| `get_actionable_nodes` | `graphName` | Liste les noeuds dont toutes les deps sont done |

### Repo Interaction
| Tool | Params | Description |
|------|--------|-------------|
| `register_repo` | `repoName, repoPath` | Enregistre un repo |
| `list_repos` | — | Liste les repos enregistrés |
| `read_repo_directory` | `repoPath, directory, recursive?` | Liste les fichiers d'un dossier |
| `read_repo_file` | `repoPath, filePath` | Lit un fichier d'un repo |

### Actions
| Tool | Params | Description |
|------|--------|-------------|
| `list_action_templates` | — | Liste templates (centralisés + repo) |
| `execute_action` | `repoPath, action` | Exécute une action sur un repo |
| `execute_node_actions` | `graphName, nodeId` | Exécute toutes les actions d'un noeud séquentiellement |

## MCP Resources

| URI | Description |
|-----|-------------|
| `mikado://graphs` | Liste des noms de graphs |
| `mikado://graphs/{graphName}` | Données complètes d'un graph |
| `mikado://graphs/{graphName}/nodes/{nodeId}` | Données d'un noeud |
| `mikado://repos` | Liste des repos enregistrés |
| `mikado://schema` | Schéma complet JSON (graph, node, action, statuts) — doc machine-readable |
| `mikado://guide` | Guide d'utilisation : concepts Mikado, workflows, conventions, exemples |

### Resource guide (`mikado://guide`)

Exposé automatiquement aux agents IA qui se connectent. Contient :
- **Concepts** : qu'est-ce qu'un Mikado graph, notion de root/deps, statuts possibles
- **Workflows** : comment créer un graph, ajouter des noeuds avec dépendances, progression
- **Conventions** : nommage des nodeId (kebab-case), structure des actions
- **Exemples** : scénario complet de création d'un graph pour un projet meal-planner
- **Templates** : liste des templates d'actions disponibles avec leurs paramètres

Le contenu est un markdown statique dans `mcp-server/src/resources/guide.md`, exposé via la resource MCP.

---

## Extension du schéma Node (champ `actions`)

```json
{
  "id": "migration-recettes",
  "description": "Migrer les recettes vers Firestore",
  "status": "todo",
  "depends_on": ["schema-db"],
  "notes": "",
  "actions": [
    {
      "id": "gen-migration",
      "type": "claude-code",
      "label": "Générer le script de migration",
      "config": {
        "cwd": "C:/dev-perso/meal-planner",
        "prompt": "Crée un script de migration pour la table recettes vers Firestore"
      },
      "status": "pending",
      "result": null
    },
    {
      "id": "create-pr",
      "type": "gh-cli",
      "label": "Créer la PR",
      "config": {
        "cwd": "C:/dev-perso/meal-planner",
        "command": "pr create --title 'Migration recettes' --body '{{prev_result}}'"
      },
      "status": "pending",
      "result": null
    }
  ]
}
```

- `status`: `pending | running | done | failed`
- `{{prev_result}}`: remplacé par le résultat de l'action précédente
- Le champ `actions` est optionnel — les graphs existants restent compatibles

---

## Templates d'actions

### Résolution (merge centralisé + repo)
1. Charger templates depuis `kanban-view/mcp-server/action-templates/*.json`
2. Charger templates depuis `{repoPath}/.mikado/actions/*.json`
3. Les templates repo écrasent les centralisés si même `id`

### Format template
```json
{
  "id": "claude-code-task",
  "type": "claude-code",
  "label": "Exécuter une tâche Claude Code",
  "description": "Lance claude CLI avec un prompt sur le repo cible",
  "config": {
    "prompt": "{{prompt}}",
    "allowedTools": ["Read", "Write", "Bash"]
  }
}
```

### Types d'exécuteurs
- **`claude-code`** : `claude --print -p "<prompt>" --cwd "<cwd>"`
- **`gh-cli`** : `gh <command>` dans le cwd spécifié
- **`shell`** : Commande shell arbitraire dans le cwd
- **`repo-template`** : Charge et exécute un template depuis le repo cible

---

## Fichiers existants à modifier

| Fichier | Modifications |
|---------|--------------|
| `server.js` | Ajouter endpoints : `POST /api/actions/execute`, `GET /api/repos/:name/tree`, file-watch pour auto-refresh |
| `app.js` | Ajouter panneau actions sur les cartes nodes, bouton "Run Actions", status indicators, repo browser |
| `index.html` | Sections UI pour actions et repo browser |

---

## Plan d'implémentation par phases

### Phase 1 — MCP Server Core (CRUD graphs/nodes)
1. Init `mcp-server/` : package.json, tsconfig.json, deps (`@modelcontextprotocol/sdk`, `zod`)
2. `src/config.ts` — configuration
3. `src/schemas.ts` — schémas Zod pour graph/node/action
4. `src/data/graph-store.ts` — lecture/écriture JSON mikado
5. `src/tools/graph-tools.ts` — 4 tools CRUD graph
6. `src/tools/node-tools.ts` — 6 tools CRUD nodes
7. `src/resources/graph-resources.ts` — resources MCP (graphs, nodes, repos, schema)
8. `src/resources/guide.md` — guide markdown exposé via `mikado://guide`
9. `src/index.ts` — SSE transport, registration
10. Test : connecter depuis un repo externe via `.mcp.json`

### Phase 2 — Repo Tools
11. `src/data/repo-registry.ts` — registre persistant (JSON)
12. `src/tools/repo-tools.ts` — register, list, read_dir, read_file
13. Test : lire des fichiers de meal-planner depuis Claude Code

### Phase 3 — Action System
14. `src/executors/claude-executor.ts` — child_process pour claude CLI
15. `src/executors/gh-executor.ts` — child_process pour gh CLI
16. `src/executors/shell-executor.ts` — child_process générique
17. `src/tools/action-tools.ts` — execute_action, execute_node_actions, list_templates
18. Créer templates centralisés dans `action-templates/`
19. Gestion du `{{prev_result}}` entre actions séquentielles
20. Stockage des résultats d'actions dans le JSON du node

### Phase 4 — Enrichissement Frontend
21. Enrichir `server.js` avec les endpoints actions + file-watch
22. Ajouter panneau actions dans les cartes node (`app.js`)
23. Bouton "Run Actions" + polling status
24. Affichage résultats d'actions
25. Auto-refresh UI quand les JSON changent

---

## Vérification

1. **CRUD via MCP** : Depuis `meal-planner/` avec Claude Code, créer un graph, ajouter des noeuds, changer des statuts → vérifier dans le kanban viewer
2. **Lecture repo** : Depuis Claude Code, appeler `read_repo_directory` sur meal-planner → vérifier le retour
3. **Actions** : Depuis le kanban viewer, lancer une action claude-code sur meal-planner → vérifier l'exécution
4. **Templates** : Créer un template dans `meal-planner/.mikado/actions/` → vérifier qu'il apparaît dans `list_action_templates`
5. **Chainage** : Exécuter `execute_node_actions` sur un noeud avec 2 actions → vérifier que `{{prev_result}}` est substitué
6. **Guide** : Depuis Claude Code, lire `mikado://guide` → vérifier que le contenu markdown est retourné

---

## Work in Progress

### Statut actuel : Toutes les phases complétées

| Phase | Statut | Détails |
|-------|--------|---------|
| Phase 1 — MCP Server Core | `done` | CRUD graphs/nodes, resources, SSE transport — compilé OK |
| Phase 2 — Repo Tools | `done` | Registre repos, lecture fichiers/dossiers — compilé OK |
| Phase 3 — Action System | `done` | Exécuteurs (claude, gh, shell), templates, chainage — compilé OK |
| Phase 4 — Frontend | `done` | UI actions, auto-refresh, run-actions — serveur OK |

### Phase 1 — Livrables complétés
- [x] `mcp-server/package.json` + `tsconfig.json` — init projet, deps (MCP SDK, express, zod, typescript)
- [x] `src/config.ts` — MCP_PORT=3100, MIKADO_DIR, STATUS_OPTIONS
- [x] `src/schemas.ts` — Zod schemas (NodeStatus, ActionStatus, ActionConfig, Action, Node, Graph)
- [x] `src/data/graph-store.ts` — listGraphs, readGraph, writeGraph, deleteGraph, graphExists
- [x] `src/tools/graph-tools.ts` — 4 tools CRUD graph (list, get, create, delete)
- [x] `src/tools/node-tools.ts` — 6 tools CRUD nodes (get, add, update, delete, update_status, get_actionable)
- [x] `src/resources/graph-resources.ts` — 5 resources MCP (graphs, graph, node, schema, guide)
- [x] `src/resources/guide.md` — Guide markdown (concepts, workflow, conventions, exemples)
- [x] `src/index.ts` — Entry point SSE transport Express multi-session
- [x] `npm install` + `npm run build` — 0 erreurs TypeScript

### Phase 2 — Livrables complétés
- [x] `src/config.ts` — ajout REPO_REGISTRY_PATH
- [x] `src/data/repo-registry.ts` — registre persistant JSON (register, list, get, remove)
- [x] `src/tools/repo-tools.ts` — 4 tools (register_repo, list_repos, read_repo_directory, read_repo_file)
- [x] `src/resources/graph-resources.ts` — ajout resource `mikado://repos`
- [x] `src/index.ts` — wiring registerRepoTools
- [x] `npm run build` — 0 erreurs TypeScript

### Phase 3 — Livrables complétés
- [x] `src/executors/shell-executor.ts` — exécuteur shell générique (cross-platform)
- [x] `src/executors/claude-executor.ts` — exécuteur claude CLI (`claude --print`)
- [x] `src/executors/gh-executor.ts` — exécuteur gh CLI
- [x] `src/tools/action-tools.ts` — 3 tools (list_action_templates, execute_action, execute_node_actions)
- [x] `action-templates/` — 4 templates (claude-code-task, gh-pr-create, gh-issue-create, run-tests)
- [x] `src/config.ts` — ajout ACTION_TEMPLATES_DIR
- [x] `src/index.ts` — wiring registerActionTools
- [x] `{{prev_result}}` substitution entre actions séquentielles
- [x] Sauvegarde status/result des actions dans le graph JSON
- [x] `npm run build` — 0 erreurs TypeScript

### Phase 4 — Livrables complétés
- [x] `server.js` — endpoints `POST /api/actions/execute`, `POST /api/graphs/:name/nodes/:id/run-actions`, `GET /api/last-change`
- [x] `server.js` — file-watch sur mikado/ pour détecter les changements JSON
- [x] `app.js` — panneau actions sur les cartes node (icônes statut, labels, types)
- [x] `app.js` — bouton "Run All" pour exécuter les actions d'un noeud séquentiellement
- [x] `app.js` — affichage résultats d'actions (toggle, pre-formatted, truncated)
- [x] `app.js` — auto-refresh polling toutes les 3s via `/api/last-change`
- [x] `app.js` — `{{prev_result}}` substitution côté serveur
- [x] `styles.css` — styles action-panel, action-item, action-run-btn, action-result
- [x] server.js démarre sans erreurs

### Prochaines étapes
- Aucune — toutes les phases sont complétées
- Tests manuels recommandés (voir section Vérification)

### Décisions prises
- Architecture : MCP server sur l'hôte (pas Docker)
- Templates : centralisés dans kanban-view + override par repo dans `.mikado/actions/`
- Documentation : resources `mikado://schema` et `mikado://guide` exposées aux agents
- SSE transport : Express + Map<sessionId, SSEServerTransport> pour multi-clients
- graph-store : unwrap/wrap automatique du format `{ mikado_graph: ... }`
- ResourceTemplate pour les resources paramétrées (graphName, nodeId)

### Questions ouvertes
- Aucune pour l'instant
