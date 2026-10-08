import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// All non-public files are synthetic fixtures outside the temporary document root.
test('HTTP exposes only public files within the configured roots', { timeout: 15000 }, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'needle-boundary-'));
  const root = path.join(temp, 'public');
  const packs = path.join(temp, 'packs');
  const pack = path.join(packs, 'fixture');
  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(pack, { recursive: true });
  await fs.writeFile(path.join(root, 'index.html'), '<p>public fixture</p>');
  await fs.writeFile(path.join(temp, 'owner.txt'), 'synthetic non-public fixture');
  await fs.writeFile(path.join(pack, '.env'), 'synthetic non-public fixture');
  await fs.writeFile(path.join(pack, 'visible.txt'), 'public fixture');
  await fs.writeFile(path.join(packs, 'active.json'), JSON.stringify({ packId: 'fixture' }));
  await fs.symlink(path.join(temp, 'owner.txt'), path.join(root, 'external.txt'));
  await fs.symlink(path.join(temp, 'owner.txt'), path.join(pack, 'external.txt'));
  await fs.mkdir(path.join(root, 'nested'));
  await fs.symlink(path.join(temp, 'owner.txt'), path.join(root, 'nested', 'index.html'));
  const child = spawn(process.execPath, ['scripts/serve.mjs', '--root', root, '--packs', packs, '--host', '127.0.0.1', '--port', '0'], {
    env: { ...process.env, NEEDLE_IMAGE_CACHE_ROOT: path.join(temp, 'cache') }, stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit'); child.kill(); await exited;
    }
    await fs.rm(temp, { recursive: true, force: true });
  });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 5000);
    timer.unref();
    let output = '';
    child.once('error', reject);
    child.once('exit', () => reject(new Error('Server exited before startup')));
    child.stdout.on('data', bytes => {
      output += bytes;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await fetch(`${base}/packs/fixture/visible.txt`)).status, 200);
  for (const requestPath of ['/external.txt', '/packs/fixture/external.txt', '/packs/fixture/%252eenv', '/packs/fixture/%2eenv', '/.git/config', '/%zz']) {
    const response = await fetch(`${base}${requestPath}`);
    assert.equal(response.status, 404, requestPath);
    assert.equal(await response.text(), 'Not found', requestPath);
  }
  // A denied directory index may fall back to the SPA, but must never expose its target.
  assert.notEqual(await (await fetch(`${base}/nested/`)).text(), 'synthetic non-public fixture');
});
