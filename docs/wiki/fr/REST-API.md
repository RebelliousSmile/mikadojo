# API REST

Le serveur expose une API REST JSON sous le préfixe `/api/`.

## Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/graphs` | Lister tous les graphes avec leurs données complètes |
| `POST` | `/api/graphs/:name/nodes/:id/status` | Mettre à jour le statut d'un nœud |
| `POST` | `/api/graphs/:name/nodes/:id/assign` | S'auto-assigner un nœud (phase de développement uniquement) |
| `POST` | `/api/graphs/:name/nodes/:id/unassign` | Libérer l'assignation d'un nœud |
| `GET` | `/api/me` | Obtenir le nom d'utilisateur GitHub courant |
| `GET` | `/api/last-change` | Horodatage du dernier changement (utilisé pour le polling) |

## Détails

### `GET /api/graphs`

Retourne un tableau d'objets graphe. Chaque graphe inclut ses métadonnées et tous ses nœuds.

### `POST /api/graphs/:name/nodes/:id/status`

Corps de la requête :

```json
{ "status": "done" }
```

Valeurs de statut valides : `todo`, `doing`, `in-progress`, `blocked`, `done`.

### `POST /api/graphs/:name/nodes/:id/assign`

Assigne le nœud à l'utilisateur courant (identifié via le CLI `gh`). Le graphe doit être en phase de **développement** et le nœud doit être actionnable.

### `POST /api/graphs/:name/nodes/:id/unassign`

Libère l'assignation de l'utilisateur courant sur le nœud.

### `GET /api/me`

Retourne :

```json
{ "login": "alice" }
```

Nécessite que le CLI `gh` soit authentifié (`gh auth login`).

### `GET /api/last-change`

Retourne :

```json
{ "timestamp": 1710000000000 }
```

L'interface web interroge cet endpoint toutes les 3 secondes pour détecter les changements et rafraîchir le tableau.
