import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256File, sha256Buffer } from './hashing.mjs';
import { inspectImage } from './image-file.mjs';

export const PACK_SCHEMA_VERSION = 1;

export async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporary, filePath);
}

export async function verifyPack(packDirectory, { verifyEveryImage = true, minimumRecords = 3 } = {}) {
  const manifestPath = path.join(packDirectory, 'manifest.json');
  const corpusPath = path.join(packDirectory, 'corpus.json');
  const [manifest, corpus] = await Promise.all([
    readJson(manifestPath),
    readJson(corpusPath)
  ]);
  if (manifest.schemaVersion !== PACK_SCHEMA_VERSION) throw new Error(`Unsupported pack manifest schema ${manifest.schemaVersion}.`);
  if (manifest.recordCount !== corpus.items?.length) throw new Error('Pack manifest record count does not match the corpus.');
  if (corpus.items.length < minimumRecords) throw new Error(`Pack has only ${corpus.items.length} records.`);
  if (!['met-pack', 'met-hybrid-pack'].includes(corpus.source?.mode)) throw new Error('Pack corpus is not marked as a supported Met pack.');
  if (!['local-pack', 'local-preview-remote-detail'].includes(corpus.source?.assetMode)) throw new Error('Pack corpus has an unsupported asset mode.');
  if (corpus.source?.packId !== manifest.id) throw new Error('Pack id differs between manifest and corpus.');
  if (manifest.corpusSha256 && manifest.corpusSha256 !== await sha256File(corpusPath)) throw new Error('Pack corpus checksum does not match its manifest.');

  const fullLocal = corpus.source.mode === 'met-pack';
  if (fullLocal && manifest.imageCount !== corpus.items.length) throw new Error('Fully local pack image count does not match the corpus.');

  const ids = new Set();
  const prefix = `/packs/${manifest.id}/images/`;
  const files = [];
  let previewCount = 0;

  for (const item of corpus.items) {
    if (ids.has(item.id)) throw new Error(`Duplicate item ${item.id}.`);
    ids.add(item.id);

    if (fullLocal) {
      if (!item.imageUrl?.startsWith(prefix)) throw new Error(`Item ${item.id} points outside its pack.`);
      files.push(localPackFile(packDirectory, prefix, item.imageUrl, item));
      continue;
    }

    const isPreview = Boolean(item.previewRank);
    if (isPreview) {
      previewCount += 1;
      const thumbnail = item.thumbnailUrl ?? item.imageUrl;
      if (!thumbnail?.startsWith(prefix)) throw new Error(`Preview item ${item.id} does not use a local pack image.`);
      if (!item.imageOptimized) throw new Error(`Preview item ${item.id} is not marked as locally validated.`);
      files.push(localPackFile(packDirectory, prefix, thumbnail, item));
    } else {
      const thumbnail = item.thumbnailUrl ?? item.imageUrl;
      if (!remoteHttpUrl(thumbnail)) throw new Error(`Lazy item ${item.id} has no valid remote image URL.`);
      if (item.imageOptimized) throw new Error(`Lazy item ${item.id} incorrectly claims a locally optimized image.`);
    }

    const detail = item.detailImageUrl ?? item.imageUrl;
    if (!remoteHttpUrl(detail) && !detail?.startsWith(prefix)) throw new Error(`Item ${item.id} has no valid detail image URL.`);
  }

  if (!fullLocal) {
    if (manifest.imageCount !== previewCount) throw new Error(`Hybrid pack declares ${manifest.imageCount} images but exposes ${previewCount} local previews.`);
    if (manifest.previewImageCount !== previewCount) throw new Error('Hybrid pack preview count differs from its manifest.');
    if (corpus.source.imageCount !== previewCount || corpus.source.previewImageCount !== previewCount) {
      throw new Error('Hybrid pack preview counts differ between manifest and corpus.');
    }
  }

  const infos = await mapConcurrent(files, verifyEveryImage ? 8 : 64, async ({ imagePath }) => {
    if (verifyEveryImage) return inspectImage(imagePath);
    const stats = await fs.stat(imagePath);
    if (!stats.isFile() || stats.size <= 0) throw new Error(`Pack image is not readable: ${imagePath}`);
    return { bytes: stats.size, sha256: null };
  });

  let bytes = 0;
  const digestParts = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const info = infos[index];
    if (!file || !info) continue;
    bytes += info.bytes;
    if (verifyEveryImage) digestParts.push(`${file.item.objectId}:${info.sha256}:${info.bytes}`);
  }
  const digest = verifyEveryImage ? sha256Buffer(Buffer.from(digestParts.join('\n'))) : manifest.imageDigest;
  if (verifyEveryImage && manifest.imageDigest && manifest.imageDigest !== digest) throw new Error('Pack image digest does not match its files.');
  if (manifest.assetBytes !== bytes) throw new Error(`Pack byte count differs: manifest=${manifest.assetBytes}, files=${bytes}.`);
  return { manifest, corpus, bytes, digest };
}

function localPackFile(packDirectory, prefix, url, item) {
  const fileName = url.slice(prefix.length);
  if (!safeRelativeFile(fileName)) throw new Error(`Item ${item.id} has an unsafe pack image path.`);
  const imagePath = path.resolve(packDirectory, 'images', fileName);
  const imageRoot = path.resolve(packDirectory, 'images');
  if (!inside(imageRoot, imagePath)) throw new Error(`Item ${item.id} escapes the pack image directory.`);
  return { item, imagePath };
}

function remoteHttpUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function activatePack(dataPacksDirectory, packId, { verifyEveryImage = false, minimumRecords = 3 } = {}) {
  const packDirectory = path.join(dataPacksDirectory, packId);
  const verified = await verifyPack(packDirectory, { verifyEveryImage, minimumRecords });
  await writeJsonAtomic(path.join(dataPacksDirectory, 'active.json'), {
    schemaVersion: 2,
    packId,
    packDirectory: path.resolve(packDirectory),
    activatedAt: new Date().toISOString(),
    manifestSha256: await sha256File(path.join(packDirectory, 'manifest.json')),
    recordCount: verified.manifest.recordCount
  });
  return verified;
}

export async function activePack(dataPacksDirectory) {
  const pointer = await readJson(path.join(dataPacksDirectory, 'active.json'));
  if (!pointer?.packId) throw new Error('No active Needle data pack is installed.');
  const directory = pointer.packDirectory
    ? path.resolve(pointer.packDirectory)
    : path.join(dataPacksDirectory, pointer.packId);
  if (pointer.manifestSha256) {
    const actualManifestSha256 = await sha256File(path.join(directory, 'manifest.json'));
    if (actualManifestSha256 !== pointer.manifestSha256) throw new Error('The active data-pack pointer does not match the installed manifest.');
  }
  return { pointer, directory };
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function mapConcurrent(values, concurrency, mapper) {
  const output = new Array(values.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      output[index] = await mapper(values[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, values.length)) }, worker));
  return output;
}

function safeRelativeFile(value) {
  if (!value || value.includes('\\') || value.startsWith('/') || value.split('/').some((part) => !part || part === '.' || part === '..')) return false;
  return true;
}

function inside(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
