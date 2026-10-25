# Playwright Framework

A reusable TypeScript package for Playwright Page Objects and fixtures,
with an LLM provider and XPath generation from a DOM snapshot using `SelfHealer`.
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
The build also runs `copy-prompts.cjs` to copy `src/prompts/` into
`dist/prompts/`, so the prompt templates are included in the package archive.

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

The package also exports `createPageRegistry`, `buildPageFixtures`,
`pageFixture`, `PageInstances`, `PagesFromModule`, `PageConstructor`, and `PageRegistry`.

`createPageRegistry(absolutePagesPath)` discovers exported classes extending
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

`src/llm/llm.ts` defines the contract used to generate text:

```ts
export interface LLM {
  generate(prompt: string): Promise<string>;
}
```

`src/llm/openai-llm.ts` implements this interface using the `openai` SDK,
which is installed with the framework dependencies. The current provider
connects to NVIDIA's OpenAI-compatible endpoint at
`https://integrate.api.nvidia.com/v1` and defaults to the model
`openai/gpt-oss-20b`. Pass a model identifier to the constructor to select
another model supported by that endpoint.

The request uses `temperature: 1`, `top_p: 1`, `max_tokens: 4096`, and
`stream: true`. `generate()` collects each chunk's `delta.content` and resolves
with the complete text. It does not expose chunks to the caller or include
`reasoning_content` in the returned text. API errors reject the promise.

### Run from the framework sources

Create `llm-example.ts` in the package root:

```ts
import { OpenAILLM } from "./src/llm/openai-llm";
import type { LLM } from "./src/llm/llm";

async function main(): Promise<void> {
  const llm: LLM = new OpenAILLM();
  const response = await llm.generate(
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

Set the `NVIDIA_API_KEY` environment variable before creating `OpenAILLM`.
The constructor throws if the variable is missing. For example, in PowerShell:

```powershell
$env:NVIDIA_API_KEY = "your-api-key"
npx tsx llm-example.ts
```

The endpoint and request parameters are defined inside the provider;
only the model is a constructor argument.

### Use in a Playwright test

For a test located in `tests/` inside the framework repository:

```ts
import { test, expect } from "@playwright/test";
import { OpenAILLM } from "../src/llm/openai-llm";
import type { LLM } from "../src/llm/llm";

const testWithLLM = test.extend<{ llm: LLM }>({
  llm: async ({}, use) => {
    await use(new OpenAILLM());
  },
});

testWithLLM("generates sample text", async ({ llm }) => {
  const text = await llm.generate("Write a short fictional product description.");
  expect(text.trim().length).toBeGreaterThan(0);
});
```

This fixture makes a live API request when the test calls `generate()`.
The existing Page Object fixtures still construct pages with a single
Playwright `Page` argument; they do not inject an LLM automatically.
For tests that only need to exercise application behavior, a deterministic
implementation can satisfy the same interface:

```ts
const llm: LLM = {
  async generate(_prompt: string): Promise<string> {
    return "Fictional product description for a test.";
  },
};
```

### Package availability

`OpenAILLM`, `SelfHealer`, and the `LLM` type are exported from the package
entry point. After building and installing the package, a consuming project
can import them directly:

```ts
import { OpenAILLM, SelfHealer } from "@automation/framework";
import type { LLM } from "@automation/framework";
```

Keep import casing aligned with filenames; Linux CI treats differently cased
paths as distinct files.

### Naming conventions

- Use English names for classes, interfaces, methods, parameters, and variables.
- Use `kebab-case` for TypeScript filenames and module directories, such as
  `base-page.ts`, `openai-llm.ts`, and `self-healing/`.
- Use `PascalCase` for classes, interfaces, and type aliases. Existing acronyms
  `LLM` and `OpenAILLM` are retained.
- Use `camelCase` for methods, functions, properties, and local variables.

Migration: replace `generer` with `generate`, `chargerTemplate` with
`loadTemplate`, and `creerPageRegistry` with `createPageRegistry`. These public
API renames require updating consuming projects. Source imports must also use
the renamed files; package entry point imports keep the existing class names.

## XPath generation with SelfHealer

`SelfHealer` accepts an implementation of `LLM` and a DOM snapshot as a
`string`. Its `getXpath(elementDescription: string): Promise<string>` method
asks the LLM to locate the described element and returns the trimmed response.

In a consuming project's Playwright test:

```ts
import { test, expect } from "@playwright/test";
import { OpenAILLM, SelfHealer } from "@automation/framework";

test("find the login button from the DOM", async ({ page }) => {
  // Configure baseURL in Playwright and open the page before taking its snapshot.
  await page.goto("/login");
  const dom = await page.content();
  const selfHealer = new SelfHealer(new OpenAILLM(), dom);

  const xpath = await selfHealer.getXpath("Le bouton Connexion");
  const button = page.locator(`xpath=${xpath}`);
  await expect(button).toHaveCount(1);
  await button.click();
});
```

The DOM remains the string supplied to the constructor. Create another
`SelfHealer` with a fresh snapshot when the page changes. The class does not
retry failed locators or perform browser actions automatically. It does not
validate XPath syntax or count matching elements; the caller should validate
the generated locator before using it, as shown above.

### Prompt and template loading

`src/prompts/find-element.txt` contains the instructions and the placeholders
`{{ELEMENT_DESCRIPTION}}` and `{{DOM}}`. `SelfHealer` replaces these with the
description and DOM without interpreting replacement characters in either value.
The prompt requests a single XPath 1.0 expression, prefers stable attributes,
and asks the model to return `NOT_FOUND` or `AMBIGUOUS` when appropriate.

The internal `TemplateLoader.loadTemplate()` method reads the UTF-8 template
relative to its module directory, independently of the current working directory.
Its static promise caches the read across instances and concurrent calls. If
the read fails, it clears the cache and propagates the error, allowing the next
call to retry. After a successful read, template edits require restarting the
process to refresh the cache. `TemplateLoader` is not exported from the package
entry point.

### Errors and testing without an API call

`getXpath()` rejects its promise when:

- The element description is empty or contains only whitespace.
- The template cannot be read or the LLM request fails.
- The trimmed response is `NOT_FOUND` or `AMBIGUOUS`.
- The trimmed response is empty, contains a carriage return or newline, or
  contains a Markdown code fence (three backticks).

Other responses are returned as strings; these checks do not guarantee a valid
XPath. Handle failures with `try`/`catch` in the consuming application as needed.

To exercise prompt construction and response handling without a live API request,
inject a deterministic implementation:

```ts
import { SelfHealer } from "@automation/framework";
import type { LLM } from "@automation/framework";

const llm: LLM = {
  async generate(_prompt: string): Promise<string> {
    return "//button[@id='login']";
  },
};

const selfHealer = new SelfHealer(
  llm,
  '<button id="login">Connexion</button>',
);
const xpath = await selfHealer.getXpath("Le bouton Connexion");
```

## Logging

`ConsoleLogger` implements the exported `Logger` interface with `debug`, `info`,
`warn`, and `error` methods. Its minimum level defaults to `info`; use `silent`
to disable output. Messages include a UTC timestamp, level, and scope.

```ts
import { ConsoleLogger, OpenAILLM, SelfHealer } from "@automation/framework";

const logger = new ConsoleLogger("debug", "LoginTest");
const healer = new SelfHealer(new OpenAILLM(), dom, logger);
logger.info("Starting element lookup.");
const xpath = await healer.getXpath("Login button");
```

Here `dom` is the HTML string captured by the caller. `SelfHealer` accepts an
optional third constructor argument implementing `Logger`. By default it uses
an `info` console logger scoped to `SelfHealer`. It logs progress, response
failures, and template/API failures without printing the DOM, prompt, generated
XPath, or API key. Original errors are propagated to the caller. Inject your own
`Logger` to route messages to another destination.

### Playwright API logs

To display Playwright API calls alongside framework logs, enable `pw:api`
before starting the tests in the consuming project. In PowerShell:

```powershell
$env:DEBUG = "pw:api"
npx playwright test
```

This enables Playwright's own API diagnostics, including action progress and
waiting details. It is independent of the `ConsoleLogger` level. To disable it
for subsequent commands in the same terminal:

```powershell
Remove-Item Env:DEBUG
```

If `DEBUG` already contains other namespaces, append `,pw:api` to its value
instead of replacing it, and restore the previous value afterward.

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

Commit `src/`, `copy-prompts.cjs`, `generate-page-types.cjs`, `package.json`, `package-lock.json`,
`tsconfig.json`, `.gitignore`, and this README. Compiled files are included
in the npm package archive but are not tracked in Git.
