// Testes das próprias travas do selo (scripts/selos.mjs), num repositório git temporário com um
// catálogo mínimo, dois testes e um arquivo de kit. Uso: node --test scripts/travas.test.mjs.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { alteradosNoIndice, etapasDoHook } from './mudou.mjs'
import { aprovarGolden, liberaGolden, liberaTeste } from './selos.mjs'
import { impacto } from './impacto.mjs'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const SELOS = join(dirname(fileURLToPath(import.meta.url)), 'selos.mjs')
const hoje = new Date().toLocaleDateString('sv-SE')
// Sem as variáveis GIT_* do processo: dentro do hook de pré-commit elas apontam para o índice do
// commit em curso, e o git do repositório temporário escreveria nele.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')))

const CATALOGO = `# Exemplo

### exemplo.a
A regra A.

- Dado algo
- Quando algo
- Então algo

Origem: teste das travas.
Estado: coberto

### exemplo.b
A regra B.

- Dado algo
- Quando algo
- Então algo

Origem: teste das travas.
Estado: coberto
`
const TESTES = `import { expect, test } from 'claude-code/testing'

const A = 1
const B = 2

// Regra: exemplo.a
test('um', async ($: any) => {
  expect(A).toBe(1)
  expect(2).toBe(2)
})

// Regra: exemplo.b
test('dois', async ($: any) => {
  expect(3).toBe(3)
})
`
const KIT = 'export const x = 1\n'
const ARQ = 'task-tree/tests/exemplo.test.ts'
const UM = `${ARQ}::um`
const DOIS = `${ARQ}::dois`

// Um repositório novo, com tudo selado como "novo" e commitado: montado uma vez (o modelo) e copiado
// para cada caso, que o muda à vontade.
let modelo
after(() => modelo && rmSync(modelo, { recursive: true, force: true }))
function montar() {
  if (!modelo) modelo = criar()
  const dir = mkdtempSync(join(tmpdir(), 'travas-'))
  cpSync(modelo, dir, { recursive: true })
  return dir
}
function criar() {
  const dir = mkdtempSync(join(tmpdir(), 'travas-modelo-'))
  mkdirSync(join(dir, 'regras'))
  mkdirSync(join(dir, 'task-tree', 'tests', 'kit'), { recursive: true })
  writeFileSync(join(dir, 'regras', 'exemplo.md'), CATALOGO)
  writeFileSync(join(dir, ARQ), TESTES)
  writeFileSync(join(dir, 'task-tree', 'tests', 'kit', 'leitura.ts'), KIT)
  const git = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8', env })
  git('init', '-q')
  assert.equal(selos(dir, '--novos', '--motivo', 'linha de base').status, 0)
  git('add', '-A')
  git('commit', '-q', '-m', 'base')
  return dir
}
const selos = (dir, ...a) => spawnSync(process.execPath, [SELOS, '--raiz', dir, ...a], { encoding: 'utf8', env })
const conferir = dir => selos(dir)
const trocar = (dir, arq, de, para) => {
  const p = join(dir, arq)
  const t = readFileSync(p, 'utf8')
  assert.ok(t.includes(de), `"${de}" não está em ${arq}`)
  writeFileSync(p, t.replace(de, para))
}
const comMontagem = corpo => () => {
  const dir = montar()
  try {
    corpo(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('mudar o corpo de um teste sem selar falha', comMontagem(dir => {
  assert.equal(conferir(dir).status, 0)
  trocar(dir, ARQ, 'expect(2).toBe(2)', 'expect(2).toBe(3)')
  const r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /o teste mudou sem selo novo: .*::um/)
}))

test('tirar uma asserção e selar como refatoração é recusado', comMontagem(dir => {
  trocar(dir, ARQ, '  expect(2).toBe(2)\n', '')
  const r = selos(dir, '--selar', UM, '--tipo', 'refatoracao', '--motivo', 'x')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /refatoração não pode tirar asserções/)
}))

test('selar como decisão exige o cenário reescrito no catálogo', comMontagem(dir => {
  trocar(dir, ARQ, 'expect(2).toBe(2)', 'expect(2).toBe(2)\n  expect(4).toBe(4)')
  const sem = selos(dir, '--selar', UM, '--tipo', 'decisao', '--motivo', 'x')
  assert.equal(sem.status, 1)
  assert.match(sem.stderr, /reescreva o cenário no catálogo/)
  trocar(dir, 'regras/exemplo.md', 'Origem: teste das travas.\nEstado: coberto\n\n### exemplo.b', `Origem: teste das travas.\nReescrito: ${hoje}, o usuário decidiu.\nEstado: coberto\n\n### exemplo.b`)
  assert.equal(selos(dir, '--selar', UM, '--tipo', 'decisao', '--motivo', 'decisão').status, 0)
  assert.equal(conferir(dir).status, 0)
}))

test('remover um teste selado falha, e o selo só sai com decisão', comMontagem(dir => {
  trocar(dir, ARQ, "\n// Regra: exemplo.b\ntest('dois', async ($: any) => {\n  expect(3).toBe(3)\n})\n", '')
  const r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /teste selado sumiu: .*::dois/)
  assert.match(selos(dir, '--remover', DOIS, '--tipo', 'refatoracao').stderr, /exige --tipo decisao/)
  assert.match(selos(dir, '--remover', DOIS, '--tipo', 'decisao').stderr, /reescreva o cenário no catálogo/)
}))

test('mudar o kit sem selar falha', comMontagem(dir => {
  writeFileSync(join(dir, 'task-tree', 'tests', 'kit', 'leitura.ts'), 'export const x = 2\n')
  const r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /o kit mudou sem selo novo/)
}))

test('comentários e espaços não mudam o selo', comMontagem(dir => {
  trocar(dir, ARQ, '  expect(A).toBe(1)', '  // comentário novo\n  expect( A ).toBe(1)   ')
  writeFileSync(join(dir, 'task-tree', 'tests', 'kit', 'leitura.ts'), '// só um comentário\nexport const x   = 1\n')
  assert.equal(conferir(dir).status, 0)
}))

test('mudar uma constante de topo usada pelo teste falha; uma não usada, não', comMontagem(dir => {
  trocar(dir, ARQ, 'const B = 2', 'const B = 20')
  assert.equal(conferir(dir).status, 0)
  trocar(dir, ARQ, 'const A = 1', 'const A = 10')
  const r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /o teste mudou sem selo novo: .*::um/)
  unlinkSync(join(dir, ARQ))
}))

// O que o hook pula: só etapas cujos arquivos não mudaram; uma condição errada pularia uma trava.
test('o hook roda as travas só com scripts/ mudado, o validate só com o mod ou o marketplace mudados, e o tsc com task-tree/ mudado', () => {
  assert.deepEqual(etapasDoHook([]), { travas: false, validate: false, tsc: false })
  assert.deepEqual(etapasDoHook(['regras/sessoes.md']), { travas: false, validate: false, tsc: false })
  assert.deepEqual(etapasDoHook(['task-tree/tests/sessoes.test.ts', 'task-tree/tests/kit/leitura.ts']), { travas: false, validate: false, tsc: true })
  assert.equal(etapasDoHook(['task-tree/draw/layout.ts']).tsc, true)
  assert.equal(etapasDoHook(['scripts/selos.mjs']).travas, true)
  assert.equal(etapasDoHook(['scripts/travas.test.mjs']).travas, true)
  for (const p of ['task-tree/draw/layout.ts', 'task-tree/.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'task-tree/register.tsx'])
    assert.equal(etapasDoHook([p]).validate, true, p)
  assert.equal(etapasDoHook(['task-tree/tests/arvore.test.ts']).validate, false)
})

test('o que mudou é lido do índice contra HEAD, não da pasta de trabalho', comMontagem(dir => {
  const git = (...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8', env })
  assert.deepEqual(alteradosNoIndice(dir, env), [])
  // Mudado só na pasta de trabalho: não vai no commit.
  writeFileSync(join(dir, 'task-tree', 'tests', 'kit', 'leitura.ts'), 'export const x = 3\n')
  assert.deepEqual(alteradosNoIndice(dir, env), [])
  git('add', 'task-tree/tests/kit/leitura.ts')
  assert.deepEqual(alteradosNoIndice(dir, env), ['task-tree/tests/kit/leitura.ts'])
}))

// O golden do SVG: só se grava com as palavras do usuário, e um desenho mudado sem aprovação falha.
const GOLDEN_MJS = join(dirname(fileURLToPath(import.meta.url)), 'golden.mjs')
test('aprovar o golden sem as palavras do usuário e a data é recusado antes de rodar qualquer coisa', () => {
  for (const motivo of [undefined, 'ok', '2026-10-28 sem aspas', '"está certo" sem data']) {
    const r = spawnSync(process.execPath, [GOLDEN_MJS, '--aprovar', '--todos', ...(motivo === undefined ? [] : ['--motivo', motivo])], { encoding: 'utf8', env })
    assert.equal(r.status, 1, String(motivo))
    assert.match(r.stderr, /palavras do usuário entre aspas e da data/)
  }
})

test('desenho do golden sem selo, ou mudado depois da aprovação, falha', comMontagem(dir => {
  mkdirSync(join(dir, 'task-tree', 'tests', 'golden'), { recursive: true })
  writeFileSync(join(dir, 'task-tree', 'tests', 'golden', 'svg.ts'), 'export const GOLDEN: Record<string, unknown> = {"principal":[{"alt":"a","source":"<svg/>"}]}\n')
  let r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /desenho do golden sem selo: principal/)
  aprovarGolden(dir, { principal: [{ alt: 'a', source: '<svg/>' }] }, `"está certo", ${hoje}`)
  assert.equal(conferir(dir).status, 0)
  trocar(dir, 'task-tree/tests/golden/svg.ts', '<svg/>', '<svg></svg>')
  r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /o desenho do golden mudou sem aprovação: principal/)
}))

test('a regressão de desenho só passa com o desenho aprovado hoje, com hash novo', () => {
  const head = { golden: { principal: { hash: 'a', data: '2026-10-01', motivo: 'x' } } }
  assert.equal(liberaGolden({ golden: {} }, head, 'principal', hoje), false)
  assert.equal(liberaGolden({ golden: { principal: { hash: 'b', data: '2026-10-01', motivo: 'x' } } }, head, 'principal', hoje), false)
  assert.equal(liberaGolden({ golden: { principal: { hash: 'a', data: hoje, motivo: 'x' } } }, head, 'principal', hoje), false)
  assert.equal(liberaGolden({ golden: { principal: { hash: 'b', data: hoje, motivo: 'x' } } }, head, 'principal', hoje), true)
})

// O modo --base (a CI, contra a base do PR): sem "hoje", vale o selo que o PR traz.
test('na CI, um teste mudado sem selo de decisão no PR falha', () => {
  const base = { hash: 'a', tipo: 'novo', data: '2026-10-01' }
  assert.equal(liberaTeste(base, base, undefined), false)
  assert.equal(liberaTeste({ hash: 'b', tipo: 'refatoracao', data: '2026-10-01' }, base, undefined), false)
  assert.equal(liberaTeste(undefined, base, undefined), false)
})

test('na CI, o selo de decisão trazido no PR libera, mesmo de outro dia', () => {
  const base = { hash: 'a', tipo: 'novo', data: '2026-10-01' }
  assert.equal(liberaTeste({ hash: 'b', tipo: 'decisao', data: '2026-10-02' }, base, undefined), true)
  // Sem --base, o mesmo selo só vale no dia (o hook local).
  assert.equal(liberaTeste({ hash: 'b', tipo: 'decisao', data: '2026-10-02' }, base, hoje), false)
})

test('na CI, o golden mudado sem selo novo no PR falha; com selo trazido no PR, passa', () => {
  const base = { golden: { principal: { hash: 'a', data: '2026-10-01', motivo: 'x' } } }
  assert.equal(liberaGolden(base, base, 'principal', undefined), false)
  assert.equal(liberaGolden({ golden: {} }, base, 'principal', undefined), false)
  assert.equal(liberaGolden({ golden: { principal: { hash: 'b', data: '2026-10-02', motivo: 'x' } } }, base, 'principal', undefined), true)
})

// A matriz de impacto: o mapa de código no catálogo (Código da área / Código) e o npm run impacto.
const REGRAS_MJS = join(dirname(fileURLToPath(import.meta.url)), 'regras.mjs')
function mapa(area, cenario) {
  const dir = mkdtempSync(join(tmpdir(), 'travas-mapa-'))
  mkdirSync(join(dir, 'regras'))
  mkdirSync(join(dir, 'task-tree', 'tests'), { recursive: true })
  mkdirSync(join(dir, 'task-tree', 'hooks'), { recursive: true })
  mkdirSync(join(dir, 'task-tree', 'draw'), { recursive: true })
  writeFileSync(join(dir, 'task-tree', 'hooks', 'turn.ts'), 'export const x = 1\n')
  writeFileSync(join(dir, 'task-tree', 'draw', 'layout.ts'), 'export const y = 1\n')
  writeFileSync(join(dir, 'task-tree', 'hooks', 'render.tsx'), 'export const z = 1\n')
  const md = ['# Turnos', '', area, '', '### turnos.um', 'Um.', '', cenario, 'Estado: coberto', '', '### turnos.dois', 'Dois.', '', 'Estado: checklist (só no app)', '']
  writeFileSync(join(dir, 'regras', 'turnos.md'), md.join('\n'))
  writeFileSync(join(dir, 'task-tree', 'tests', 'turnos.test.ts'), "// Regra: turnos.um\ntest('um', async () => {})\n")
  return dir
}
const regrasEm = dir => spawnSync(process.execPath, [REGRAS_MJS, '--raiz', dir], { encoding: 'utf8', env })

test('um caminho inexistente em Código: ou Código da área: falha o check', () => {
  for (const [area, cenario] of [['Código da área: hooks/turn.ts, hooks/sumiu.ts', ''], ['Código da área: hooks/turn.ts', 'Código: draw/sumiu.ts']]) {
    const dir = mapa(area, cenario)
    try {
      const r = regrasEm(dir)
      assert.equal(r.status, 1)
      assert.match(r.stderr, /caminho inexistente em task-tree\/: (hooks|draw)\/sumiu\.ts/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('cenário coberto sem código, ou arquivo do mod fora do mapa, só avisa', () => {
  const dir = mapa('', '')
  try {
    const r = regrasEm(dir)
    assert.equal(r.status, 0)
    assert.match(r.stdout, /aviso: turnos\.md: turnos\.um está "coberto" sem código no mapa/)
    assert.match(r.stdout, /aviso: fora do mapa: task-tree\/hooks\/turn\.ts/)
    assert.doesNotMatch(r.stdout, /fora do mapa: task-tree\/hooks\/render\.tsx/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('o impacto lista os cenários de um arquivo tocado, com os testes que os cobrem', () => {
  const dir = mapa('Código da área: hooks/turn.ts', 'Código: draw/layout.ts')
  try {
    const r = impacto(dir, ['draw/layout.ts'])
    assert.deepEqual(r.cenarios.map(c => c.id), ['turnos.um'])
    assert.deepEqual(r.cenarios[0].testes, ['task-tree/tests/turnos.test.ts: 1 teste'])
    // O código da área vale para todos os cenários do arquivo (o checklist também).
    assert.deepEqual(impacto(dir, ['hooks/turn.ts']).cenarios.map(c => c.id), ['turnos.um', 'turnos.dois'])
    assert.deepEqual(impacto(dir, ['hooks/turn.ts']).checklist, ['turnos.dois'])
    assert.deepEqual(impacto(dir, ['draw/outro.ts']).fora, ['draw/outro.ts'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('o núcleo tocado afeta todos os cenários cobertos e o checklist inteiro', () => {
  const dir = mapa('Código da área: hooks/turn.ts', '')
  try {
    const r = impacto(dir, ['hooks/render.tsx'])
    assert.deepEqual(r.nucleo, ['hooks/render.tsx'])
    assert.deepEqual(r.cenarios.map(c => c.id), ['turnos.um'])
    assert.deepEqual(r.checklist, ['turnos.dois'])
    assert.deepEqual(r.fora, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

