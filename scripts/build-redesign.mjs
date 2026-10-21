import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const checking = process.argv.includes("--check");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const outputs = [];
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
      __NEEDLE_SEARCH_WORKER_URL__: '"/assets/search.worker-TI6JI4PU.js"',
    },
    logLevel: "silent",
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
  preservedBootstrap: "/assets/bootstrap-9FA4D098.js",
  preservedStylesheet: "/assets/styles-06391554.css",
};
let html = await readFile("dist/index.html", "utf8");
const updated = html
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
    `<link rel="stylesheet" href="${manifest.stylesheet}"/>\n    <title>`,
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
