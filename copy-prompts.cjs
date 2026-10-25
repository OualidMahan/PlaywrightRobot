const { cpSync } = require("node:fs");
const path = require("node:path");

cpSync(
  path.join(__dirname, "src", "prompts"),
  path.join(__dirname, "dist", "prompts"),
  { recursive: true },
);
