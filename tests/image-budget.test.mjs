import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createImageBudget } from '../scripts/image-budget.mjs';

async function fixture(t, limits, clock = () => Date.UTC(2026, 10, 5)) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'needle-usage-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const options = { filePath: path.join(dir, 'usage.sqlite'), limits, now: clock };
  return { budget: createImageBudget(options), options };
}

test('cold-work reservations persist across instances and UTC days reset independently', async t => {
  let time = Date.UTC(2026, 10, 5);
  const { budget, options } = await fixture(t, { dailyTransforms: 2, transformsPerMinute: 2 }, () => time);
  budget.reserveTransform();
  createImageBudget(options).reserveTransform();
  assert.throws(() => budget.reserveTransform(), error => error.statusCode === 429);
  time += 60000;
  assert.throws(() => createImageBudget(options).reserveTransform(), error => error.statusCode === 429, 'A new minute cannot reset the daily limit');
  time += 86400000;
  createImageBudget(options).reserveTransform();
});

test('remote reservations account for concurrent work, actual bytes and abandoned attempts', async t => {
  const { budget, options } = await fixture(t, { dailyRemoteBytes: 100, dailyRemoteRequests: 3 });
  const first = budget.reserveRemote(60);
  assert.throws(() => createImageBudget(options).reserveRemote(60), error => error.statusCode === 429);
  first.finish(20);
  first.finish(0); // Settlement must not refund the same reservation twice.
  budget.reserveRemote(60); // Crash/failed fetch: the full reservation remains charged.
  assert.throws(() => createImageBudget(options).reserveRemote(21), error => error.statusCode === 429);
  budget.reserveRemote(20).finish(0);
  assert.throws(() => budget.reserveRemote(1), error => error.statusCode === 429, 'Byte refunds never refund the request count');
});

test('unreadable or corrupt usage storage fails closed', async t => {
  const { budget, options } = await fixture(t, {});
  await fs.writeFile(options.filePath, 'not a SQLite database');
  assert.throws(() => budget.reserveTransform(), error => error.statusCode === 503);
});

test('cached image delivery bytes remain bounded across server instances', async t => {
  const { budget, options } = await fixture(t, { dailyResponseBytes: 100 });
  budget.reserveDelivery(60);
  createImageBudget(options).reserveDelivery(40);
  assert.throws(() => budget.reserveDelivery(1), error => error.statusCode === 429);
});

test('concurrent processes cannot overspend shared-disk response reservations', async t => {
  const { budget, options } = await fixture(t, { dailyResponseBytes: 100 });
  budget.reserveDelivery(0);
  const script = `import {createImageBudget} from './scripts/image-budget.mjs';
    try {createImageBudget({filePath:process.argv[1],limits:{dailyResponseBytes:100}}).reserveDelivery(60);process.stdout.write('allowed');}
    catch(error){process.stdout.write(String(error.statusCode));}`;
  const results = await Promise.all(Array.from({ length: 4 }, () => promisify(execFile)(process.execPath,
    ['--input-type=module', '-e', script, options.filePath], { cwd: new URL('../', import.meta.url), timeout: 10000 })));
  assert.equal(results.filter(result => result.stdout === 'allowed').length, 1);
  assert.ok(results.every(result => ['allowed', '429', '503'].includes(result.stdout)));
});
