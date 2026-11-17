#!/usr/bin/env node
/* Builds every page from content/site.json.  Usage: node tools/build.mjs
   The /admin page does the same in the browser, so Node is only needed for this command. */
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planSources, renderSite, validate } from "./render.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const content = JSON.parse(readFileSync(join(root, "content/site.json"), "utf8"));

const problems = validate(content);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const plans = {};
for (const src of planSources(content)) {
  const file = join(root, src);
  if (existsSync(file)) plans[src] = readFileSync(file, "utf8");
  else console.warn(`plan not found: ${src}`);
}

const { files, detailDirs } = renderSite(content, { plans });

for (const dir of detailDirs) {
  const abs = join(root, dir);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs)) {
    if (f.endsWith(".html") && !(dir + f in files)) {
      unlinkSync(join(abs, f));
      console.log(`removed ${dir}${f}`);
    }
  }
}

for (const [path, text] of Object.entries(files)) {
  const abs = join(root, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}
console.log(`wrote ${Object.keys(files).length} files`);
