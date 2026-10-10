import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('verify assembles once and standalone integrity and startup keep their preparation hooks', async t => {
  const { scripts } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  for (const hook of ['postinstall', 'precheck:integrity', 'prestart']) {
    assert.equal(scripts[hook], 'npm run assemble:release', `${hook} must still prepare the frozen corpus`);
  }
  const cwd = await mkdtemp(path.join(tmpdir(), 'needle-lifecycle-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(path.join(cwd, 'assemble.cjs'), "require('node:fs').appendFileSync('calls', 'assembly\\n')");
  await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ private: true, scripts: {
    ...scripts,
    'assemble:release': 'node assemble.cjs',
    'security:check': 'node -e \"\"',
    'check:integrity': 'node -e \"\"',
    test: 'node -e \"\"',
  } }));
  const run = spawnSync('npm', ['run', 'verify', '--silent'], { cwd, encoding: 'utf8', timeout: 30_000 });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(await readFile(path.join(cwd, 'calls'), 'utf8'), 'assembly\n');
});
