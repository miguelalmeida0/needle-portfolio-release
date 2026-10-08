import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defaultGlobalDataPacksRoot } from './data-packs/legacy-pack.mjs';
import { createImageDelivery } from './image-delivery.mjs';
import { createGzip } from 'node:zlib';
import { decodePublicPath, existingPublicFile } from './http-boundary.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);

const root = path.resolve(projectRoot, args.get('--root') ?? 'dist');
const dataPacksRoot = path.resolve(args.get('--packs') ?? process.env.NEEDLE_PACKS_ROOT ?? defaultGlobalDataPacksRoot());
const port = Number(args.get('--port') ?? process.env.PORT ?? 4173);
const host = args.get('--host') ?? process.env.HOST ?? '127.0.0.1';
const allowDemo = process.env.NEEDLE_ALLOW_DEMO === '1';
const deliverImage = createImageDelivery({
  cacheRoot: process.env.NEEDLE_IMAGE_CACHE_ROOT ?? path.join(projectRoot, '.needle-cache', 'derivatives'),
  resolveLocal: async source => {
    const pathname = decodePublicPath(source);
    if (!pathname) return null;
    const pack = pathname.startsWith('/packs/') ? await resolvePackFile(pathname) : null;
    const file = pack
      ? await existingPublicFile(pack.base, pack.candidate)
      : await existingPublicFile(root, safeStaticPath(pathname));
    return file?.filePath ?? null;
  }
});

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.avif', 'image/avif'],
  ['.wasm', 'application/wasm'],
  ['.map', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8']
]);

let cachedPointer = null;
let cachedPointerMtimeMs = -1;

async function activePointer() {
  try {
    const filePath = path.join(dataPacksRoot, 'active.json');
    const stats = await fsp.stat(filePath);
    if (cachedPointer && cachedPointerMtimeMs === stats.mtimeMs) return cachedPointer;
    const pointer = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    cachedPointer = pointer?.packId ? pointer : null;
    cachedPointerMtimeMs = stats.mtimeMs;
    return cachedPointer;
  } catch {
    cachedPointer = null;
    cachedPointerMtimeMs = -1;
    return null;
  }
}

function inside(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolvePackFile(pathname) {
  const pointer = await activePointer();
  if (!pointer?.packId) return null;
  const activePackDirectory = pointer.packDirectory
    ? path.resolve(pointer.packDirectory)
    : path.join(dataPacksRoot, pointer.packId);

  if (pathname.startsWith('/packs/')) {
    const relative = pathname.slice('/packs/'.length);
    const [requestedPackId, ...rest] = relative.split('/');
    if (!requestedPackId || requestedPackId !== pointer.packId || rest.length === 0) return null;
    const candidate = path.resolve(activePackDirectory, rest.join('/'));
    return inside(activePackDirectory, candidate) ? { base: activePackDirectory, candidate } : null;
  }
  if (pathname !== '/data/corpus.json' && pathname !== '/data/pack-manifest.json') return null;
  return { base: activePackDirectory, candidate: path.join(activePackDirectory, pathname.endsWith('corpus.json') ? 'corpus.json' : 'manifest.json') };
}

function safeStaticPath(pathname) {
  const candidate = path.resolve(root, `.${pathname}`);
  return inside(root, candidate) ? candidate : null;
}

async function resolveFile(requestUrl) {
  const pathname = decodePublicPath(new URL(requestUrl, 'http://localhost').pathname);
  if (!pathname) return null;
  const pack = await resolvePackFile(pathname);
  const packFile = pack ? await existingPublicFile(pack.base, pack.candidate) : null;
  if (packFile) return { ...packFile, pathname, pack: true };

  if (pathname === '/data/corpus.json' && !allowDemo) return null;
  const staticFile = await existingPublicFile(root, safeStaticPath(pathname));
  if (staticFile) return { ...staticFile, pathname, pack: false };

  if (path.extname(pathname)) return null;
  const indexFile = await existingPublicFile(root, path.join(root, 'index.html'));
  return indexFile ? { ...indexFile, pathname, pack: false } : null;
}

function cacheControl(filePath, isPack) {
  const normalized = filePath.split(path.sep).join('/');
  const extension = path.extname(filePath).toLowerCase();
  if (normalized.endsWith('/corpus.json') || normalized.endsWith('/search-graph.json')) return 'no-cache';
  if (extension === '.html' || normalized.endsWith('/manifest.json')) return 'no-store';
  if (isPack || normalized.includes('/assets/met/')) return 'public, max-age=31536000, immutable';
  if (/\/assets\/.*-[A-Z0-9]{8}\.(js|css)$/.test(normalized)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=300';
}

function writeError(response, status, message) {
  response.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  response.end(message);
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD', 'cache-control': 'no-store' });
      response.end();
      return;
    }
    const url = new URL(request.url ?? '/', 'http://localhost');
    const derivative = url.pathname === '/_image' ? await deliverImage(url) : null;
    const resolved = url.pathname === '/_image' ? derivative : await resolveFile(request.url ?? '/');
    if (!resolved) {
      writeError(response, 404, 'Not found');
      return;
    }
    const extension = path.extname(resolved.filePath).toLowerCase();
    const compress = /\.(js|css|json|html|svg)$/.test(resolved.filePath) && /\bgzip\b/.test(request.headers['accept-encoding'] ?? '');
    const etag = derivative?.etag ?? `W/"${resolved.stats.size}-${resolved.stats.mtimeMs}"`;
    const caching = derivative ? (derivative.local ? 'public, max-age=31536000, immutable' : 'public, max-age=86400') : cacheControl(resolved.filePath, resolved.pack);
    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304, { etag, 'cache-control': caching, vary: 'Accept-Encoding' });
      response.end(); return;
    }
    response.writeHead(200, {
      'content-type': mimeTypes.get(extension) ?? 'application/octet-stream',
      ...(compress ? { 'content-encoding': 'gzip' } : { 'content-length': String(resolved.stats.size) }),
      'cache-control': caching,
      etag,
      vary: 'Accept-Encoding',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-origin',
      'x-content-type-options': 'nosniff'
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const stream = fs.createReadStream(resolved.filePath);
    stream.on('error', (error) => {
      if (!response.headersSent) writeError(response, 500, 'Needle could not serve this file.');
      else response.destroy(error);
    });
    request.on('aborted', () => stream.destroy());
    if (compress) stream.pipe(createGzip()).pipe(response);
    else stream.pipe(response);
  } catch (error) {
    if (!response.headersSent) writeError(response, 500, 'Needle could not serve this file.');
    else response.destroy(error instanceof Error ? error : new Error(String(error)));
  }
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 120_000;

let listenAttempt = 0;
listenWithFallback(port, 20);

function listenWithFallback(candidatePort, remainingAttempts) {
  const attempt = ++listenAttempt;
  const onError = (error) => {
    if (error?.code === 'EADDRINUSE' && remainingAttempts > 0) {
      const nextPort = candidatePort + 1;
      console.warn(`[Needle] Port ${candidatePort} is busy; trying ${nextPort}.`);
      listenWithFallback(nextPort, remainingAttempts - 1);
      return;
    }
    throw error;
  };
  server.once('error', onError);
  server.listen(candidatePort, host, () => {
    if (attempt !== listenAttempt) return;
    server.off('error', onError);
    const address = server.address();
    const activePort = typeof address === 'object' && address ? address.port : candidatePort;
    console.log(`Needle is running at http://${host}:${activePort}`);
  });
}

function shutdown() {
  const forceExit = setTimeout(() => {
    server.closeAllConnections?.();
    process.exit(0);
  }, 1_000);
  forceExit.unref();
  server.closeIdleConnections?.();
  server.close(() => {
    clearTimeout(forceExit);
    process.exit(0);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, shutdown);
}
