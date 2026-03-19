# Outils MCP

Mikadojo expose un serveur MCP (Model Context Protocol) à l'adresse `http://localhost:3100/mcp`. Les agents IA tels que Claude Code peuvent s'y connecter et utiliser les outils ci-dessous.

## Configuration

### Au niveau du projet (`.mcp.json` à la racine du dépôt)

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

### Configuration globale (`~/.claude.json`)

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

Redémarrez Claude Code après avoir ajouté la configuration. Le serveur MCP doit être en cours d'exécution pour que la connexion réussisse.

## Outils de gestion des graphes

| Outil | Description |
|-------|-------------|
| `list_graphs` | Lister tous les noms de graphes Mikado disponibles |
| `get_graph` | Obtenir les données complètes d'un graphe Mikado |
| `create_graph` | Créer un nouveau graphe avec un nœud racine |
| `delete_graph` | Supprimer un graphe |
| `lock_graph` | Verrouiller un graphe de la phase de conception à la phase de développement |
| `unlock_subtree` | Déverrouiller un sous-arbre vers la phase de conception |

## Outils de gestion des nœuds

| Outil | Description |
|-------|-------------|
| `get_node` | Obtenir un nœud spécifique d'un graphe |
| `add_node` | Ajouter un nouveau nœud à un graphe (phase de conception uniquement) |
| `update_node` | Mettre à jour les champs d'un nœud existant |
| `delete_node` | Supprimer un nœud et nettoyer les références (phase de conception uniquement) |
| `update_node_status` | Changer le statut d'un nœud (`todo`, `doing`, `in-progress`, `blocked`, `done`) |
| `get_actionable_nodes` | Obtenir les nœuds dont toutes les dépendances sont terminées et qui ne sont pas terminés eux-mêmes |
| `get_current_user` | Obtenir le nom d'utilisateur GitHub de l'utilisateur courant |

## Outils d'interaction avec les dépôts

| Outil | Description |
|-------|-------------|
| `register_repo` | Enregistrer un dépôt externe par nom et chemin absolu |
| `list_repos` | Lister tous les dépôts enregistrés |
| `read_repo_directory` | Lister les fichiers et sous-répertoires d'un dépôt (supporte le listing récursif) |
| `read_repo_file` | Lire le contenu d'un fichier dans un dépôt enregistré |

## Ressources MCP disponibles

| URI | Description |
|-----|-------------|
| `mikado://graphs` | Liste des noms de graphes |
| `mikado://graphs/{graphName}` | Données complètes d'un graphe |
| `mikado://graphs/{graphName}/nodes/{nodeId}` | Données d'un seul nœud |
| `mikado://repos` | Dépôts enregistrés |
| `mikado://schema` | Schéma JSON décrivant la structure des graphes et nœuds |
| `mikado://guide` | Guide d'utilisation pour les agents IA |

## Exemples d'utilisation

### Créer un graphe

```
create_graph(
  graphName: "deployer-webapp",
  goal: "Déployer l'application web en production",
  rootNodeId: "deployer-webapp",
  rootDescription: "Déployer l'application web en production"
)
```

### Ajouter des nœuds avec dépendances

```
add_node(graphName: "deployer-webapp", nodeId: "setup-ci",
         description: "Configurer le pipeline CI", depends_on: [])

add_node(graphName: "deployer-webapp", nodeId: "ecrire-tests",
         description: "Écrire les tests unitaires", depends_on: [])

add_node(graphName: "deployer-webapp", nodeId: "setup-staging",
         description: "Configurer l'environnement de staging",
         depends_on: ["setup-ci", "ecrire-tests"])

update_node(graphName: "deployer-webapp", nodeId: "deployer-webapp",
            depends_on: ["setup-staging"])
```

### Obtenir les nœuds actionnables

```
get_actionable_nodes(graphName: "deployer-webapp")
```

Retourne les nœuds dont toutes les dépendances sont `done` et dont le statut propre n'est pas `done`.
