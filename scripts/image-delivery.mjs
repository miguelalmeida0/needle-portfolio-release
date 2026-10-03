import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const IMAGE_WIDTHS = [160, 320, 640, 1280];
const formats = new Set(['avif', 'webp', 'jpeg']);
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_CACHE_BYTES = 256 * 1024 * 1024;
const DAY = 86400000;

export function remoteImageSource(source) {
  try {
    const url = new URL(source);
    return url.protocol === 'https:' && url.hostname === 'images.metmuseum.org'
      && !url.port && !url.username && !url.password
      && /^\/CRDImages\/[^/]+\/web-large\/[^/]+$/i.test(url.pathname) && !url.search;
  } catch { return false; }
}

export function createImageDelivery({ cacheRoot, resolveLocal }) {
  const pending = new Map();
  const sources = new Map();
  const failures = new Map();
  let active = 0;
  const queue = [];
  let lastPrune = 0;
  sharp.cache({ memory: 32, files: 0, items: 32 });
  sharp.concurrency(1);

  async function limited(run) {
    if (active >= 3) await new Promise(resolve => queue.push(resolve));
    active++;
    try { return await run(); }
    finally { active--; queue.shift()?.(); }
  }

  async function sourceBytes(source, local) {
    const key = local ?? source;
    if (sources.has(key)) return sources.get(key);
    const promise = (async () => {
      if (local) return fs.readFile(local);
      const response = await fetch(source, { signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Museum image unavailable');
      if (Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) throw new Error('Image exceeds source budget');
      const reader = response.body.getReader();
      const chunks = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_SOURCE_BYTES) throw new Error('Image exceeds source budget');
          chunks.push(value);
        }
        return Buffer.concat(chunks);
      } finally { await reader.cancel(); }
    })();
    sources.set(key, promise);
    // Share overlapping formats/sizes without retaining decoded artworks for the session.
    promise.finally(() => { const timer = setTimeout(() => sources.delete(key), 2000); timer.unref(); }).catch(() => {});
    return promise;
  }

  async function prune() {
    if (Date.now() - lastPrune < 60000) return;
    lastPrune = Date.now();
    const files = await fs.readdir(cacheRoot).catch(() => []);
    const entries = await Promise.all(files.map(async name => ({ name, stat: await fs.stat(path.join(cacheRoot, name)) })));
    let total = entries.reduce((sum, e) => sum + e.stat.size, 0);
    for (const entry of entries.sort((a,b) => a.stat.mtimeMs - b.stat.mtimeMs)) {
      if (total <= MAX_CACHE_BYTES) break;
      await fs.unlink(path.join(cacheRoot, entry.name)).catch(() => {});
      total -= entry.stat.size;
    }
  }

  return async function imageDelivery(url) {
    const source = url.searchParams.get('src') ?? '';
    const width = Number(url.searchParams.get('w'));
    const format = url.searchParams.get('format');
    if (!IMAGE_WIDTHS.includes(width) || !formats.has(format)) return null;
    const local = source.startsWith('/packs/') || source.startsWith('/assets/met/')
      ? await resolveLocal(source) : null;
    if (!local && !remoteImageSource(source)) return null;
    const stat = local ? await fs.stat(local) : null;
    if (stat && stat.size > MAX_SOURCE_BYTES) return null;
    const fingerprint = stat ? `${stat.size}:${stat.mtimeMs}` : Math.floor(Date.now() / DAY);
    const key = createHash('sha256').update(`v1:${source}:${fingerprint}:${width}:${format}`).digest('hex');
    const filePath = path.join(cacheRoot, `${key}.${format}`);
    const cached = await fs.stat(filePath).catch(() => null);
    if (cached) return { filePath, stats: cached, local: Boolean(local), etag: `"${key}"` };
    if ((failures.get(source) ?? 0) > Date.now()) throw new Error('Museum image temporarily unavailable');
    if (!pending.has(key)) {
      if (pending.size >= 96) throw new Error('Image queue is full');
      const task = limited(async () => {
        const bytes = await sourceBytes(source, local);
        const output = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate()
          .resize({ width, withoutEnlargement: true })
          .toFormat(format, { quality: format === 'avif' ? 55 : 78, effort: 2 }).toBuffer();
        await fs.mkdir(cacheRoot, { recursive: true });
        const temp = `${filePath}.${process.pid}.tmp`;
        await fs.writeFile(temp, output);
        await fs.rename(temp, filePath);
        void prune().catch(() => {});
      }).catch(error => {
        if (failures.size > 256) failures.clear();
        failures.set(source, Date.now() + 30000);
        throw error;
      }).finally(() => pending.delete(key));
      pending.set(key, task);
    }
    await pending.get(key);
    return { filePath, stats: await fs.stat(filePath), local: Boolean(local), etag: `"${key}"` };
  };
}
