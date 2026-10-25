import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { BasePage } from "../base-page";

export type PageConstructor = new (page: Page) => BasePage;
export type PageRegistry = Record<string, PageConstructor>;

export type PagesFromModule<M> = {
  [K in keyof M as M[K] extends PageConstructor
    ? K extends string ? Uncapitalize<K> : never
    : never]: M[K];
};

export function createPageRegistry(directory: string): PageRegistry {
  const registry: PageRegistry = Object.create(null);

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) {
      continue;
    }

    const fileExports: Record<string, unknown> = require(resolve(directory, entry.name));
    for (const [name, value] of Object.entries(fileExports)) {
      if (typeof value !== "function" || !(value.prototype instanceof BasePage)) continue;

      const fixtureName = name.charAt(0).toLowerCase() + name.slice(1);
      if (Object.hasOwn(registry, fixtureName)) {
        throw new Error(`The fixture "${fixtureName}" is already registered.`);
      }
      registry[fixtureName] = value as PageConstructor;
    }
  }

  return registry;
}
