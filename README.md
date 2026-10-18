# Playwright Framework

A reusable TypeScript package for Playwright Page Objects and fixtures.
It is independent of the application under test.

## Installation and build

From the package root in a standalone repository:

```sh
npm ci
npm run typecheck
npm run build
```

In the existing development workspace, install dependencies at the workspace
root and run `npm run build` from there.

Edit the files in `src/`. The `dist/` directory contains compiled JavaScript
and TypeScript declarations. It is generated automatically and ignored by Git.

## Usage

Build the framework, then create a package archive with `npm pack`. Install
that archive in your automation project, along with `@playwright/test`.

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

The package also exports `creerPageRegistry`, `buildPageFixtures`,
`pageFixture`, `PageInstances`, `PagesFromModule`, `PageConstructor`, and `PageRegistry`.

`creerPageRegistry(absolutePagesPath)` discovers exported classes extending
`BasePage` in `.ts` files directly inside the specified directory.
The exported name `LoginPage` becomes the fixture name `loginPage`.
Discovery runs using the TypeScript loading support provided by Playwright.

To generate types from the consuming project:

```sh
node -e "require('@automation/framework/generate-page-types')('pages', 'generated/page-registry.generated.ts')"
```

Paths are relative to the current working directory. The generated file belongs
to the consuming project and provides types for the discovered registry. Run
generation again after adding or removing a page file, before type checking
and running tests.

## GitHub

Commit `src/`, `generate-page-types.cjs`, `package.json`, `package-lock.json`,
`tsconfig.json`, `.gitignore`, and this README. Compiled files are included
in the npm package archive but are not tracked in Git.
