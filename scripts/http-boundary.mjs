import fs from 'node:fs/promises';
import path from 'node:path';

/** Decode once. Ambiguous double encodings and non-public path segments fail closed. */
export function decodePublicPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (/[\x00-\x1f\x7f\\]/.test(decoded) || /%[0-9a-f]{2}/i.test(decoded)) return null;
    if (decoded.split('/').some(segment => segment.startsWith('.'))) return null;
    return decoded;
  } catch { return null; }
}

function publicRelative(base, candidate) {
  const relative = path.relative(base, candidate);
  return !path.isAbsolute(relative) && !relative.split(path.sep).some(segment => segment.startsWith('.'));
}

/** Both lexical and realpath boundaries are checked, including directory indexes. */
export async function existingPublicFile(base, candidate) {
  if (!candidate || !publicRelative(path.resolve(base), path.resolve(candidate))) return null;
  try {
    const canonicalBase = await fs.realpath(base);
    let canonical = await fs.realpath(candidate);
    if (!publicRelative(canonicalBase, canonical)) return null;
    let stats = await fs.stat(canonical);
    if (stats.isDirectory()) {
      canonical = await fs.realpath(path.join(canonical, 'index.html'));
      if (!publicRelative(canonicalBase, canonical)) return null;
      stats = await fs.stat(canonical);
    }
    return stats.isFile() ? { filePath: canonical, stats } : null;
  } catch { return null; }
}
