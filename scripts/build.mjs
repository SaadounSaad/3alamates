import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

const files = [
  "index.html",
  "manifest.json",
  "quran.json",
  "quran.png",
  "icon-192.png",
  "icon-512.png",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "react.production.min.js",
  "react-dom.production.min.js",
  "app.js",
  "tailwind.min.css",
  "service-worker.js"
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await copyFile(resolve(root, file), resolve(dist, file));
}

console.log(`Built static app in dist with ${files.length} files.`);
