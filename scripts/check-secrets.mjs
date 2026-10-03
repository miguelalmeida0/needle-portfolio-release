import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const rules = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})/],
  ['cloud access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['provider token', /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{30,}/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}/],
  ['credential URL', /:\/\/[^\s/:"']+:[^\s/@"']{8,}@/],
  ['literal secret', /(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[=:]\s*["'][A-Za-z0-9_+/=-]{20,}["']/i]
];
const forbidden = /(?:^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519)$|\.(?:pem|key|p12|pfx)$/i;
const findings = [];
const git = args => execFileSync('git', args, { maxBuffer: 512 * 1024 * 1024 });
function scan(label, bytes) {
  if (bytes.includes(0)) return;
  const text = bytes.toString('utf8');
  for (const [name, pattern] of rules) if (pattern.test(text)) findings.push(`${label}: ${name}`);
}
const tracked = git(['ls-files', '-z']).toString().split('\0').filter(Boolean);
for (const file of tracked) {
  if (forbidden.test(file)) findings.push(`${file}: forbidden credential file`);
  scan(file, fs.readFileSync(file));
}
let historyCount = 0;
if (process.argv.includes('--history')) {
  const objects = git(['rev-list', '--objects', '--all']).toString().trim().split('\n').filter(Boolean);
  const paths = new Map(objects.map(line => { const [sha, ...path] = line.split(' '); return [sha, path.join(' ')]; }));
  for (const path of paths.values()) if (forbidden.test(path)) findings.push(`${path}: forbidden historical credential file`);
  const output = execFileSync('git', ['cat-file', '--batch'], { input: [...paths.keys()].join('\n') + '\n', maxBuffer: 512 * 1024 * 1024 });
  let offset = 0;
  while (offset < output.length) {
    const end = output.indexOf(10, offset);
    const [sha, type, sizeText] = output.subarray(offset, end).toString().split(' ');
    const size = Number(sizeText);
    if (!Number.isFinite(size)) throw new Error('Unable to inspect historical Git object.');
    offset = end + 1;
    if (type === 'blob') { scan(`${paths.get(sha)} @ ${sha.slice(0, 12)}`, output.subarray(offset, offset + size)); historyCount++; }
    offset += size + 1;
  }
}
if (findings.length) {
  console.error('Credential scan failed. Values are deliberately redacted.');
  for (const finding of new Set(findings)) console.error(finding);
  process.exitCode = 1;
} else {
  console.log(`Credential patterns: none detected in ${tracked.length} tracked files${historyCount ? ` and ${historyCount} reachable historical blobs` : ''}. This is a pattern scan, not an absolute guarantee.`);
}
