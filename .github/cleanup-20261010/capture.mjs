import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium, webkit } = require('@playwright/test');
const [repo, phase, evidence] = process.argv.slice(2);
const base = 'http://127.0.0.1:4301';
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
let args;
if (repo === 'portfolio') {
  args = ['node_modules/wrangler/bin/wrangler.js', 'pages', 'dev', '.svelte-kit/cloudflare', '--ip', '127.0.0.1', '--port', '4301', '--log-level', 'error', '--show-interactive-dev-session=false'];
} else {
  Object.assign(env, {
    NODE_ENV: 'development', AI_ENABLED: 'false', GHOSTWRITER_RELEASE_PROFILE: 'isolated-e2e',
    GHOSTWRITER_ABUSE_STORE_MODE: 'memory', GHOSTWRITER_ALLOW_PUBLIC_SHARING: 'true',
    GHOSTWRITER_E2E_FIXTURE_MODE: 'true', GHOSTWRITER_NEXT_DIST_DIR: `.tmp/cleanup-${phase}`,
    GHOSTWRITER_POW_DIFFICULTY: '0', GHOSTWRITER_PROVIDER: 'groq',
    GHOSTWRITER_SECURITY_SECRET: 'cleanup-e2e-secret-no-production-provider-more-than32',
    NEXT_PUBLIC_SITE_URL: base, SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key', SUPABASE_URL: 'http://127.0.0.1:54321',
  });
  args = ['node_modules/next/dist/bin/next', 'dev', '-H', '127.0.0.1', '-p', '4301'];
}
const server = spawn(process.execPath, args, { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
for (const pipe of [server.stdout, server.stderr]) pipe.on('data', data => { log = (log + data).slice(-100000); });
const output = path.join(evidence, phase);
await mkdir(output, { recursive: true });
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try { const res = await fetch(base + (repo === 'portfolio' ? '/' : '/second-voice'), { signal: AbortSignal.timeout(1500) }); if (res.ok) { ready = true; break; } } catch {}
    if (server.exitCode !== null) throw new Error('Preview server exited: ' + log);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Preview did not start: ' + log);
  const routes = repo === 'portfolio' ? ['/', '/story', '/cv', '/work/needle', '/work/second-voice', '/work/f24', '/work/flow', '/work/leu'] : ['/second-voice', '/second-voice/case-study', '/g/cleanup-does-not-exist'];
  for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await type.launch();
    try {
      for (const width of [390, 1440]) for (const route of routes) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'Europe/Berlin' });
        await page.clock.setFixedTime(new Date('2026-10-10T12:00:00Z'));
        await page.addInitScript(() => {
          sessionStorage.setItem('seen-intro', 'true');
          HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
        });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 });
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
        await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
        await page.waitForTimeout(500);
        const name = `${engine}-${width}-${route.replace(/[^a-z0-9]+/gi, '-') || 'home'}`;
        await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true, animations: 'disabled' });
        const appearance = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,p,button,input,textarea,nav,main,section,article,a')].map(el => {
          const box = el.getBoundingClientRect(), css = getComputedStyle(el);
          return { tag: el.tagName, text: el.textContent?.trim().slice(0,100), x: box.x, y: box.y, w: box.width, h: box.height,
            color: css.color, background: css.backgroundColor, font: css.font, padding: css.padding, margin: css.margin, display: css.display, border: css.border, overflow: css.overflow };
        }));
        await writeFile(path.join(output, name + '.json'), JSON.stringify({ status: response.status(), errors, appearance }, null, 2));
        await page.close();
      }
    } finally { await browser.close(); }
  }
} finally {
  await writeFile(path.join(evidence, `server-${phase}.log`), log);
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
  await new Promise(resolve => setTimeout(resolve, 1200));
  try { process.kill(-server.pid, 'SIGKILL'); } catch {}
}
