# Exécution des tests

## Tests unitaires (Vitest)

Le serveur MCP dispose d'une suite de tests unitaires propulsés par [Vitest](https://vitest.dev/).

```bash
cd mcp-server
pnpm run test
```

Cela exécute tous les tests en mode watch. Pour exécuter une seule fois sans surveiller :

```bash
cd mcp-server
pnpm run test --run
```

## Tests E2E (Playwright)

Les tests de bout en bout pour l'interface web utilisent [Playwright](https://playwright.dev/).

```bash
pnpm exec playwright test
```

À exécuter depuis la **racine du dépôt** (pas dans `mcp-server/`).

Pour exécuter en mode avec interface graphique (navigateur visible) :

```bash
pnpm exec playwright test --headed
```

Pour exécuter un fichier de test spécifique :

```bash
pnpm exec playwright test e2e/kanban.spec.ts
```
