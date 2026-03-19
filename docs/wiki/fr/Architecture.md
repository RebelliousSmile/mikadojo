# Architecture

## Vue d'ensemble

Mikadojo fonctionne comme un **unique processus Express** sur le port 3100. Ce serveur unifié gère l'interface web, l'API REST, le protocole MCP, la synchronisation Git, l'intégration GitHub Issues et la surveillance des fichiers — le tout dans un seul processus.

## Schéma d'architecture

```
Navigateur ── HTTP ──────► Serveur unifié (port 3100)
                              ├── Interface web (fichiers statiques)
                              ├── API REST (/api/*)
                              ├── Protocole MCP (/mcp)
                              ├── Sync Git (auto commit/push/pull)
                              ├── GitHub Issues (via gh CLI)
                              └── Observateur de fichiers (chokidar)
                                    │
Claude Code ── MCP (HTTP) ────────┘
```

## Composants

| Composant | Chemin | Description |
|-----------|--------|-------------|
| **Interface web** | `/` | Fichiers HTML/CSS/JS statiques servis directement. Vues tableau Kanban et graphe de dépendances construites avec D3/Dagre. |
| **API REST** | `/api/*` | Endpoints JSON pour lire les graphes, mettre à jour les statuts des nœuds, l'assignation et le polling. Voir [REST-API](REST-API). |
| **Protocole MCP** | `/mcp` | Endpoint MCP basé sur HTTP. Les agents IA (Claude Code) se connectent ici pour utiliser les outils structurés. Voir [MCP-Tools](MCP-Tools). |
| **Sync Git** | — | À chaque écriture, les modifications sont auto-commitées et poussées vers le dépôt distant. Un pull périodique (toutes les 30 s par défaut) maintient la copie locale à jour. |
| **GitHub Issues** | — | Utilise le CLI `gh` pour créer, fermer et assigner des GitHub Issues en synchronisation avec les nœuds du graphe. Nécessite `gh auth login`. |
| **Observateur de fichiers** | — | `chokidar` surveille le répertoire `mikado/` pour détecter les modifications externes (ex. : éditions manuelles, git pulls) et recharge le graphe en mémoire. |

## Choix de conception

- **Port unique** — pas de serveur de développement frontend séparé ni de serveur WebSocket à gérer.
- **YAML par nœud** — chaque nœud est son propre fichier, ce qui minimise les conflits de fusion Git quand plusieurs développeurs travaillent en parallèle.
- **MCP via HTTP** — le transport HTTP standard signifie que Claude Code peut se connecter sans aucun spawn de processus local ni piping stdio.
