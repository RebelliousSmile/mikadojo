# Format de stockage

## Vue d'ensemble

Les graphes sont stockés sous forme de **répertoires YAML** dans le dossier `mikado/` à la racine du projet. Chaque graphe est un sous-répertoire, et chaque nœud est un fichier YAML distinct dans ce répertoire.

## Structure des répertoires

```
mikado/
  mon-projet/
    _meta.yaml           # métadonnées au niveau du graphe
    noeud-racine.yaml    # nœud racine
    setup-ci.yaml        # un nœud enfant
    ecrire-tests.yaml
    deployer-staging.yaml
```

L'`id` du nœud est dérivé du nom de fichier — il n'y a pas de champ `id` dans le YAML lui-même.

## Champs de `_meta.yaml`

| Champ | Description |
|-------|-------------|
| `goal` | Description lisible par l'humain de l'objectif de haut niveau du graphe |
| `root` | ID du nœud racine (correspond à un nom de fichier sans `.yaml`) |
| `version` | Version du schéma (actuellement `1`) |
| `phase` | `design` ou `development` |
| `github` | (optionnel) Informations sur le dépôt GitHub pour l'intégration Issues |

Exemple :

```yaml
goal: Déployer l'application web en production
root: deployer-webapp
version: 1
phase: development
github:
  owner: mon-org
  repo: mon-repo
```

## Champs des fichiers nœuds

| Champ | Type | Description |
|-------|------|-------------|
| `description` | chaîne | Ce que représente ce nœud |
| `status` | chaîne | `todo`, `doing`, `in-progress`, `blocked` ou `done` |
| `depends_on` | liste | IDs des nœuds qui doivent être `done` avant que celui-ci soit actionnable |
| `assignee` | chaîne | Nom d'utilisateur GitHub du développeur qui a pris ce nœud |
| `issue_number` | nombre | Numéro de la GitHub Issue liée à ce nœud |

Exemple (`setup-ci.yaml`) :

```yaml
description: Configurer le pipeline CI
status: todo
depends_on: []
```

Exemple avec assignation (`deployer-staging.yaml`) :

```yaml
description: Configurer l'environnement de staging
status: doing
depends_on:
  - setup-ci
  - ecrire-tests
assignee: alice
issue_number: 42
```

## Exemple complet

```
mikado/
  deployer-webapp/
    _meta.yaml
    deployer-webapp.yaml   # nœud racine
    setup-ci.yaml
    ecrire-tests.yaml
    setup-staging.yaml
```

`_meta.yaml` :
```yaml
goal: Déployer l'application web en production
root: deployer-webapp
version: 1
phase: development
```

`deployer-webapp.yaml` :
```yaml
description: Déployer l'application web en production
status: todo
depends_on:
  - setup-staging
```

## Migration depuis JSON

Si vous avez des graphes stockés dans l'ancien format JSON, utilisez le script de migration :

```bash
cd mcp-server
npx tsx src/scripts/migrate-json-to-yaml.ts
```

Ce script convertit tous les fichiers de graphe JSON dans `mikado/` vers le format YAML multi-fichiers.
