from pathlib import Path
import json, re, shutil, subprocess, sys
root = Path.cwd()
control = Path(__file__).resolve().parent
repo = sys.argv[1]

def replace(path, old, new):
    p = root / path
    source = p.read_text()
    assert source.count(old) == 1, (path, old)
    p.write_text(source.replace(old, new))

def delete(paths):
    for name in paths:
        p = root / name
        assert p.is_file(), name
        p.unlink()

if repo == 'needle-portfolio-release':
    replace('package.json', '    "preverify": "npm run assemble:release",\n', '')
    shutil.copyfile(control / 'lifecycle.test.mjs', root / 'tests/lifecycle.test.mjs')
elif repo == 'flow':
    delete(['src/kernel/contextGraph.ts', 'src/kernel/earmark.ts', 'src/kernel/proactive.ts', 'src/kernel/search.ts'])
elif repo == 'portfolio':
    paths = []
    for folder, names in {
        'src/lib/components/case-study/': ['ArchitectureFlow','CameraFeatureGallery','CaseStudyHero','CaseStudySection','CaseStudySectionNav','EvidenceTimeline','InteractiveArchitecture','ProjectLinks','RecruiterSummary','SystemComparison','TestInterpretationTable'],
        'src/lib/components/shared/': ['ActionLink','ButtonLink','CopyEmailAction','FadeIn','MotionToggle','ProfessionalRecommendation','Reveal'],
        'src/lib/components/work/': ['InteractiveWorkGrid','MediaProjectTile','ProjectMedia'],
        'src/lib/components/miguel-llm/': ['MiguelLLMAnswer','MiguelLLMDrawer','MiguelLLMHeroCard','MiguelLLMInput','MiguelLLMModeTabs','MiguelLLMSourceChips','MiguelLLMStatus','MiguelLLMSuggestedQuestions'],
    }.items():
        paths.extend(folder + name + '.svelte' for name in names)
    paths += ['src/lib/components/experience/FlowTransactionWalkthrough.svelte', 'src/lib/components/experience/needle/CacheJourney.svelte', 'src/lib/components/experience/needle/SourceLink.svelte', 'src/lib/content/homepage-projects-release.ts', 'src/lib/content/portfolio-index.ts', 'src/lib/design/tokens.ts', 'src/lib/utils/anchors.ts', 'src/lib/utils/clipboard.ts', 'src/lib/utils/cn.ts', 'src/lib/utils/pointer-bucket.ts', 'src/lib/motion/actions/chapterProgress.ts', 'src/lib/motion/actions/pointerDepth.ts']
    assert len(paths) == 41
    delete(paths)
elif repo == 'second-voice':
    p = root / 'src/lib/ghostwriter-client-guard.ts'
    source = p.read_text()
    assert 'withGhostwriterSession' not in source
    p.write_text(source + '''
/** Renew a rejected shield session once; never retry unrelated operation failures. */
export async function withGhostwriterSession<T>(
  signal: AbortSignal,
  request: (csrfToken: string) => Promise<T>,
): Promise<T> {
  let csrfToken = readGhostwriterCsrfToken();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (!csrfToken) throw new Error(RECOVERABLE_SESSION_ERRORS[0]);
      return await request(csrfToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (attempt === 0 && isRecoverableSessionError(message)) {
        csrfToken = await refreshGhostwriterShieldSession({ signal });
        if (csrfToken) continue;
      }
      throw error;
    }
  }
  throw new Error(RECOVERABLE_SESSION_ERRORS[0]);
}
''')
    p = root / 'src/components/ghostwriter/GhostwriterPage.tsx'
    source = p.read_text()
    start = '    try {\n      let csrfToken = readGhostwriterCsrfToken();'
    end = '          throw attemptError;\n        }\n      }\n'
    for _ in range(3):
        a = source.index(start)
        b = source.index(end, a) + len(end)
        block = source[a:b]
        original = block[block.index('          const challenge = '):block.index('        } catch (attemptError)')]
        core = '\n'.join(line[2:] if line.startswith('  ') else line for line in original.rstrip('\n').split('\n'))
        assert re.sub(r'\s+', '', core) == re.sub(r'\s+', '', original)
        source = source[:a] + '    try {\n      return await withGhostwriterSession(abortController.signal, async (csrfToken) => {\n' + core + '\n      });\n' + source[b:]
    for symbol in ['isRecoverableSessionError', 'readGhostwriterCsrfToken', 'refreshGhostwriterShieldSession']:
        source = source.replace('  ' + symbol + ',\n', '')
    source = source.replace('  issueGhostwriterChallenge,\n', '  issueGhostwriterChallenge,\n  withGhostwriterSession,\n')
    assert source.count('withGhostwriterSession(') == 3 and 'attemptError' not in source
    p.write_text(source)
    p = root / 'src/components/ghostwriter/RewriteLabPanel.tsx'
    source = p.read_text()
    a = source.index('  let csrfToken = readGhostwriterCsrfToken();')
    b = source.index('\nfunction getLabErrorMessage', a)
    block = source[a:b]
    original = block[block.index('      const challenge = '):block.index('    } catch (error)')]
    core = '\n'.join(line[2:] if line.startswith('  ') else line for line in original.rstrip('\n').split('\n'))
    assert re.sub(r'\s+', '', core) == re.sub(r'\s+', '', original)
    source = source[:a] + '  return await withGhostwriterSession(signal, async (csrfToken) => {\n' + core + '\n  });\n}\n' + source[b:]
    for symbol in ['isRecoverableSessionError', 'readGhostwriterCsrfToken', 'refreshGhostwriterShieldSession']:
        source = source.replace('  ' + symbol + ',\n', '')
    source = source.replace('  issueGhostwriterChallenge,\n', '  issueGhostwriterChallenge,\n  withGhostwriterSession,\n')
    p.write_text(source)
    path = 'tests/ui-layout-guard.test.ts'
    replace(path, '  assert.match(page, /refreshGhostwriterShieldSession/);', '  assert.match(page, /withGhostwriterSession/);\n  assert.match(readFileSync(CLIENT_GUARD_PATH, "utf8"), /refreshGhostwriterShieldSession/);')
    replace(path, '  assert.match(panel, /readGhostwriterCsrfToken/);', '  assert.match(panel, /withGhostwriterSession/);\n  assert.match(readFileSync(CLIENT_GUARD_PATH, "utf8"), /readGhostwriterCsrfToken/);')
    replace(path, '  assert.match(page, /isRecoverableSessionError\\(message\\)/);', '  assert.match(page, /withGhostwriterSession/);\n  assert.match(clientGuard, /isRecoverableSessionError\\(message\\)/);')
    for file in ['page.tsx', 'not-found.tsx']:
        path = 'src/app/g/[id]/' + file
        replace(path, 'import { BlurOrbs } from "@/components/ghostwriter/BlurOrbs";\n', '')
        replace(path, '      <BlurOrbs />\n', '')
    delete(['src/components/ghostwriter/BlurOrbs.tsx'])
    shutil.copyfile(control / 'ghostwriter-client-session.test.ts', root / 'tests/ghostwriter-client-session.test.ts')
else:
    raise ValueError(repo)
subprocess.run(['git', 'diff', '--check'], check=True)
print('Applied only reviewed candidate changes to disposable', repo, 'checkout')
