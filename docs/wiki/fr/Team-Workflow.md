# Workflow d'équipe

## Modèle de déploiement

Chaque développeur fait tourner sa **propre instance Mikadojo** sur sa machine, depuis son propre clone Git. Le CLI `gh` authentifie chaque développeur avec son propre compte GitHub, de sorte que les assignations et les interactions avec les issues sont correctement attribuées.

Il n'y a pas de serveur central — Git est la couche de synchronisation.

## Phases

Un graphe passe par deux phases :

| Phase | Qui | Quoi |
|-------|-----|------|
| **Conception** | Mainteneurs | Décomposer l'objectif, ajouter/supprimer/réorganiser les nœuds. Chaque nœud crée une GitHub Issue. |
| **Développement** | Tous les développeurs | La structure est verrouillée. Les développeurs s'auto-assignent des nœuds et travaillent dessus. |

## Workflow typique

1. Le **mainteneur** crée un graphe et le décompose en nœuds (phase de conception).
2. Le **mainteneur** verrouille le graphe (`lock_graph`) — passage en phase de développement.
3. Le **développeur** ouvre le tableau Kanban, clique sur **Prendre** sur un nœud actionnable — assigne la GitHub Issue à lui-même.
4. Le **développeur** travaille sur la tâche, clique sur **Terminé** — ferme la GitHub Issue.
5. Toutes les modifications sont auto-commitées et poussées. Les autres développeurs voient les mises à jour après leur prochain Git pull (automatique toutes les 30 s).

## Retour en phase de conception

Un mainteneur peut déverrouiller un sous-arbre (`unlock_subtree`) pour le restructurer, **à condition qu'aucun nœud du sous-arbre ne soit actuellement assigné**. Cela suit le principe Mikado : revenir en arrière et redécomposer selon les besoins plutôt que de forcer une structure à moitié terminée.

## Nœuds actionnables

Un nœud est **actionnable** lorsque :
- Toutes ses dépendances ont le statut `done`
- Son propre statut n'est pas `done`

Seuls les nœuds actionnables peuvent être pris (auto-assignés) par les développeurs. Cela impose automatiquement l'ordre d'exécution Mikado de bas en haut.
