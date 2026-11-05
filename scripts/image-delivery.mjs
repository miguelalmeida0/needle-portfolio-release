import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { imageError } from './image-budget.mjs';

export const IMAGE_WIDTHS = [160, 320, 640, 1280];
const formats = new Set(['avif', 'webp', 'jpeg']);
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_CACHE_BYTES = 256 * 1024 * 1024;
const DAY = 86400000;

export function remoteImageSource(source) {
  return canonicalRemoteSource(source) !== null;
}

function canonicalRemoteSource(source) {
  try {
    if (typeof source !== 'string' || source.length > 2048 || /[\x00-\x20\x7f\\]/.test(source)) return null;
    const url = new URL(source);
    const pathname = decodeURIComponent(url.pathname);
    const allowed = url.protocol === 'https:' && url.hostname === 'images.metmuseum.org'
      && !url.port && !url.username && !url.password
      && /^\/CRDImages\/[^/]+\/web-large\/[^/]+$/i.test(pathname) && !source.includes('?') && !source.includes('#')
      && !/[\x00-\x1f\x7f\\]/.test(pathname);
    if (!allowed) return null;
    url.pathname = pathname.split('/').map(encodeURIComponent).join('/');
    return url.href;
  } catch { return null; }
}

export function createImageDelivery({ cacheRoot, resolveLocal, budget,
  remoteEnabled = true, transformsEnabled = true, fetchRemote = fetch, queueWaitMs = 5000 }) {
  const pending = new Map();
  const sources = new Map();
  const failures = new Map();
  let active = 0;
  const queue = [];
  let lastPrune = 0;
  sharp.cache({ memory: 32, files: 0, items: 32 });
  sharp.concurrency(1);

  async function limited(run) {
    if (active < 3) active++;
    else await new Promise((resolve, reject) => {
      const waiter = { resolve, timer: null };
      waiter.timer = setTimeout(() => {
        queue.splice(queue.indexOf(waiter), 1);
        reject(imageError('Image preparation queue timed out.', 503, 5));
      }, queueWaitMs);
      queue.push(waiter);
    });
    try { return await run(); }
    finally {
      const waiter = queue.shift();
      if (waiter) { clearTimeout(waiter.timer); waiter.resolve(); }
      else active--;
    }
  }

  async function sourceBytes(source, local) {
    const key = local ?? source;
    if (sources.has(key)) return sources.get(key);
    const promise = (async () => {
      if (local) return fs.readFile(local);
      const reservation = budget?.reserveRemote(MAX_SOURCE_BYTES);
      const response = await fetchRemote(source, { signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')
        || Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES || !response.body) {
        await response.body?.cancel();
        throw new Error('Museum image unavailable or exceeds source budget');
      }
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
        const bytes = Buffer.concat(chunks);
        reservation?.finish(bytes.length);
        return bytes;
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
    const files = (await fs.readdir(cacheRoot).catch(() => [])).filter(name => /^[a-f0-9]{64}\.(?:avif|webp|jpeg)$/.test(name));
    const entries = (await Promise.all(files.map(async name => ({ name, stat: await fs.stat(path.join(cacheRoot, name)).catch(() => null) })))).filter(entry => entry.stat);
    let total = entries.reduce((sum, e) => sum + e.stat.size, 0);
    for (const entry of entries.sort((a,b) => a.stat.mtimeMs - b.stat.mtimeMs)) {
      if (total <= MAX_CACHE_BYTES) break;
      await fs.unlink(path.join(cacheRoot, entry.name)).catch(() => {});
      total -= entry.stat.size;
    }
  }

  return async function imageDelivery(url, { create = true } = {}) {
    if (url.href.length > 4096 || [...url.searchParams.keys()].some(key => !['src', 'w', 'format'].includes(key))
      || ['src', 'w', 'format'].some(key => url.searchParams.getAll(key).length !== 1)) return null;
    let source = url.searchParams.get('src') ?? '';
    if (source.length > 2048) return null;
    const width = Number(url.searchParams.get('w'));
    const format = url.searchParams.get('format');
    if (!IMAGE_WIDTHS.includes(width) || !formats.has(format)) return null;
    const local = source.startsWith('/packs/') || source.startsWith('/assets/met/')
      ? await resolveLocal(source) : null;
    if (!local) { source = canonicalRemoteSource(source); if (!source) return null; }
    const stat = local ? await fs.stat(local) : null;
    if (stat && stat.size > MAX_SOURCE_BYTES) return null;
    const fingerprint = stat ? `${stat.size}:${stat.mtimeMs}` : Math.floor(Date.now() / DAY);
    const key = createHash('sha256').update(`v1:${local ?? source}:${fingerprint}:${width}:${format}`).digest('hex');
    const filePath = path.join(cacheRoot, `${key}.${format}`);
    const cached = await fs.stat(filePath).catch(() => null);
    if (cached) return { filePath, stats: cached, local: Boolean(local), etag: `"${key}"` };
    if (!create) return null;
    if (!transformsEnabled || !local && !remoteEnabled) throw imageError('New image preparation is temporarily disabled.');
    if ((failures.get(source) ?? 0) > Date.now()) throw new Error('Museum image temporarily unavailable');
    if (!pending.has(key)) {
      if (pending.size >= 32) throw imageError('Image queue is full.', 503, 5);
      const task = limited(async () => {
        budget?.reserveTransform();
        const bytes = await sourceBytes(source, local);
        if (bytes.length > MAX_SOURCE_BYTES) throw new Error('Image exceeds source budget');
        const output = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate()
          .resize({ width, height: 4096, fit: 'inside', withoutEnlargement: true }).timeout({ seconds: 10 })
          .toFormat(format, { quality: format === 'avif' ? 55 : 78, effort: 2 }).toBuffer();
        if (output.length > 4 * 1024 * 1024) throw new Error('Image exceeds output budget');
        await fs.mkdir(cacheRoot, { recursive: true });
        const temp = `${filePath}.${process.pid}.tmp`;
        await fs.writeFile(temp, output);
        await fs.rename(temp, filePath);
        void prune().catch(() => {});
      }).catch(error => {
        if (!error.statusCode) {
          if (failures.size >= 256) failures.delete(failures.keys().next().value);
          failures.set(source, Date.now() + 30000);
        }
        throw error;
      }).finally(() => pending.delete(key));
      pending.set(key, task);
    }
    await pending.get(key);
    return { filePath, stats: await fs.stat(filePath), local: Boolean(local), etag: `"${key}"` };
  };
}
