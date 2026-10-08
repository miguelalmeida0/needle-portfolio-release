import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { decodePublicPath, existingPublicFile } from '../scripts/http-boundary.mjs';

test('rejects hidden paths, traversal, double encoding and invalid bytes', () => {
  for (const input of ['/.env','/.git/config','/packs/a/.env','/packs/a/%2eenv','/packs/a/%252eenv','/packs/a/%252e%252e/x','/a/../b','/a/./b','/a\\b','/a%00b','/a%0db','/%zz','https://example.com/secret']) {
    assert.equal(decodePublicPath(input), null, input);
  }
  assert.equal(decodePublicPath('/packs/a/images/12.jpg'), '/packs/a/images/12.jpg');
  assert.equal(decodePublicPath('/artwork/blue%20vase'), '/artwork/blue vase');
});

test('public file resolution remains in the canonical serving root', async t => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(),'needle-jail-'));
  t.after(() => fs.rm(base,{recursive:true,force:true}));
  const root=path.join(base,'public'); await fs.mkdir(root);
  const outside=path.join(base,'owner.txt'); await fs.writeFile(outside,'synthetic fixture');
  await fs.writeFile(path.join(root,'page.html'),'<p>public</p>');
  await fs.writeFile(path.join(root,'.env'),'synthetic fixture');
  await fs.symlink(outside,path.join(root,'leak.txt'));
  await fs.symlink(path.join(root,'.env'),path.join(root,'hidden-alias.txt'));
  await fs.symlink(path.join(root,'page.html'),path.join(root,'ok.html'));
  assert.equal(await existingPublicFile(root,outside),null);
  assert.equal(await existingPublicFile(root,path.join(root,'leak.txt')),null);
  assert.equal(await existingPublicFile(root,path.join(root,'hidden-alias.txt')),null);
  assert.equal(await existingPublicFile(root,path.join(root,'.env')),null);
  assert.equal(await existingPublicFile(root,path.join(root,'missing.txt')),null);
  assert.equal((await existingPublicFile(root,path.join(root,'ok.html')))?.filePath,path.join(root,'page.html'));
  await fs.mkdir(path.join(root,'directory'));
  await fs.symlink(outside,path.join(root,'directory/index.html'));
  assert.equal(await existingPublicFile(root,path.join(root,'directory')),null);
  await fs.unlink(path.join(root,'directory/index.html'));
  await fs.writeFile(path.join(root,'directory/index.html'),'safe');
  assert.ok(await existingPublicFile(root,path.join(root,'directory')));
});
