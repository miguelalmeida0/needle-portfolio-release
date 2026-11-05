import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const IMAGE_LIMITS = Object.freeze({ dailyTransforms: 2000, transformsPerMinute: 120,
  dailyRemoteRequests: 1000, dailyRemoteBytes: 256 * 1024 * 1024, dailyResponseBytes: 1024 * 1024 * 1024 });

export function imageError(message, statusCode = 503, retryAfter = 60) {
  return Object.assign(new Error(message), { statusCode, retryAfter });
}

export function imageLimitsFromEnv(env = process.env) {
  const result = {};
  for (const [name, variable] of Object.entries({ dailyTransforms: 'NEEDLE_IMAGE_DAILY_TRANSFORMS',
    transformsPerMinute: 'NEEDLE_IMAGE_TRANSFORMS_PER_MINUTE', dailyRemoteRequests: 'NEEDLE_IMAGE_DAILY_REMOTE_REQUESTS',
    dailyRemoteBytes: 'NEEDLE_IMAGE_DAILY_REMOTE_BYTES', dailyResponseBytes: 'NEEDLE_IMAGE_DAILY_RESPONSE_BYTES' })) {
    const value = env[variable] === undefined ? IMAGE_LIMITS[name] : Number(env[variable]);
    if (!Number.isSafeInteger(value) || value < 0 || value > 1024 ** 4) throw new Error(`Invalid ${variable}`);
    result[name] = value;
  }
  return result;
}

/** Shared-disk transactions reserve work before it starts, including across restarts.
 * Failed/abandoned downloads retain their full reservation; only completed reads
 * settle unused bytes. This file must survive container replacement with the cache.
 */
export function createImageBudget({ filePath, limits = {}, now = Date.now }) {
  const policy = { ...IMAGE_LIMITS, ...limits };
  for (const value of Object.values(policy)) if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid image budget');
  function transaction(run) {
    let db;
    try {
      mkdirSync(path.dirname(filePath), { recursive: true });
      db = new DatabaseSync(filePath);
      db.exec(`PRAGMA busy_timeout=250; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS usage(day TEXT PRIMARY KEY, transforms INTEGER NOT NULL DEFAULT 0,
          remote_requests INTEGER NOT NULL DEFAULT 0, remote_bytes INTEGER NOT NULL DEFAULT 0, response_bytes INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS minutes(slot INTEGER PRIMARY KEY, transforms INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY, day TEXT NOT NULL, bytes INTEGER NOT NULL);
        BEGIN IMMEDIATE;`);
      const time = now(), day = new Date(time).toISOString().slice(0, 10), slot = Math.floor(time / 60000);
      db.prepare('INSERT OR IGNORE INTO usage(day) VALUES(?)').run(day);
      db.prepare('DELETE FROM minutes WHERE slot < ?').run(slot - 1);
      // Keep the current day plus prior day for in-flight midnight settlements.
      const cutoff = new Date(time - 86400000).toISOString().slice(0, 10);
      db.prepare('DELETE FROM usage WHERE day < ?').run(cutoff);
      db.prepare('DELETE FROM reservations WHERE day < ?').run(cutoff);
      const result = run(db, day, slot);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      try { db?.exec('ROLLBACK'); } catch { /* no transaction was opened */ }
      if (error.statusCode) throw error;
      throw imageError('Image work accounting is unavailable.');
    } finally { db?.close(); }
  }
  return {
    reserveDelivery(bytes) {
      if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid image delivery size');
      transaction((db, day) => {
        const result = db.prepare('UPDATE usage SET response_bytes=response_bytes+? WHERE day=? AND response_bytes<=?')
          .run(bytes, day, policy.dailyResponseBytes - bytes);
        if (!result.changes) throw imageError('Image delivery limit reached. Please try again later.', 429);
      });
    },
    reserveTransform() {
      return transaction((db, day, slot) => {
        db.prepare('INSERT OR IGNORE INTO minutes(slot) VALUES(?)').run(slot);
        const daily = db.prepare('UPDATE usage SET transforms=transforms+1 WHERE day=? AND transforms<?').run(day, policy.dailyTransforms);
        const minute = db.prepare('UPDATE minutes SET transforms=transforms+1 WHERE slot=? AND transforms<?').run(slot, policy.transformsPerMinute);
        if (!daily.changes || !minute.changes) throw imageError('Image preparation limit reached. Cached images remain available.', 429);
      });
    },
    reserveRemote(maxBytes) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('Invalid remote reservation');
      const id = randomUUID();
      transaction((db, day) => {
        const result = db.prepare(`UPDATE usage SET remote_requests=remote_requests+1,remote_bytes=remote_bytes+?
          WHERE day=? AND remote_requests<? AND remote_bytes<=?`).run(maxBytes, day, policy.dailyRemoteRequests, policy.dailyRemoteBytes - maxBytes);
        if (!result.changes) throw imageError('Museum download limit reached. Cached images remain available.', 429);
        db.prepare('INSERT INTO reservations(id,day,bytes) VALUES(?,?,?)').run(id, day, maxBytes);
      });
      return { finish(bytes) {
        if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > maxBytes) throw new Error('Invalid download settlement');
        transaction(db => {
          const reservation = db.prepare('SELECT day,bytes FROM reservations WHERE id=?').get(id);
          if (!reservation) return;
          db.prepare('UPDATE usage SET remote_bytes=remote_bytes-? WHERE day=?').run(reservation.bytes - bytes, reservation.day);
          db.prepare('DELETE FROM reservations WHERE id=?').run(id);
        });
      } };
    }
  };
}
