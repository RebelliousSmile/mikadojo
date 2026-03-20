# Dépannage

## Le port 3100 est déjà utilisé

Un autre processus occupe le port 3100. Trouvez-le et arrêtez-le :

```bash
# Sur Linux/macOS
lsof -i :3100
kill <PID>

# Sur Windows
netstat -ano | findstr :3100
taskkill /PID <PID> /F
```

Alternativement, démarrez Mikadojo sur un port différent :

```bash
PORT=4000 node dist/index.js
```

Et mettez à jour votre `.mcp.json` pour utiliser `http://localhost:4000/mcp`.

## Claude Code ne voit pas les outils kanban

1. Vérifiez que le serveur MCP est en cours d'exécution — ouvrez `http://localhost:3100/mcp` dans votre navigateur. Vous devriez obtenir une réponse JSON.
2. Vérifiez que `.mcp.json` contient la bonne URL et `type: "http"` :
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
3. Redémarrez votre session Claude Code après avoir ajouté ou modifié la configuration.
4. Si vous utilisez la configuration globale (`~/.claude.json`), assurez-vous que le fichier est un JSON valide.

## Problèmes de chemins sur Windows

Utilisez des **barres obliques** (forward slashes) dans les arguments des outils MCP (ex. : `C:/Users/alice/mon-projet`). Le serveur normalise les chemins en interne, mais les barres obliques inverses dans les chaînes JSON peuvent causer des erreurs d'analyse.

## Les GitHub Issues ne sont pas créées

L'intégration GitHub Issues nécessite le CLI `gh` :

1. Installez le [GitHub CLI](https://cli.github.com/).
2. Authentifiez-vous : `gh auth login`.
3. Assurez-vous que la section `github` est présente dans `_meta.yaml` pour votre graphe :
   ```yaml
   github:
     owner: mon-org
     repo: mon-repo
   ```

## Les modifications n'apparaissent pas pour les autres développeurs

- La synchronisation Git s'exécute toutes les 30 secondes par défaut. Attendez le prochain cycle de pull, ou déclenchez un `git pull` manuel dans le répertoire `mikado/`.
- Assurez-vous que tous les développeurs ont un accès en push vers le dépôt distant partagé et que leurs dépôts locaux pointent vers la même URL.
