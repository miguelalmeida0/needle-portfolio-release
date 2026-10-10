from pathlib import Path
import hashlib, json, os, shutil, subprocess, sys
repo, evidence = sys.argv[1], Path(sys.argv[2])
control = Path(__file__).resolve().parent
root = Path.cwd()
evidence.mkdir(parents=True, exist_ok=True)
results = []

def run(phase, label, command, timeout=600, env=None):
    print('RUN', phase, label, flush=True)
    merged = os.environ.copy()
    if env: merged.update(env)
    try:
        p = subprocess.run(command, shell=True, executable='/bin/bash', stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=timeout, env=merged, start_new_session=True)
        code, log = p.returncode, p.stdout
    except subprocess.TimeoutExpired as e:
        code, log = 124, (e.stdout or b'').decode() if isinstance(e.stdout, bytes) else (e.stdout or '')
    (evidence / f'{phase}-{label}.log').write_text(log)
    results.append({'phase': phase, 'check': label, 'code': code})
    print(log[-9000:], flush=True)
    print('EXIT', code, flush=True)
    return code

def manifest(folders):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for folder in folders for p in sorted((root / folder).rglob('*')) if p.is_file()}

protected_before = manifest(['static', 'public', 'data-packs'])
css_before = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*.css') if 'node_modules' not in p.parts and '.git' not in p.parts and '.next' not in p.parts}
install = run('setup', 'install', 'npm ci', 600)
assert install == 0, 'Dependencies must install before any candidate validation'
if repo in ['portfolio', 'second-voice']:
    assert run('setup', 'browsers', 'npx playwright install --with-deps chromium webkit', 600) == 0
buildenv = {
    'AI_ENABLED': 'false', 'GHOSTWRITER_PROVIDER': 'groq', 'GHOSTWRITER_ABUSE_STORE_MODE': 'supabase',
    'GHOSTWRITER_CLIENT_IP_HEADER': 'x-forwarded-for', 'GHOSTWRITER_SECURITY_SECRET': 'cleanup-test-only-security-secret-not-a-real-provider-key',
    'GHOSTWRITER_TRUST_PROXY': 'true', 'NEXT_PUBLIC_SITE_URL': 'https://ghostwriter.example',
    'NODE_ENV': 'production', 'SUPABASE_PUBLISHABLE_KEY': 'ci-publishable-key',
    'SUPABASE_SERVICE_ROLE_KEY': 'ci-service-role-key', 'SUPABASE_URL': 'https://supabase.example',
}
baseline_dist = None
for phase in ['before', 'after']:
    if phase == 'after':
        assert run(phase, 'apply', f'python3 {control}/apply.py {repo}', 30) == 0
    if repo == 'needle-portfolio-release':
        run(phase, 'verify', 'npm run verify', 300)
        run(phase, 'previews', 'npm run prepare:previews', 300)
    elif repo == 'portfolio':
        run(phase, 'check', 'npm run check')
        run(phase, 'unit', 'npm run test:unit')
        run(phase, 'routes', 'npm run test:routes')
        run(phase, 'dev-watch', 'npm run test:dev-watch')
        run(phase, 'build', 'npm run build')
        run(phase, 'capture', f'node {control}/capture.mjs {repo} {phase} {evidence}', 600)
        run(phase, 'browser-smoke', 'mkdir -p .cache/tmp && TMPDIR=$PWD/.cache/tmp npx playwright test tests/e2e/specs/ci-smoke.spec.ts tests/e2e/specs/story-motion.spec.ts tests/e2e/specs/story-editorial-transition.spec.ts tests/e2e/specs/cv-highlights-alignment.spec.ts tests/e2e/specs/leu-showcase.spec.ts --project=chromium-desktop --project=chromium-mobile --workers=2 --retries=0 --reporter=list', 600)
    elif repo == 'flow':
        run(phase, 'lint', 'npm run lint')
        run(phase, 'unit', f'npm run test:run -- --reporter=json --outputFile={evidence}/{phase}-vitest.json', 600)
        run(phase, 'kernel', 'npm run test:run -- src/kernel', 180)
        run(phase, 'build', 'npm run build')
    elif repo == 'second-voice':
        run(phase, 'lint', 'npm run lint')
        run(phase, 'typecheck', 'npx next typegen && npx tsc --noEmit')
        run(phase, 'security-tests', 'npm run test:security')
        run(phase, 'scroll', 'npm run test:scroll')
        run(phase, 'security-check', 'npm run security:check', env=buildenv)
        run(phase, 'build', 'npm run build -- --webpack', env=buildenv)
        run(phase, 'capture', f'node {control}/capture.mjs {repo} {phase} {evidence}', 600)
        run(phase, 'browser-smoke', 'npx playwright test tests/e2e/specs/duet.spec.ts tests/e2e/specs/duet-action.spec.ts tests/e2e/specs/error-states.spec.ts --project=chromium --project=mobile-webkit --workers=2 --retries=0 --reporter=list', 600)
    if repo in ['flow', 'needle-portfolio-release']:
        current = manifest(['dist'])
        if phase == 'before': baseline_dist = current
        else: assert baseline_dist == current, 'Served output must remain byte-for-byte identical'
    (evidence / 'checks.json').write_text(json.dumps(results, indent=2))

assert protected_before == manifest(['static', 'public', 'data-packs']), 'Public media and canonical data must remain unchanged'
for name, digest in css_before.items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name

comparisons = []
if repo in ['portfolio', 'second-voice']:
    for before in sorted((evidence / 'before').glob('*')):
        after = evidence / 'after' / before.name
        comparisons.append({'file': before.name, 'same': after.exists() and before.read_bytes() == after.read_bytes()})
    (evidence / 'visual-comparison.json').write_text(json.dumps(comparisons, indent=2))
    print('Render comparisons:', sum(c['same'] for c in comparisons), '/', len(comparisons), flush=True)

for name in ['tests/lifecycle.test.mjs', 'tests/ghostwriter-client-session.test.ts']:
    if (root / name).exists(): subprocess.run(['git', 'add', '-N', name], check=True)
(evidence / 'candidate.patch').write_bytes(subprocess.check_output(['git', 'diff', '--binary']))
changed = subprocess.check_output(['git', 'diff', '--name-only'], text=True).splitlines()
(evidence / 'candidate-files.json').write_text(json.dumps({name: {'gitBlob': subprocess.check_output(['git', 'hash-object', name], text=True).strip(), 'sha256': hashlib.sha256((root / name).read_bytes()).hexdigest()} if (root / name).exists() else None for name in changed}, indent=2))
print(subprocess.check_output(['git', 'diff', '--stat'], text=True))

bad = []
for r in results:
    if r['phase'] != 'after' or r['code'] == 0: continue
    prior = next((x for x in results if x['phase'] == 'before' and x['check'] == r['check']), None)
    if repo == 'flow' and r['check'] == 'unit' and prior and prior['code'] == r['code'] and r['code'] != 124:
        def failures(phase):
            data = json.loads((evidence / f'{phase}-vitest.json').read_text())
            return sorted(t['fullName'] for s in data['testResults'] for t in s['assertionResults'] if t['status'] == 'failed'), data['numTotalTests']
        assert failures('before') == failures('after'), 'Existing full-suite failures must match exactly'
        print('KNOWN BASELINE FAILURES (unchanged):', failures('after'), flush=True)
    else: bad.append(r)
assert not bad, json.dumps(bad)
print('All required candidate checks passed; inspect visual comparison artifact before promotion.', flush=True)
