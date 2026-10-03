import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sha256File } from './hashing.mjs';
import { activePack, verifyPack, writeJsonAtomic } from './pack-store.mjs';

const SEARCH_DEPTH = 5;
const IGNORED_DIRECTORIES = new Set([
  '.git', '.build', '.needle-packs', 'node_modules', 'dist', 'Library',
  '.cache', '.npm', '.cargo', '.rustup', '.vscode', '.idea'
]);

/**
 * Discover and adopt an existing Needle data pack without redownloading it.
 *
 * Legacy recovery does not depend on release-folder names or symlinks.
 * A discovered pack is migrated into a stable user-level registry when a
 * same-volume rename is possible (instant, no duplicate 1 GB copy). If that
 * is not possible, the project stores an absolute external-pack pointer.
 */
export async function adoptNearbyPack(projectRoot, options = {}) {
  const targetRoot = path.join(projectRoot, 'data-packs');
  if (await hasUsableActivePack(targetRoot)) return null;

  const candidates = await discoverPackDirectories(projectRoot, options);
  for (const sourcePackDirectory of candidates) {
    try {
      const verified = await verifyPack(sourcePackDirectory, {
        verifyEveryImage: false,
        minimumRecords: Number(options.minimumRecords ?? 100)
      });
      const stablePackDirectory = await stabilizePack(sourcePackDirectory, verified.manifest, options);
      await writeProjectPointer(targetRoot, stablePackDirectory, verified.manifest, sourcePackDirectory);
      return stablePackDirectory;
    } catch {
      // Stale/incomplete installations are intentionally ignored. Discovery
      // continues until a pack satisfying the actual pack contract is found.
    }
  }
  return null;
}

export async function discoverPackDirectories(projectRoot, options = {}) {
  const home = os.homedir();
  const ordinaryRoots = uniquePaths([
    path.dirname(projectRoot),
    path.resolve(path.dirname(projectRoot), '..'),
    process.cwd(),
    process.env.HOME ? path.join(process.env.HOME, 'Downloads') : null,
    process.env.HOME ? path.join(process.env.HOME, 'Desktop') : null,
    process.env.HOME ? path.join(process.env.HOME, 'Documents') : null,
    process.env.HOME ? path.join(process.env.HOME, '.Trash') : null,
    home ? path.join(home, 'Downloads') : null,
    home ? path.join(home, 'Desktop') : null,
    home ? path.join(home, 'Documents') : null,
    home ? path.join(home, '.Trash') : null,
    home ? path.join(home, '.needle', 'data-packs') : null
  ]).filter((root) => root && !samePath(root, projectRoot));
  const exhaustiveRoots = uniquePaths(options.searchRoots ?? []).filter((root) => root && !samePath(root, projectRoot));

  const found = new Map();
  const collect = async (root, exhaustive) => {
    for (const candidate of await scanForPacks(root, projectRoot, Number(options.searchDepth ?? SEARCH_DEPTH), { exhaustive })) {
      const key = await canonicalPath(candidate);
      if (!found.has(key)) found.set(key, candidate);
    }
  };
  for (const root of ordinaryRoots) await collect(root, false);
  for (const root of exhaustiveRoots) await collect(root, true);

  const scored = [];
  for (const candidate of found.values()) {
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(candidate, 'manifest.json'), 'utf8'));
      scored.push({
        candidate,
        preferred: manifest.id === 'met-10k-v1' ? 1 : 0,
        records: Number(manifest.recordCount ?? 0),
        stable: isInside(defaultGlobalDataPacksRoot(), candidate) ? 1 : 0,
        mtime: (await fs.stat(path.join(candidate, 'manifest.json'))).mtimeMs
      });
    } catch {
      // Not a valid pack candidate.
    }
  }
  scored.sort((a, b) => b.preferred - a.preferred || b.stable - a.stable || b.records - a.records || b.mtime - a.mtime);
  return scored.map((entry) => entry.candidate);
}

export function defaultGlobalDataPacksRoot() {
  const home = os.homedir();
  return path.resolve(process.env.NEEDLE_GLOBAL_PACKS_ROOT ?? path.join(home || process.cwd(), '.needle', 'data-packs'));
}

async function stabilizePack(sourcePackDirectory, manifest, options) {
  if (options.stabilize === false) return path.resolve(sourcePackDirectory);

  const globalRoot = path.resolve(options.globalRoot ?? defaultGlobalDataPacksRoot());
  const globalPackDirectory = path.join(globalRoot, manifest.id);
  await fs.mkdir(globalRoot, { recursive: true });

  // Prefer a previously migrated global copy if it is already healthy.
  try {
    const verified = await verifyPack(globalPackDirectory, { verifyEveryImage: false, minimumRecords: 1 });
    if (verified.manifest.id === manifest.id && verified.manifest.recordCount >= manifest.recordCount) {
      await writeGlobalPointer(globalRoot, globalPackDirectory, verified.manifest);
      return globalPackDirectory;
    }
  } catch {
    // No healthy global pack yet.
  }

  const sourceReal = await canonicalPath(sourcePackDirectory);
  const globalReal = await canonicalPath(globalRoot);
  if (isInside(globalReal, sourceReal)) {
    await writeGlobalPointer(globalRoot, sourceReal, manifest);
    return sourceReal;
  }

  // Rename is intentionally attempted before any copy. On the user's normal
  // macOS volume this makes recovering a ~1 GB pack effectively instantaneous.
  try {
    await fs.rm(globalPackDirectory, { recursive: true, force: true });
    await fs.rename(sourcePackDirectory, globalPackDirectory);
    await writeGlobalPointer(globalRoot, globalPackDirectory, manifest);
    return globalPackDirectory;
  } catch (error) {
    // EXDEV / permissions / read-only source: keep a zero-copy absolute pointer.
    if (!['EXDEV', 'EACCES', 'EPERM', 'EROFS', 'ENOTEMPTY', 'EEXIST'].includes(error?.code)) throw error;
    await writeGlobalPointer(globalRoot, sourcePackDirectory, manifest);
    return path.resolve(sourcePackDirectory);
  }
}

async function writeGlobalPointer(globalRoot, packDirectory, manifest) {
  await writeJsonAtomic(path.join(globalRoot, 'active.json'), {
    schemaVersion: 2,
    packId: manifest.id,
    packDirectory: path.resolve(packDirectory),
    activatedAt: new Date().toISOString(),
    manifestSha256: await sha256File(path.join(packDirectory, 'manifest.json')),
    recordCount: manifest.recordCount
  });
}

async function writeProjectPointer(targetRoot, packDirectory, manifest, discoveredFrom) {
  await fs.mkdir(targetRoot, { recursive: true });
  await writeJsonAtomic(path.join(targetRoot, 'active.json'), {
    schemaVersion: 2,
    packId: manifest.id,
    packDirectory: path.resolve(packDirectory),
    activatedAt: new Date().toISOString(),
    adoptedFrom: path.resolve(discoveredFrom),
    manifestSha256: await sha256File(path.join(packDirectory, 'manifest.json')),
    recordCount: manifest.recordCount
  });
}

async function scanForPacks(root, projectRoot, maxDepth, { exhaustive = false } = {}) {
  const output = [];
  const seen = new Set();

  async function walk(directory, depth, insideRelevantTree = false) {
    if (depth > maxDepth || samePath(directory, projectRoot)) return;
    const canonical = await canonicalPath(directory);
    if (seen.has(canonical)) return;
    seen.add(canonical);

    const directPack = await packDirectoryIfValidShape(directory);
    if (directPack) output.push(directPack);

    const dataPacks = path.join(directory, 'data-packs');
    for (const pack of await packsInside(dataPacks)) output.push(pack);

    if (depth === maxDepth) return;
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORED_DIRECTORIES.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.needle' && entry.name !== '.Trash') continue;
      const relevant = insideRelevantTree || looksNeedleRelated(entry.name);
      if (!exhaustive && !relevant) continue;
      await walk(path.join(directory, entry.name), depth + 1, relevant);
    }
  }

  await walk(path.resolve(root), 0, looksNeedleRelated(path.basename(root)));
  return output;
}

function looksNeedleRelated(name) {
  const value = String(name ?? '').toLowerCase();
  return value.includes('needle') || value === 'data-packs' || value === '.needle' || value === '.trash' || /^met-(1k|10k|50k)-v\d+$/.test(value);
}

async function packsInside(dataPacksRoot) {
  const entries = await fs.readdir(dataPacksRoot, { withFileTypes: true }).catch(() => []);
  const output = [];
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name.startsWith('.')) continue;
    const candidate = path.join(dataPacksRoot, entry.name);
    if (await packDirectoryIfValidShape(candidate)) output.push(candidate);
  }
  return output;
}

async function packDirectoryIfValidShape(directory) {
  try {
    const [manifest, corpus] = await Promise.all([
      fs.stat(path.join(directory, 'manifest.json')),
      fs.stat(path.join(directory, 'corpus.json'))
    ]);
    if (!manifest.isFile() || !corpus.isFile()) return null;
    return directory;
  } catch {
    return null;
  }
}

async function hasUsableActivePack(directory) {
  try {
    const active = await activePack(directory);
    await verifyPack(active.directory, { verifyEveryImage: false, minimumRecords: 1 });
    return true;
  } catch {
    return false;
  }
}

function uniquePaths(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    if (!value) continue;
    const resolved = path.resolve(value);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    output.push(resolved);
  }
  return output;
}

function samePath(left, right) {
  return path.resolve(left) === path.resolve(right);
}

function isInside(base, candidate) {
  const relative = path.relative(path.resolve(base), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function canonicalPath(value) {
  return fs.realpath(value).catch(() => path.resolve(value));
}
