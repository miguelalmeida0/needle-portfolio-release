import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Keep one tracked corpus and reproduce the byte-identical static fallback.
const root = fileURLToPath(new URL('../', import.meta.url));
const pointer = JSON.parse(await readFile(path.join(root, 'data-packs/active.json'), 'utf8'));
if (!/^[a-z0-9-]+$/.test(pointer.packId)) throw new Error('Invalid active pack ID');
const pack = path.join(root, 'data-packs', pointer.packId);
const manifest = JSON.parse(await readFile(path.join(pack, 'manifest.json'), 'utf8'));
const source = path.join(pack, 'corpus.json');
const bytes = await readFile(source);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== manifest.corpusSha256) throw new Error('Active corpus checksum mismatch');
const destination = path.join(root, 'dist/data/corpus.json');
await mkdir(path.dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`Static corpus assembled: ${bytes.length} bytes, SHA-256 ${sha256}`);
