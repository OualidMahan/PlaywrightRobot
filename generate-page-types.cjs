const { readdirSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { resolve, relative, dirname } = require("node:path");

module.exports = function generatePageTypes(pagesPath, outputPath) {
  const pagesDirectory = resolve(pagesPath);
  const output = resolve(outputPath);
  const modules = readdirSync(pagesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts"))
    .map((entry) => entry.name.slice(0, -3))
    .sort();

  const types = modules.map((name) => {
    let modulePath = relative(dirname(output), resolve(pagesDirectory, name)).replace(/\\/g, "/");
    if (!modulePath.startsWith(".")) modulePath = "./" + modulePath;
    return `  PagesFromModule<typeof import(${JSON.stringify(modulePath)})>`;
  });
  const content =
    '// Généré par npm run pages:generate. Ne pas modifier manuellement.\n' +
    'import type { PagesFromModule } from "@automation/framework";\n\n' +
    `export type DiscoveredPages =\n${types.length ? types.join(" &\n") : "  {}"};\n`;

  // Éviter de déclencher inutilement les observateurs de fichiers de l’IDE.
  let previousContent;
  try {
    previousContent = readFileSync(output, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (previousContent !== content) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, content);
  }
};
