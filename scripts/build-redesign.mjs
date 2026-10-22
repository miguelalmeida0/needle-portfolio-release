import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { redesignImages } from "./redesign-images.mjs";
import { buildPreviewAtlas } from "./build-preview-atlas.mjs";
import { searchRelevance } from './search-relevance.mjs';
const checking = process.argv.includes("--check");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const atlas = await buildPreviewAtlas();
const atlasManifest = JSON.stringify(atlas.manifest) + '\n';
if (checking) {
  if (await readFile('src/redesign/preview-atlas.json', 'utf8') !== atlasManifest ||
      digest(await readFile(atlas.filePath)) !== digest(atlas.bytes)) throw new Error('Stale preview atlas');
} else {
  await mkdir(atlas.filePath.slice(0, atlas.filePath.lastIndexOf('/')), { recursive: true });
  await writeFile(atlas.filePath, atlas.bytes);
  await writeFile('src/redesign/preview-atlas.json', atlasManifest);
}
const outputs = [];
const worker = await build({ entryPoints: ['dist/modules/packages/search-runtime/src/search.worker.js'], bundle: true,
  format: 'esm', target: 'es2022', minify: true, write: false, legalComments: 'none', charset: 'utf8', plugins: [searchRelevance] });
if (worker.warnings.length) throw new Error(JSON.stringify(worker.warnings));
const workerBytes = worker.outputFiles[0].contents;
const workerHash = digest(workerBytes);
const workerPath = `/assets/search-relevant-${workerHash.slice(0,8).toUpperCase()}.js`;
if (checking) {
  if (digest(await readFile('dist' + workerPath)) !== workerHash) throw new Error('Stale relevance worker');
} else await writeFile('dist' + workerPath, workerBytes);
for (const [entry, prefix, extension] of [
  ["src/redesign/bootstrap.jsx", "bootstrap", "js"],
  ["src/redesign/needle.css", "redesign", "css"],
]) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    target: "es2022",
    minify: true,
    write: false,
    legalComments: "none",
    charset: "utf8",
    jsx: "transform",
    define: {
      __NEEDLE_SEARCH_WORKER_URL__: JSON.stringify(workerPath),
    },
    logLevel: "silent",
    plugins: [redesignImages, searchRelevance],
  });
  if (result.warnings.length) throw new Error(JSON.stringify(result.warnings));
  const bytes = result.outputFiles[0].contents;
  const sha256 = digest(bytes);
  outputs.push({
    path: `dist/assets/${prefix}-${sha256.slice(0, 8).toUpperCase()}.${extension}`,
    bytes,
    sha256,
  });
}
for (const output of outputs) {
  if (checking) {
    if (digest(await readFile(output.path)) !== output.sha256)
      throw new Error(`Stale export: ${output.path}`);
  } else await writeFile(output.path, output.bytes);
}
const manifest = {
  bootstrap: outputs[0].path.slice(4),
  stylesheet: outputs[1].path.slice(4),
  bootstrapSha256: outputs[0].sha256,
  stylesheetSha256: outputs[1].sha256,
  searchWorker: workerPath,
  searchWorkerSha256: workerHash,
  preservedBootstrap: "/assets/bootstrap-9FA4D098.js",
  preservedStylesheet: "/assets/styles-06391554.css",
};
let html = await readFile("dist/index.html", "utf8");
const updated = html
  .replace(/\s*<link rel="preload" as="image" href="\/packs\/[^/]+\/previews\/atlas-[A-Z0-9]{8}\.avif" fetchpriority="low"\/>/, '')
  .replace(
    /<script type="module" src="\/assets\/bootstrap-[A-Z0-9]{8}\.js"><\/script>/,
    `<script type="module" src="${manifest.bootstrap}"></script>`,
  )
  .replace(
    /\s*<link rel="stylesheet" href="\/assets\/redesign-[A-Z0-9]{8}\.css"\/>/,
    "",
  )
  .replace(
    "<title>",
    `<link rel="stylesheet" href="${manifest.stylesheet}"/>\n    <link rel="preload" as="image" href="${atlas.url}" fetchpriority="low"/>\n    <title>`,
  );
if (checking) {
  const existing = JSON.parse(
    await readFile("dist/redesign-release.json", "utf8"),
  );
  if (JSON.stringify(existing) !== JSON.stringify(manifest) || html !== updated)
    throw new Error("Design entrypoint does not match the validated export");
} else {
  await writeFile("dist/index.html", updated);
  await writeFile(
    "dist/redesign-release.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
}
console.log(
  `${checking ? "Verified" : "Built"} design export: ${manifest.bootstrap}, ${manifest.stylesheet}`,
);
