import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { BasePage } from "../BasePage";

export type PageConstructor = new (page: Page) => BasePage;
export type PageRegistry = Record<string, PageConstructor>;

export type PagesFromModule<M> = {
  [K in keyof M as M[K] extends PageConstructor
    ? K extends string ? Uncapitalize<K> : never
    : never]: M[K];
};

export function creerPageRegistry(repertoire: string): PageRegistry {
  const registry: PageRegistry = Object.create(null);

  for (const fichier of readdirSync(repertoire, { withFileTypes: true })) {
    if (!fichier.isFile() || !fichier.name.endsWith(".ts") || fichier.name.endsWith(".d.ts")) {
      continue;
    }

    const exportsDuFichier: Record<string, unknown> = require(resolve(repertoire, fichier.name));
    for (const [nom, valeur] of Object.entries(exportsDuFichier)) {
      if (typeof valeur !== "function" || !(valeur.prototype instanceof BasePage)) continue;

      const fixtureName = nom.charAt(0).toLowerCase() + nom.slice(1);
      if (Object.hasOwn(registry, fixtureName)) {
        throw new Error(`La fixture "${fixtureName}" est déjà enregistrée.`);
      }
      registry[fixtureName] = valeur as PageConstructor;
    }
  }

  return registry;
}
