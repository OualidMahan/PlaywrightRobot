import type { Page } from "@playwright/test";
import type { BasePage } from "../BasePage";

type PageConstructor<T> = new (page: Page) => T;

export function pageFixture<T>(PageClass: PageConstructor<T>) {
  return async (
    { page }: { page: Page },
    use: (value: T) => Promise<void>,
  ): Promise<void> => {
    await use(new PageClass(page));
  };
}

type PageRegistry = Record<string, PageConstructor<BasePage>>;

// Les objets que les tests recevront
export type PageInstances<R extends PageRegistry> = {
  [K in keyof R]: InstanceType<R[K]>;
};

// Les fonctions qui fourniront ces objets
type FixtureDefinitions<R extends PageRegistry> = {
  [K in keyof R]: (
    args: { page: Page },
    use: (value: InstanceType<R[K]>) => Promise<void>,
  ) => Promise<void>;
};

export function buildPageFixtures<R extends PageRegistry>(
  registry: R,
): FixtureDefinitions<R> {
  const entries = Object.entries(registry).map(
    ([name, PageClass]) => [name, pageFixture(PageClass)] as const,
  );

  return Object.fromEntries(entries) as FixtureDefinitions<R>;
}
