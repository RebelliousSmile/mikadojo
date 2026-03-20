# Installation

## Prérequis

| Prérequis | Notes |
|-----------|-------|
| **Node.js 18+** | Requis |
| **pnpm** | Gestionnaire de paquets utilisé par ce projet |
| **GitHub CLI (`gh`)** | Optionnel — requis pour l'intégration GitHub Issues et les fonctionnalités d'équipe (`gh auth login` pour s'authentifier) |

## Installation

```bash
cd mcp-server
pnpm install
pnpm run build
```

L'étape `build` compile le TypeScript vers le répertoire `dist/`.

## Démarrage du serveur

```bash
node dist/index.js
```

Un seul processus sert à la fois l'interface web et le protocole MCP sur le **port 3100**.

Ouvrez [http://localhost:3100](http://localhost:3100) pour accéder au tableau Kanban.

## Mode développement

```bash
cd mcp-server
pnpm run dev
```

Utilise `tsx` en mode watch — aucune étape de compilation nécessaire. Le serveur redémarre automatiquement lorsque les fichiers source changent.

## Accès au tableau Kanban

Une fois le serveur démarré, ouvrez votre navigateur à l'adresse :

```
http://localhost:3100
```

L'interface interroge le serveur toutes les 3 secondes, donc toute modification effectuée via les outils MCP apparaît automatiquement sans rechargement manuel.
