# Framework Playwright

Package TypeScript réutilisable pour les Page Objects et les fixtures Playwright.
Il ne dépend d’aucune application testée.

## Installation et compilation

Depuis la racine de ce package, dans un dépôt autonome :

```sh
npm ci
npm run typecheck
npm run build
```

Dans le workspace de développement existant, installer les dépendances à la
racine du workspace et lancer `npm run build` depuis cette racine.

Modifier les fichiers dans `src/`. `dist/` contient le JavaScript compilé et
les déclarations TypeScript ; il est généré et ignoré par Git.

## Utilisation

Compiler puis créer une archive avec `npm pack`. Installer cette archive dans
le projet d’automatisation, ainsi que `@playwright/test`.

```ts
import { BasePage } from "@automation/framework";

export class LoginPage extends BasePage {
  async login(username: string, password: string): Promise<void> {
    await this.page.getByPlaceholder("Username").fill(username);
    await this.page.getByPlaceholder("Password").fill(password);
    await this.page.getByRole("button", { name: "Login", exact: true }).click();
  }
}
```

Le package exporte également `creerPageRegistry`, `buildPageFixtures`,
`pageFixture`, `PageInstances`, `PagesFromModule`, `PageConstructor` et `PageRegistry`.

`creerPageRegistry(cheminAbsoluDesPages)` découvre les classes exportées héritant
de `BasePage`, dans les fichiers `.ts` directement dans le dossier indiqué.
Le nom exporté `LoginPage` devient la fixture `loginPage`.
Cette découverte s’exécute avec le chargement TypeScript fourni par Playwright.

Pour générer les types depuis le projet consommateur :

```sh
node -e "require('@automation/framework/generate-page-types')('pages', 'generated/page-registry.generated.ts')"
```

Les chemins sont relatifs au dossier courant. Le fichier généré appartient au
projet consommateur et permet de typer le registre découvert. Relancer la
génération après ajout ou suppression d’un fichier de pages, avant le typage
et l’exécution des tests.

## GitHub

Versionner `src/`, `generate-page-types.cjs`, `package.json`, `package-lock.json`,
`tsconfig.json`, `.gitignore` et ce README. Les fichiers compilés sont inclus
dans l’archive npm, sans être versionnés dans Git.
