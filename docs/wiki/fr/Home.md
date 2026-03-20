# Mikadojo Wiki

Bienvenue sur le wiki **Mikadojo** — un tableau Mikado/Kanban collaboratif pour les équipes de développement.

## Qu'est-ce que Mikadojo ?

Mikadojo combine trois idées puissantes :

- **Tableau Kanban** — visualisez votre travail sous forme de cartes dans des colonnes (à faire / en cours / terminé)
- **Méthode Mikado** — décomposez des objectifs complexes en graphes de dépendances, travaillez de bas en haut sur les tâches feuilles
- **MCP (Model Context Protocol)** — les agents IA (Claude Code) peuvent lire et mettre à jour le tableau via des outils structurés

Le résultat est un outil où une équipe et ses agents IA partagent une seule source de vérité pour la décomposition des tâches, l'assignation et le suivi de la progression — tout cela sauvegardé dans Git.

## Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| **Vues Kanban + Graphe** | Visualisez votre graphe Mikado comme un tableau Kanban ou un graphe de dépendances (D3/Dagre) |
| **Serveur MCP** | Les agents IA (Claude Code) peuvent créer des graphes, ajouter des nœuds et mettre à jour les statuts via les outils MCP |
| **Collaboration d'équipe** | Phases de conception et de développement, auto-assignation, intégration GitHub Issues |
| **Synchronisation Git** | Chaque modification est auto-commitée et poussée ; un pull périodique maintient toutes les instances à jour |
| **Stockage YAML multi-fichiers** | Un fichier par nœud — conflits de fusion minimaux |

## Liens rapides

| Page | Description |
|------|-------------|
| [Installation](fr/Installation) | Prérequis, étapes d'installation et démarrage du serveur |
| [Architecture](fr/Architecture) | Architecture du serveur et vue d'ensemble des composants |
| [Team-Workflow](fr/Team-Workflow) | Modèle de déploiement, phases et workflow typique de l'équipe |
| [Storage-Format](fr/Storage-Format) | Structure des répertoires YAML et description des champs |
| [REST-API](fr/REST-API) | Endpoints HTTP exposés par le serveur |
| [MCP-Tools](fr/MCP-Tools) | Outils et ressources MCP disponibles pour les agents IA |
| [Configuration](fr/Configuration) | Variables d'environnement |
| [Running-Tests](fr/Running-Tests) | Comment exécuter les tests unitaires et E2E |
| [Troubleshooting](fr/Troubleshooting) | Problèmes courants et solutions |

## Dépôt

[https://github.com/RebelliousSmile/mikadojo](https://github.com/RebelliousSmile/mikadojo)
