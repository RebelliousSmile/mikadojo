# Configuration

Mikadojo se configure via des variables d'environnement. Toutes les variables ont des valeurs par défaut sensibles et le serveur fonctionne sans aucune configuration.

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3100` | Le port sur lequel le serveur unifié écoute |
| `MIKADO_DIR` | `<racine-projet>/mikado` | Chemin absolu ou relatif vers le répertoire où les fichiers YAML des graphes sont stockés |
| `GIT_PULL_INTERVAL` | `30000` | Intervalle en millisecondes entre les opérations `git pull` automatiques (mettre à `0` pour désactiver) |

## Exemples

Démarrer sur un port différent :

```bash
PORT=4000 node dist/index.js
```

Stocker les graphes dans un répertoire personnalisé :

```bash
MIKADO_DIR=/home/alice/mes-graphes node dist/index.js
```

Désactiver le git pull automatique :

```bash
GIT_PULL_INTERVAL=0 node dist/index.js
```
