import json
import os
import re
import shutil
import sys

S = sys.argv[1]
REPO = r'<repo>'
SRC = os.path.join(os.environ['USERPROFILE'], '.claude', 'task-tree-waits', 'local_d0b58b27-93dc-4e29-8c0c-4a1f74a38efc.json')
OUT = os.path.join(S, 'probeG')

pub = json.load(open(SRC, encoding='utf-8'))
json.dump(pub, open(os.path.join(S, 'orq-g.json'), 'w', encoding='utf-8'))

# The mod as it is in the working tree, without its tests.
if os.path.exists(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
shutil.copytree(os.path.join(REPO, 'task-tree'), os.path.join(OUT, 'task-tree'))
if os.path.exists(os.path.join(REPO, '.claude-plugin')):
    shutil.copytree(os.path.join(REPO, '.claude-plugin'), os.path.join(OUT, '.claude-plugin'))
tests = os.path.join(OUT, 'task-tree', 'tests')
for f in os.listdir(tests):
    if f.endswith('.test.ts'):
        os.remove(os.path.join(tests, f))

# The fixture in the shape of fixtures/orquestradora-real.ts: `own` (the published file, its
# children as the state holds them) and `files` (each child's published file, from its panel).
own = dict(pub)
files = {}
for c in pub.get('children', []):
    p = c.get('panel') or {}
    f = {'version': 1, 'waiting': bool(c.get('waiting')), 'groups': p.get('groups', []), 'waits': p.get('waits', []), 'children': p.get('children', [])}
    for k in ('work', 'received', 'sends'):
        if k in p:
            f[k] = p[k]
    if c.get('context') is not None:
        f['context'] = {'percent': c['context'], 'at': pub.get('at')}
    if c.get('engine'):
        f['engine'] = c['engine']
    files[c['id']] = json.dumps(f)
own['children'] = [{k: v for k, v in c.items() if k != 'panel'} for c in pub.get('children', [])]
objs = {k: json.loads(v) for k, v in files.items()}
src = ('const OWN: any = ' + json.dumps(own) + '\n'
       + 'const FILES: Record<string, unknown> = ' + json.dumps(objs) + '\n'
       + "export const REAL: any = { me: 'local_d0b58b27-93dc-4e29-8c0c-4a1f74a38efc', own: OWN, files: Object.fromEntries(Object.entries(FILES).map(([k, v]) => [k, JSON.stringify(v)])) }\n")
open(os.path.join(tests, 'fixtures', 'orq-g.ts'), 'w', encoding='utf-8').write(src)
print('fixture bytes', len(src.encode('utf-8')))

# The budget test turned into a probe: same host, every surface and view measured, nothing asserted.
t = open(os.path.join(REPO, 'task-tree', 'tests', 'orcamento.test.ts'), encoding='utf-8').read()
t = t.replace("import { REAL } from './fixtures/orquestradora-real'", "import { REAL } from './fixtures/orq-g'")
start = t.index("// One test per surface and view")
probe = r'''
const count = (el: any): { nodes: number; depth: number; maxSvg: number; svgTotal: number } => {
  let nodes = 0, depth = 0, maxSvg = 0, svgTotal = 0
  const go = (e: any, d: number) => {
    if (!e || typeof e !== 'object') return
    nodes++
    if (d > depth) depth = d
    if (e.type === 'Svg') {
      const n = String(e.props?.source ?? '').length
      svgTotal += n
      if (n > maxSvg) maxSvg = n
    }
    for (const c of e.children ?? []) go(c, d + 1)
  }
  go(el, 1)
  return { nodes, depth, maxSvg, svgTotal }
}
describe('sonda G', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    for (const view of ['summary', 'full'] as const) {
      test(`G ${surface}/${view}`, { timeoutMs: 60000 } as any, async ($: any, on: any) => {
        const h = host(on)
        await $.session.start({ cwd: '.' } as any)
        try { await settled($, h, 4500) } catch (err) { console.log('PROBEG settle ' + String(err)) }
        await setView($, view)
        const t0 = now()
        const ui = await $.ui.mount({ plugin: 'task-tree', surface, component: 'Pane', props: PROPS(100), requestId: 'task-tree' })
        const root: any = await ui.drawn()
        const ms = now() - t0
        await ui.unmount()
        const c = count(root)
        const text = shown(root)
        console.log('PROBEG ' + JSON.stringify({ surface, view, size: JSON.stringify(root).length, ...c, ms: Math.round(ms), big: text.includes('Painel grande demais'), error: text.includes('erro ao desenhar'), head: text.slice(0, 160) }))
      })
    }
  }
})
'''
t = t[:start] + probe
open(os.path.join(tests, 'sonda-g.test.ts'), 'w', encoding='utf-8').write(t)
print('probe ready; published', os.path.getsize(SRC) // 1024, 'KB;', len(files), 'children')
