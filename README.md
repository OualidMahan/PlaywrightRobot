# PlaywrightRobot

Reusable TypeScript framework distributed as `@automation/framework`.
Repository: [OualidMahan/PlaywrightRobot](https://github.com/OualidMahan/PlaywrightRobot).

## Use from a consuming project

The framework provides `BasePage`, Page Object fixtures and registry tools,
LLM contracts/providers, `SelfHealer`, prompts and logging. Your test project
owns its Page Objects, scenarios, business assertions, credentials and
Playwright configuration. No application-specific scenario belongs in the framework.

### Requirements and installation

Use Node.js 22 or newer and npm. CI uses Node.js 22; the installed OpenAI SDK
requires Node.js >=22. Install a compatible `@playwright/test` version (`^1.63.0`,
as declared in the framework's peer dependencies), and TypeScript for typed tests.

Download the package from the [latest published release](https://github.com/OualidMahan/PlaywrightRobot/releases/latest).
With [GitHub CLI](https://cli.github.com/) installed and authenticated
(`gh auth login`), run these commands from your test project:

```sh
gh release download --repo OualidMahan/PlaywrightRobot --pattern "automation-framework-*.tgz" --output automation-framework.tgz
npm install ./automation-framework.tgz
npm install --save-dev @playwright/test@^1.63.0 typescript @types/node
npx playwright install chromium
```

Without a tag, `gh release download` selects the latest release. The local filename
is independent of the release version. For a reproducible installation, specify
a published tag after `download` and commit the consumer's lockfile. If the local
archive already exists, move or remove it before downloading another release.
Private releases require an authenticated account with repository access.

A source change is available to consumers only after building and installing
an archive containing it. The latest published release may not yet contain
the options-object constructor documented below; check its release notes.
To try these changes before a future release, run `npm ci`, `npm run build` and
`npm pack` in this framework repository, then install the resulting local archive
in your test project. The version number alone does not prove a release exists.

### Example consumer project

```text
pages/login-page.ts
fixtures/test.ts
tests/login.spec.ts
generated/page-registry.generated.ts   # generated
playwright.config.ts
package.json
tsconfig.json
```

`pages/login-page.ts`:

```ts
import { BasePage } from "@automation/framework";

export class LoginPage extends BasePage {
  async login(username: string, password: string): Promise<void> {
    await this.page.getByLabel("Username").fill(username);
    await this.page.getByLabel("Password").fill(password);
    await this.page.getByRole("button", { name: "Login", exact: true }).click();
  }
}
```

Add these scripts to the consumer's `package.json`:

```json
{
  "scripts": {
    "pages:generate": "node -e \"require('@automation/framework/generate-page-types')('pages', 'generated/page-registry.generated.ts')\"",
    "typecheck": "npm run pages:generate && tsc --noEmit",
    "test": "npm run pages:generate && playwright test"
  }
}
```

Run `npm run pages:generate` before checking types or running tests and after
adding/removing page files. The generated type for this example is:

```ts
import type { PagesFromModule } from "@automation/framework";

export type DiscoveredPages =
  PagesFromModule<typeof import("../pages/login-page")>;
```

`fixtures/test.ts`:

```ts
import { test as base, expect } from "@playwright/test";
import { resolve } from "node:path";
import { buildPageFixtures, createPageRegistry } from "@automation/framework";
import type { PageInstances } from "@automation/framework";
import type { DiscoveredPages } from "../generated/page-registry.generated";

const registry = createPageRegistry(resolve(__dirname, "../pages")) as DiscoveredPages;
export const test = base.extend<PageInstances<DiscoveredPages>>(
  buildPageFixtures(registry),
);
export { expect };
```

`createPageRegistry` discovers exported subclasses of `BasePage` in `.ts` files
directly inside the directory. `LoginPage` becomes `loginPage`; collisions throw
an error. Discovery runs under Playwright's TypeScript loader. Generated types
must match the runtime directory; the type assertion does not validate its contents.
For an explicitly declared registry, `pageFixture(LoginPage)` is also exported.

`tests/login.spec.ts` (adapt the labels, route and expected result to your app):

```ts
import { test, expect } from "../fixtures/test";

test("login", async ({ loginPage, page }) => {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  if (!username || !password) throw new Error("Set TEST_USERNAME and TEST_PASSWORD.");

  await loginPage.openUrl("/login");
  await loginPage.login(username, password);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
```

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
});
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["pages/**/*.ts", "fixtures/**/*.ts", "tests/**/*.ts", "generated/**/*.ts", "playwright.config.ts"]
}
```

This example uses CommonJS (no `"type": "module"` in the consumer package).
Playwright loads the TypeScript files. To run standalone `.ts` examples outside
Playwright, install `tsx` explicitly with `npm install --save-dev tsx`, then use
`npx tsx example.ts`.

### Browser and fixture lifecycle

`BasePage` does not create a browser or `BrowserContext`. Playwright supplies the
`page` fixture. A Page Object fixture constructs its Page Object when that fixture
is used, passing it the Playwright page. Page Objects receiving that same page
share its URL, DOM and browser state. Framework fixtures do not inject an LLM
or create independent pages automatically. Playwright owns page/context cleanup.

## LLM configuration

The public contract stays provider-independent:

```ts
import type { LLM } from "@automation/framework";

const fake: LLM = {
  async generate(_prompt: string): Promise<string> {
    return "//button[@id='login']";
  },
};
```

`OpenAILLM` uses the OpenAI SDK against an OpenAI-compatible endpoint. The new
options type is exported from the package entry point:

```ts
import { OpenAILLM } from "@automation/framework";
import type { OpenAILLMOptions } from "@automation/framework";

const options: OpenAILLMOptions = {
  apiKey: process.env.MY_LLM_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
  model: "openai/gpt-oss-20b",
};
const llm = new OpenAILLM(options);
```

The legacy forms remain supported:

```ts
const defaultProvider = new OpenAILLM();
const selectedModel = new OpenAILLM("model-identifier");
```

Configuration precedence:

| Option | Explicit value | Default when omitted or `undefined` |
| --- | --- | --- |
| `model` | Provided model identifier | `openai/gpt-oss-20b` |
| `baseURL` | Provided absolute HTTP(S) endpoint | `https://integrate.api.nvidia.com/v1` |
| `apiKey` | Provided non-empty key | `NVIDIA_API_KEY`, only for the default NVIDIA endpoint |

A custom endpoint requires an explicit `apiKey`, even if `NVIDIA_API_KEY` is set.
The normalized default URL, including a trailing slash, may use the NVIDIA fallback;
a different protocol, host or path may not. Empty/whitespace values and invalid
types fail rather than silently using defaults. URLs with credentials, query
parameters or fragments are rejected. Values are trimmed. Errors do not include
API keys. The framework never logs keys. For a custom provider:

```ts
const customProvider = new OpenAILLM({
  apiKey: process.env.MY_LLM_API_KEY,
  baseURL: "https://my-provider.example/v1",
  model: "my-model",
});
```

For the legacy NVIDIA configuration in PowerShell:

```powershell
$env:NVIDIA_API_KEY = "your-api-key"
```

No environment file is loaded automatically. `generate()` makes a real API call,
uses `temperature: 1`, `top_p: 1`, `max_tokens: 4096` and streaming, and collects
content chunks into a single string. Reasoning chunks are not returned. API
failures propagate. Custom endpoints/models must support this request format.

## SelfHealer

`SelfHealer` depends only on `LLM`; its DOM argument is a string, not a Playwright
`Page`. Use it in the consumer after capturing the relevant HTML:

```ts
import { ConsoleLogger, SelfHealer } from "@automation/framework";

// Inside a consumer test, with page and llm already configured:
const healer = new SelfHealer(llm, await page.content(), new ConsoleLogger("info"));
const xpath = await healer.getXpath("Login button");
const button = page.locator(`xpath=${xpath}`);
await expect(button).toHaveCount(1);
await button.click();
await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
```

The HTML is a snapshot and is never refreshed automatically. The class generates
a XPath; it does not repair a failed test, retry a locator, or replay an action.
The consumer must check the number of matches and the business result before
considering the action correct. Format checks do not prove valid XPath syntax
or that the selected element is the intended one.

`getXpath()` rejects empty descriptions, `NOT_FOUND`, `AMBIGUOUS`, empty responses,
multiline responses and Markdown code fences. It trims surrounding whitespace.
Template and LLM errors propagate to the caller.

The prompt in `src/prompts/find-element.txt` contains `{{ELEMENT_DESCRIPTION}}`
and `{{DOM}}`. Values are substituted in one pass, preserving dollar signs,
apostrophes and literal markers inside the inserted values. The internal
`TemplateLoader` reads the UTF-8 file relative to its own module, caches the
promise across instances/concurrent calls, and clears it on failure to allow
retry. Successful reads stay cached until the process restarts. The loader is
not a public package export.

## Logging

`ConsoleLogger` implements the public `Logger` interface (`debug`, `info`, `warn`,
`error`). It accepts a minimum `LogLevel` and scope:

```ts
const logger = new ConsoleLogger("debug", "LoginTest");
const healer = new SelfHealer(llm, dom, logger);
```

Default level is `info`; `silent` disables output. Messages have a UTC timestamp,
level and scope. `SelfHealer` logs progress and failures without printing the
DOM, prompt, generated XPath or API key. A custom `Logger` can route messages
elsewhere. Playwright's API logs are separate; enable them before starting tests:

```powershell
$env:DEBUG = "pw:api"
npx playwright test
Remove-Item Env:DEBUG
```

If `DEBUG` already contains other namespaces, preserve them and append `,pw:api`,
then restore the previous value afterward. `ConsoleLogger` does not filter these logs.

## Contribute to the framework

From the `PlaywrightRobot` repository root (Node.js 22+, npm):

```sh
npm ci
npm run typecheck
npm run build
```

Edit `src/`; `dist/` is generated. The build compiles TypeScript and copies
`src/prompts/` into `dist/prompts/`. Framework automated tests and installed-package
validation are not configured for now. To create a local archive, run `npm pack`
after the build.

Use English identifiers, `kebab-case` files/directories, `PascalCase` classes,
interfaces and type aliases, and `camelCase` methods/variables. Keep acronyms
`LLM` and `OpenAILLM`. Application examples belong in documentation or separate
examples, not production framework code. Do not rename public APIs unnecessarily.

CI runs install, typecheck and build on pull requests
and pushes to `main`. Only the tag workflow publishes releases; it runs the same
checks and requires a tag matching `v` plus the package version. Published assets
are `.tgz` archives attached to GitHub releases. A maintainer must explicitly
update versions and push a matching tag to publish; regular CI does not publish.
