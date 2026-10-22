# Playwright Framework

A reusable TypeScript package for Playwright Page Objects and fixtures,
with an LLM provider implementation available in the framework sources.
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

## LLM integration

### Interface and provider

`src/llm/Llm.ts` defines the contract used to generate text:

```ts
export interface LLM {
  generer(prompt: string): Promise<string>;
}
```

`src/llm/OpenAILLM.ts` implements this interface using the `openai` SDK,
which is installed with the framework dependencies. The current provider
connects to NVIDIA's OpenAI-compatible endpoint at
`https://integrate.api.nvidia.com/v1` and defaults to the model
`openai/gpt-oss-20b`. Pass a model identifier to the constructor to select
another model supported by that endpoint.

The request uses `temperature: 1`, `top_p: 1`, `max_tokens: 4096`, and
`stream: true`. `generer()` collects each chunk's `delta.content` and resolves
with the complete text. It does not expose chunks to the caller or include
`reasoning_content` in the returned text. API errors reject the promise.

### Run from the framework sources

Create `llm-example.ts` in the package root:

```ts
import { OpenAILLM } from "./src/llm/OpenAILLM";
import type { LLM } from "./src/llm/Llm";

async function main(): Promise<void> {
  const llm: LLM = new OpenAILLM();
  const response = await llm.generer(
    "Generate three fictional product names, one per line.",
  );
  console.log(response);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
```

Run it from the package root:

```sh
npx tsx llm-example.ts
```

The constructor currently reads its API key from a constant inside
`OpenAILLM.ts`. It does not read `NVIDIA_API_KEY` from the environment,
despite the wording of its missing-key error. Configure that constant before
running the example. The endpoint and request parameters are also defined
inside the provider; only the model is a constructor argument.

### Use in a Playwright test

For a test located in `tests/` inside the framework repository:

```ts
import { test, expect } from "@playwright/test";
import { OpenAILLM } from "../src/llm/OpenAILLM";
import type { LLM } from "../src/llm/Llm";

const testWithLLM = test.extend<{ llm: LLM }>({
  llm: async ({}, use) => {
    await use(new OpenAILLM());
  },
});

testWithLLM("generates sample text", async ({ llm }) => {
  const text = await llm.generer("Write a short fictional product description.");
  expect(text.trim().length).toBeGreaterThan(0);
});
```

This fixture makes a live API request when the test calls `generer()`.
The existing Page Object fixtures still construct pages with a single
Playwright `Page` argument; they do not inject an LLM automatically.
For tests that only need to exercise application behavior, a deterministic
implementation can satisfy the same interface:

```ts
const llm: LLM = {
  async generer(_prompt: string): Promise<string> {
    return "Fictional product description for a test.";
  },
};
```

### Package availability

`OpenAILLM` and `LLM` are currently absent from `src/index.ts`, and
`package.json` does not declare an LLM subpath export. The examples above
therefore use relative source imports inside the framework repository.
Before using `import { OpenAILLM } from "@automation/framework"` in a
consuming project, export the class and interface from `src/index.ts`,
then build and publish a new package version.

Keep the import spelling `./Llm` aligned with the Git-tracked filename
`Llm.ts`; Linux CI treats `LLM.ts` and `Llm.ts` as different files.

## GitHub

### Install from a GitHub release

The release workflow builds, checks, and packages the framework on GitHub
when a version tag such as `v1.0.1` is pushed. The tag must match the version
in `package.json`. The `.tgz` package is attached to the GitHub release and
also uploaded as a workflow artifact.

Install the release package in a consuming project:

```sh
npm install https://github.com/OualidUchiha/PlayWrightRobot/releases/download/v1.0.1/automation-framework-1.0.1.tgz
```

For a private repository, authenticated access is required to download the
release asset. The anonymous URL above is intended for a public repository.

To publish a new version, update `package.json` and `package-lock.json`, commit
the changes, then push the matching tag. For the initial version:

```sh
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

Commit `src/`, `generate-page-types.cjs`, `package.json`, `package-lock.json`,
`tsconfig.json`, `.gitignore`, and this README. Compiled files are included
in the npm package archive but are not tracked in Git.
