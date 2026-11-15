// Testes das próprias travas do selo (scripts/selos.mjs), num repositório git temporário com um
// catálogo mínimo, dois testes e um arquivo de kit. Uso: node --test scripts/travas.test.mjs.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { alteradosNoIndice, baseDoRelato, clonePrincipal, etapasDoHook, lerBase } from './mudou.mjs'
import { etapaConferiu } from './guarda.mjs'
import { aprovarGolden, lerResultados, liberaGolden, liberaRemovido, liberaTeste, naoRodaram, selosDeHead, testesDe } from './selos.mjs'
import { impacto } from './impacto.mjs'
import { versaoNova } from './versao.mjs'
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

test('o hook vê um arquivo movido pelos dois caminhos', comMontagem(dir => {
  const git = (...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8', env })
  mkdirSync(join(dir, 'docs'))
  assert.equal(git('mv', ARQ, 'docs/exemplo.test.ts').status, 0)
  assert.deepEqual([...alteradosNoIndice(dir, env)].sort(), ['docs/exemplo.test.ts', ARQ].sort())
}))

test('o hook vê um arquivo com acento no nome como ele é', comMontagem(dir => {
  const git = (...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8', env })
  writeFileSync(join(dir, 'task-tree', 'tests', 'ação.test.ts'), 'export const x = 1\n')
  git('add', 'task-tree/tests/ação.test.ts')
  const alterados = alteradosNoIndice(dir, env)
  assert.deepEqual(alterados, ['task-tree/tests/ação.test.ts'])
  assert.equal(etapasDoHook(alterados).tsc, true)
}))

test('subir o TypeScript roda o tsc e as travas', () => {
  for (const p of ['package.json', 'package-lock.json'])
    assert.deepEqual(etapasDoHook([p]), { travas: true, validate: false, tsc: true }, p)
})

// O script chamado por um caminho com link (junção no Windows, link simbólico no resto) ainda roda a
// linha de comando e imprime a linha de resumo.
for (const [nome, script] of [['regras', 'regras.mjs'], ['selos', 'selos.mjs']])
  test(`a etapa ${nome} roda atrás de um link para a pasta dos scripts`, comMontagem(dir => {
    const fora = mkdtempSync(join(tmpdir(), 'travas-link-'))
    try {
      const link = join(fora, 'scripts')
      symlinkSync(dirname(SELOS), link, 'junction')
      const r = spawnSync(process.execPath, [join(link, script), '--raiz', dir], { encoding: 'utf8', env })
      assert.equal(r.status, 0, r.stderr)
      assert.match(r.stdout, new RegExp(`^${nome}: `, 'm'))
    } finally {
      rmSync(fora, { recursive: true, force: true })
    }
  }))

test('a etapa sem linha de resumo não conferiu', () => {
  assert.equal(etapaConferiu('regras', ''), false)
  assert.equal(etapaConferiu('regras', 'mapa: 1 cobertos\nregras: 3 cobertas, 0 pendentes\n'), true)
  assert.equal(etapaConferiu('selos', 'regras: 3 cobertas\n'), false)
  assert.equal(etapaConferiu('selos', 'selos: 2 testes, 1 arquivos do kit\n'), true)
  assert.equal(etapaConferiu('tsc', ''), true)
})

test('o clone principal de uma worktree', comMontagem(dir => {
  const git = (...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8', env })
  const fora = mkdtempSync(join(tmpdir(), 'travas-wt-'))
  const wt = join(fora, 'wt')
  try {
    assert.equal(git('worktree', 'add', '-q', '--detach', wt).status, 0)
    assert.equal(realpathSync.native(clonePrincipal(wt, env)), realpathSync.native(dir))
    assert.equal(realpathSync.native(clonePrincipal(dir, env)), realpathSync.native(dir))
  } finally {
    git('worktree', 'remove', '--force', wt)
    rmSync(fora, { recursive: true, force: true })
  }
}))

test('a base do relato é HEAD com mudança fora de commit e o commit anterior sem ela', comMontagem(dir => {
  const git = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8', env })
  // Só o commit "base", sem anterior: HEAD.
  assert.equal(baseDoRelato(dir, env), 'HEAD')
  writeFileSync(join(dir, ARQ), readFileSync(join(dir, ARQ), 'utf8') + '// um\n')
  git('commit', '-q', '-am', 'mudou')
  const anterior = git('rev-parse', 'HEAD~1').stdout.trim()
  // Logo depois do commit local: o commit anterior.
  assert.equal(baseDoRelato(dir, env), anterior)
  // Mudança fora de commit (rastreado, depois não rastreado): HEAD.
  writeFileSync(join(dir, ARQ), readFileSync(join(dir, ARQ), 'utf8') + '// dois\n')
  assert.equal(baseDoRelato(dir, env), 'HEAD')
  git('checkout', '--', ARQ)
  writeFileSync(join(dir, 'novo.txt'), 'x\n')
  assert.equal(baseDoRelato(dir, env), 'HEAD')
}))

// O golden do desenho: só se grava com as palavras do usuário, e um desenho mudado sem aprovação falha.
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
  writeFileSync(join(dir, 'task-tree', 'tests', 'golden', 'desenho.ts'), 'export const GOLDEN: Record<string, unknown> = {"principal":{"arvore":{"t":"Box"},"svgs":["<svg/>"]}}\n')
  let r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /desenho do golden sem selo: principal/)
  aprovarGolden(dir, { principal: { arvore: { t: 'Box' }, svgs: ['<svg/>'] } }, `"está certo", ${hoje}`)
  assert.equal(conferir(dir).status, 0)
  trocar(dir, 'task-tree/tests/golden/desenho.ts', '<svg/>', '<svg></svg>')
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
  const md = ['# Turnos', '', area, '', '### turnos.um', 'Um.', '', 'Origem: teste das travas, 2026-10-29.', cenario, 'Estado: coberto', '', '### turnos.dois', 'Dois.', '', 'Origem: teste das travas, 2026-10-29.', 'Estado: checklist (só no app)', '']
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


const KIT_ARQ = 'task-tree/tests/kit/leitura.ts'
const lerSelosJson = dir => JSON.parse(readFileSync(join(dir, 'regras', 'selos.json'), 'utf8'))

test('um helper do kit que afirma conta como asserção', comMontagem(dir => {
  writeFileSync(join(dir, KIT_ARQ), "import { expect } from 'claude-code/testing'\nexport function esperarX(v: number) {\n  expect(v).toBe(v)\n}\nexport const x = 1\n")
  assert.equal(selos(dir, '--kit', KIT_ARQ, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  trocar(dir, ARQ, 'expect(2).toBe(2)', 'esperarX(2)')
  const r = selos(dir, '--selar', UM, '--tipo', 'refatoracao', '--motivo', 'x')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(lerSelosJson(dir).testes[UM].assercoes, 2)
  assert.equal(conferir(dir).status, 0)
}))

test('tirar a única chamada a um helper do arquivo que afirma é perda de asserção', comMontagem(dir => {
  trocar(dir, ARQ, 'const B = 2', 'const B = 2\nfunction duas() {\n  expect(1).toBe(1)\n  expect(2).toBe(2)\n}')
  trocar(dir, ARQ, '  expect(3).toBe(3)\n', '  expect(3).toBe(3)\n  duas()\n')
  assert.equal(selos(dir, '--selar', DOIS, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  assert.equal(lerSelosJson(dir).testes[DOIS].assercoes, 3)
  trocar(dir, ARQ, '  duas()\n', '')
  const r = selos(dir, '--selar', DOIS, '--tipo', 'refatoracao', '--motivo', 'x')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /refatoração não pode tirar asserções/)
}))

test('--recontar só mexe em assercoes, e recusa com teste mudado sem selo', comMontagem(dir => {
  writeFileSync(join(dir, KIT_ARQ), 'export function esperarX(v: number) {\n  return v\n}\nexport const x = 1\n')
  assert.equal(selos(dir, '--kit', KIT_ARQ, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  trocar(dir, ARQ, '  expect(2).toBe(2)\n', '  expect(2).toBe(2)\n  esperarX(5)\n')
  assert.equal(selos(dir, '--selar', UM, '--tipo', 'refatoracao', '--motivo', 'motivo um').status, 0)
  writeFileSync(join(dir, KIT_ARQ), "import { expect } from 'claude-code/testing'\nexport function esperarX(v: number) {\n  expect(v).toBe(5)\n}\nexport const x = 1\n")
  assert.equal(selos(dir, '--kit', KIT_ARQ, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  const antes = lerSelosJson(dir).testes[UM]
  assert.equal(antes.assercoes, 2)
  const r = selos(dir, '--recontar')
  assert.equal(r.status, 0, r.stderr)
  const depois = lerSelosJson(dir).testes[UM]
  assert.deepEqual(depois, { ...antes, assercoes: 3 })
  trocar(dir, ARQ, 'expect(3).toBe(3)', 'expect(3).toBe(4)')
  const recusa = selos(dir, '--recontar')
  assert.equal(recusa.status, 1)
  assert.match(recusa.stderr, /::dois/)
  assert.deepEqual(lerSelosJson(dir).testes[UM], depois)
}))

// Os selos conferidos contra os de HEAD: apagar, trocar tipo, hash ou asserções à mão não passa.
const gravarSelosJson = (dir, s) => writeFileSync(join(dir, 'regras', 'selos.json'), `${JSON.stringify(s, null, 2)}\n`)
const TESTE_DOIS = "\n// Regra: exemplo.b\ntest('dois', async ($: any) => {\n  expect(3).toBe(3)\n})\n"
const reescrever = (dir, regra, data) => {
  const de = regra === 'exemplo.a' ? 'Origem: teste das travas.\nEstado: coberto\n\n### exemplo.b' : 'A regra B.\n\n- Dado algo\n- Quando algo\n- Então algo\n\nOrigem: teste das travas.\nEstado: coberto'
  trocar(dir, 'regras/exemplo.md', de, de.replace('Origem: teste das travas.\n', `Origem: teste das travas.\nReescrito: ${data}, o usuário decidiu.\n`))
}
const ontem = (() => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('sv-SE')
})()

test('apagar um teste e o selo dele à mão falha', comMontagem(dir => {
  trocar(dir, ARQ, TESTE_DOIS, '')
  const s = lerSelosJson(dir)
  delete s.testes[DOIS]
  gravarSelosJson(dir, s)
  const r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /selo apagado sem registro: .*::dois/)
}))

test('remover com decisão deixa registro, e a regressão libera', comMontagem(dir => {
  trocar(dir, ARQ, TESTE_DOIS, '')
  reescrever(dir, 'exemplo.b', hoje)
  const r = selos(dir, '--remover', DOIS, '--tipo', 'decisao', '--motivo', 'o usuário tirou')
  assert.equal(r.status, 0, r.stderr)
  const c = conferir(dir)
  assert.equal(c.status, 0, c.stderr)
  const agora = lerSelosJson(dir)
  assert.equal(agora.removidos[DOIS].tipo, 'decisao')
  assert.equal(agora.removidos[DOIS].reescrito, hoje)
  const base = selosDeHead(dir)
  assert.equal(liberaRemovido(agora, base, DOIS, hoje), true)
  assert.equal(liberaRemovido(agora, base, DOIS, ontem), false)
  assert.equal(liberaRemovido(agora, base, UM, hoje), false)
  assert.equal(liberaRemovido(agora, agora, DOIS, undefined), false)
  assert.equal(liberaRemovido(agora, base, DOIS, undefined), true)
}))

test('trocar à mão o hash e o tipo não passa', comMontagem(dir => {
  trocar(dir, ARQ, 'expect(2).toBe(2)', 'expect(2).toBe(3)')
  assert.equal(selos(dir, '--selar', UM, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  const s = lerSelosJson(dir)
  s.testes[UM].tipo = 'novo'
  gravarSelosJson(dir, s)
  let r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /tipo `novo` em teste que já existia: .*::um/)
  s.testes[UM].tipo = 'decisao'
  gravarSelosJson(dir, s)
  r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /decisão sem `Reescrito:`: .*::um/)
  reescrever(dir, 'exemplo.a', hoje)
  r = conferir(dir)
  assert.equal(r.status, 0, r.stderr)
}))

test('o número de asserções escrito à mão não vale', comMontagem(dir => {
  const s = lerSelosJson(dir)
  s.testes[UM].assercoes = 9
  gravarSelosJson(dir, s)
  const r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /asserções do selo diferentes das contadas: .*::um \(selo 9, contadas 2\)/)
}))

test('apagar um cenário do golden junto com o selo falha', comMontagem(dir => {
  const git = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8', env })
  mkdirSync(join(dir, 'task-tree', 'tests', 'golden'), { recursive: true })
  aprovarGolden(dir, { principal: { arvore: { t: 'Box' }, svgs: [] }, filha: { arvore: { t: 'Text' }, svgs: [] } }, `"está certo", ${hoje}`)
  git('add', '-A')
  git('commit', '-q', '-m', 'golden')
  assert.equal(conferir(dir).status, 0)
  trocar(dir, 'task-tree/tests/golden/desenho.ts', ',"principal":{"arvore":{"t":"Box"},"svgs":[]}', '')
  const s = lerSelosJson(dir)
  delete s.golden.principal
  gravarSelosJson(dir, s)
  const r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /cenário do golden sumido: principal/)
}))

test('renomear um teste leva o selo', comMontagem(dir => {
  const UNO = `${ARQ}::uno`
  trocar(dir, ARQ, "test('um'", "test('uno'")
  const r = selos(dir, '--renomear', UM, '--para', UNO, '--tipo', 'refatoracao', '--motivo', 'nome melhor')
  assert.equal(r.status, 0, r.stderr)
  const c = conferir(dir)
  assert.equal(c.status, 0, c.stderr)
  const agora = lerSelosJson(dir)
  assert.equal(agora.removidos[UM].para, UNO)
  assert.ok(agora.testes[UNO])
  assert.equal(liberaRemovido(agora, selosDeHead(dir), UM, hoje), false)
}))

test('renomear com o corpo mudado não é refatoração', comMontagem(dir => {
  const UNO = `${ARQ}::uno`
  trocar(dir, ARQ, "test('um'", "test('uno'")
  trocar(dir, ARQ, 'expect(2).toBe(2)', 'expect(2).toBe(3)')
  const r = selos(dir, '--renomear', UM, '--para', UNO, '--tipo', 'refatoracao', '--motivo', 'x')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /renome puro/)
}))

// O selo cobre o que o teste alcança por tabela, os arquivos de apoio (fixtures) e a migração do hash.
const gitEm = dir => (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8', env })
// Os selos da montagem regravados como os do algoritmo 1 (sem o campo, hash antigo) e postos em commit.
const paraAlgoritmo1 = dir => {
  const s = lerSelosJson(dir)
  delete s.algoritmo
  const antigos = new Map(testesDe(ARQ, readFileSync(join(dir, ARQ), 'utf8'), ['expect'], 1).map(t => [t.nome, t.hash]))
  for (const [chave, selo] of Object.entries(s.testes)) selo.hash = antigos.get(chave.slice(chave.indexOf('::') + 2))
  gravarSelosJson(dir, s)
  gitEm(dir)('commit', '-q', '-am', 'algoritmo 1')
  return s
}

test('mudar uma constante usada só por outra declaração do teste falha', comMontagem(dir => {
  trocar(dir, ARQ, 'const B = 2', 'const B = 2\nconst C = 3\nfunction usaC() {\n  return C\n}')
  trocar(dir, ARQ, '  expect(2).toBe(2)\n', '  expect(2).toBe(2)\n  usaC()\n')
  assert.equal(selos(dir, '--selar', UM, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  assert.equal(conferir(dir).status, 0)
  trocar(dir, ARQ, 'const C = 3', 'const C = 30')
  const r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /o teste mudou sem selo novo: .*::um/)
}))

test('mudar uma fixture sem selar falha', comMontagem(dir => {
  const FIX = 'task-tree/tests/fixtures/x.ts'
  mkdirSync(join(dir, 'task-tree', 'tests', 'fixtures'))
  writeFileSync(join(dir, FIX), 'export const FORMATOS = [1, 2]\n')
  let r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /arquivo de apoio dos testes sem selo: task-tree\/tests\/fixtures\/x\.ts/)
  assert.equal(selos(dir, '--kit', FIX, '--tipo', 'novo', '--motivo', 'x').status, 0)
  assert.equal(conferir(dir).status, 0)
  writeFileSync(join(dir, FIX), 'export const FORMATOS = [1]\n')
  r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /o arquivo de apoio dos testes mudou sem selo novo: task-tree\/tests\/fixtures\/x\.ts/)
  assert.equal(selos(dir, '--kit', FIX, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  assert.equal(conferir(dir).status, 0)
}))

test('--migrar regrava o hash e mantém tipo, data e motivo', comMontagem(dir => {
  trocar(dir, ARQ, 'const B = 2', 'const B = 2\nconst C = 3\nfunction usaC() {\n  return C\n}')
  trocar(dir, ARQ, '  expect(2).toBe(2)\n', '  expect(2).toBe(2)\n  usaC()\n')
  assert.equal(selos(dir, '--selar', UM, '--tipo', 'refatoracao', '--motivo', 'motivo um').status, 0)
  gitEm(dir)('commit', '-q', '-am', 'um com usaC')
  const antes = paraAlgoritmo1(dir)
  mkdirSync(join(dir, 'task-tree', 'tests', 'fixtures'))
  writeFileSync(join(dir, 'task-tree/tests/fixtures/x.ts'), 'export const X = 1\n')
  let r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /selos do algoritmo 1/)
  assert.match(selos(dir, '--selar', UM, '--tipo', 'refatoracao', '--motivo', 'x').stderr, /rode --migrar antes/)
  // Um teste mudado antes da migração: recusa tudo, e o selos.json fica como estava.
  trocar(dir, ARQ, 'expect(3).toBe(3)', 'expect(3).toBe(4)')
  r = selos(dir, '--migrar')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /selar antes de migrar\): .*::dois/)
  assert.deepEqual(lerSelosJson(dir), antes)
  trocar(dir, ARQ, 'expect(3).toBe(4)', 'expect(3).toBe(3)')
  r = selos(dir, '--migrar')
  assert.equal(r.status, 0, r.stderr)
  const depois = lerSelosJson(dir)
  assert.equal(depois.algoritmo, 2)
  const novos = new Map(testesDe(ARQ, readFileSync(join(dir, ARQ), 'utf8')).map(t => [t.nome, t.hash]))
  assert.notEqual(depois.testes[UM].hash, antes.testes[UM].hash)
  for (const [chave, s] of Object.entries(depois.testes)) {
    const { hash, ...resto } = s
    const { hash: _velho, ...restoAntes } = antes.testes[chave]
    assert.deepEqual(resto, restoAntes)
    assert.equal(hash, novos.get(chave.slice(chave.indexOf('::') + 2)))
  }
  assert.equal(depois.testes[UM].tipo, 'refatoracao')
  assert.equal(depois.testes[UM].motivo, 'motivo um')
  assert.equal(depois.kit['task-tree/tests/fixtures/x.ts'].tipo, 'novo')
  assert.deepEqual(depois.kit[KIT_ARQ], antes.kit[KIT_ARQ])
  assert.equal(conferir(dir).status, 0)
}))

test('com o algoritmo da base diferente, a conferência não acusa os hashes migrados e segue comparando com a base', comMontagem(dir => {
  trocar(dir, ARQ, 'const B = 2', 'const B = 2\nconst C = 3\nfunction usaC() {\n  return C\n}')
  trocar(dir, ARQ, '  expect(2).toBe(2)\n', '  expect(2).toBe(2)\n  usaC()\n')
  assert.equal(selos(dir, '--selar', UM, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  gitEm(dir)('commit', '-q', '-am', 'um com usaC')
  paraAlgoritmo1(dir)
  assert.equal(selos(dir, '--migrar').status, 0)
  let r = conferir(dir)
  assert.equal(r.status, 0, r.stderr)
  // A base (algoritmo 1) é recalculada pelo algoritmo 2: o teste mudado e selado como "novo" é acusado.
  trocar(dir, ARQ, 'const C = 3', 'const C = 30')
  assert.equal(selos(dir, '--selar', UM, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  const s = lerSelosJson(dir)
  s.testes[UM].tipo = 'novo'
  gravarSelosJson(dir, s)
  r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /tipo `novo` em teste que já existia: .*::um/)
  // Com a base do mesmo algoritmo (a migração em commit), acusa igual.
  gitEm(dir)('commit', '-q', '-am', 'migrado')
  trocar(dir, ARQ, 'const C = 30', 'const C = 300')
  assert.equal(selos(dir, '--selar', UM, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  const s2 = lerSelosJson(dir)
  s2.testes[UM].tipo = 'novo'
  gravarSelosJson(dir, s2)
  r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /tipo `novo` em teste que já existia: .*::um/)
}))

// A tabela de durabilidade (state/durability.ts) contra as chaves do state do mod (types/index.d.ts).
function durabilidade(chaves, linhas) {
  const dir = mapa('Código da área: hooks/turn.ts', '')
  mkdirSync(join(dir, 'task-tree', 'types'), { recursive: true })
  mkdirSync(join(dir, 'task-tree', 'state'), { recursive: true })
  const tipos = ["declare module 'claude-code' {", '  interface PluginState {', `    'task-tree': { ${chaves.join('; ')} }`, '  }', '}', '']
  writeFileSync(join(dir, 'task-tree', 'types', 'index.d.ts'), tipos.join('\n'))
  const tabela = linhas.map(([k, l]) => `  { key: '${k}', lives: '${l}', merge: 'none', restoredAt: [], note: '' },`)
  writeFileSync(join(dir, 'task-tree', 'state', 'durability.ts'), ['export const TABLE = [', ...tabela, ']', ''].join('\n'))
  return dir
}

test('uma chave do state sem linha na tabela de durabilidade falha o check', () => {
  const casos = [
    // Completa: passa.
    [['groups: Group[]', 'sent: { from: string; at: number }[]'], [['groups', 'state+store'], ['sent', 'state'], ['loaded', 'module']], 0, null],
    // A tabela perdeu a linha de uma chave do state.
    [['groups: Group[]', 'sent: { from: string; at: number }[]'], [['groups', 'state+store']], 1, /chave do state sem linha na tabela de durabilidade: sent/],
    // Os tipos perderam a chave que a tabela diz estar no state.
    [['groups: Group[]'], [['groups', 'state+store'], ['sent', 'state']], 1, /linha da tabela de durabilidade sem chave no state: sent/],
  ]
  for (const [chaves, linhas, status, erro] of casos) {
    const dir = durabilidade(chaves, linhas)
    try {
      const r = regrasEm(dir)
      assert.equal(r.status, status, r.stderr)
      if (erro) assert.match(r.stderr, erro)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

// Release (.github/workflows/release.yml): a conta da versão nova.
test('BREAKING CHANGE no meio do texto não sobe a major', () => {
  assert.equal(versaoNova('fix: x', 'sem BREAKING CHANGE neste PR', '0.15.2').level, 'patch')
  assert.equal(versaoNova('feat: x', 'A regra: `BREAKING CHANGE:` no rodapé sobe a major.', '0.15.2').level, 'minor')
})

test('uma linha BREAKING CHANGE: no rodapé sobe a major, com LF e com CRLF', () => {
  assert.deepEqual(versaoNova('fix: x', 'texto\n\nBREAKING CHANGE: muda tudo', '0.15.2'), { level: 'major', nova: '1.0.0' })
  assert.equal(versaoNova('fix: x', 'texto\r\n\r\nBREAKING CHANGE: muda tudo\r\n', '0.15.2').level, 'major')
  assert.equal(versaoNova('fix: x', 'texto\n  BREAKING-CHANGE: muda tudo', '0.15.2').level, 'major')
})

test('o ! depois do tipo sobe a major, feat sobe a minor e o resto é patch', () => {
  assert.equal(versaoNova('feat(task-tree)!: x', '', '0.15.2').nova, '1.0.0')
  assert.equal(versaoNova('feat(task-tree): x', '', '0.15.2').nova, '0.16.0')
  assert.equal(versaoNova('fix(task-tree): x', '', '0.15.2').nova, '0.15.3')
})

test('título fora do formato Conventional Commits vira patch com aviso', () => {
  for (const titulo of ['Feat: x', 'feature: x', 'feat add x']) {
    const r = versaoNova(titulo, '', '0.15.2')
    assert.equal(r.level, 'patch', titulo)
    assert.equal(r.nova, '0.15.3', titulo)
    assert.match(r.aviso ?? '', /fora do formato Conventional Commits/, titulo)
  }
})

test('título no formato não traz aviso', () => {
  for (const titulo of ['fix(task-tree): x', 'feat: x', 'chore(release): x', 'feat(task-tree)!: x'])
    assert.equal(versaoNova(titulo, '', '0.15.2').aviso, undefined, titulo)
})

// A regressão diz quando não comparou: teste da base que não rodou, base vazia ou inexistente.
test('a regressão acusa o teste da base que não apareceu na saída', () => {
  const chaves = [UM, DOIS]
  assert.deepEqual(naoRodaram(chaves, [{ chave: UM, ok: true }]), [DOIS])
  assert.deepEqual(naoRodaram(chaves, [{ chave: UM, ok: true }, { chave: DOIS, ok: false }]), [])
})

test('a saída do plugin test é lida por arquivo e por linha', () => {
  const saida = ['bun test', 'tests\\x.test.ts:', '(pass) um [3ms]', 'linha solta', '(fail) dois', '', ' 1 pass'].join('\r\n')
  assert.deepEqual(lerResultados(saida), [
    { chave: 'task-tree/tests/x.test.ts::um', ok: true },
    { chave: 'task-tree/tests/x.test.ts::dois', ok: false },
  ])
})

test('uma base que não existe é erro; o repositório sem commit segue valendo', comMontagem(dir => {
  const r = selos(dir, '--repo', dir, '--base', 'naoexiste')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /não existe/)
  const vazio = mkdtempSync(join(tmpdir(), 'travas-vazio-'))
  try {
    spawnSync('git', ['-C', vazio, 'init', '-q'], { encoding: 'utf8', env })
    assert.deepEqual(selosDeHead(vazio).testes, {})
  } finally {
    rmSync(vazio, { recursive: true, force: true })
  }
}))

test('--base sem valor é erro', () => {
  for (const args of [['--base'], ['--base', ''], ['--base', '--indice']]) assert.ok(lerBase(args).erro, JSON.stringify(args))
  assert.deepEqual(lerBase(['--base', 'abc']), { base: 'abc' })
  assert.deepEqual(lerBase(['--indice']), { base: undefined })
})

// Travas do selo do kit, dos testes fora do topo e dos commits citados nas origens.
const KIT_AFIRMA = "import { expect } from 'claude-code/testing'\nexport function esperarX(v: number) {\n  expect(v).toBe(v)\n}\nexport const x = 1\n"
test('selar o kit que já existia como novo é recusado, e o selo novo à mão não passa', comMontagem(dir => {
  writeFileSync(join(dir, KIT_ARQ), 'export const x = 2\n')
  const r = selos(dir, '--kit', KIT_ARQ, '--tipo', 'novo', '--motivo', 'x')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /"novo" só para arquivo que não existia em HEAD/)
  assert.equal(selos(dir, '--kit', KIT_ARQ, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  const s = lerSelosJson(dir)
  s.kit[KIT_ARQ].tipo = 'novo'
  gravarSelosJson(dir, s)
  const c = conferir(dir)
  assert.equal(c.status, 1)
  assert.match(c.stderr, /tipo `novo` em arquivo do kit que já existia: task-tree\/tests\/kit\/leitura\.ts/)
}))

test('selo do kit sem motivo é recusado', comMontagem(dir => {
  writeFileSync(join(dir, KIT_ARQ), 'export const x = 2\n')
  const r = selos(dir, '--kit', KIT_ARQ, '--tipo', 'refatoracao')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /exige --motivo/)
  assert.equal(selos(dir, '--kit', KIT_ARQ, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  const s = lerSelosJson(dir)
  s.kit[KIT_ARQ].motivo = ''
  gravarSelosJson(dir, s)
  assert.match(conferir(dir).stderr, /selo do kit sem motivo/)
}))

// O teste um passa a chamar um helper do kit que afirma, e isso vai à base.
const comHelperNaBase = dir => {
  writeFileSync(join(dir, KIT_ARQ), KIT_AFIRMA)
  assert.equal(selos(dir, '--kit', KIT_ARQ, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  trocar(dir, ARQ, 'expect(2).toBe(2)', 'esperarX(2)')
  assert.equal(selos(dir, '--selar', UM, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  gitEm(dir)('commit', '-q', '-am', 'helper')
  writeFileSync(join(dir, KIT_ARQ), KIT_AFIRMA.replace('  expect(v).toBe(v)\n', '  void v\n'))
}

test('um helper do kit que deixa de afirmar não passa com --recontar', comMontagem(dir => {
  comHelperNaBase(dir)
  assert.equal(selos(dir, '--kit', KIT_ARQ, '--tipo', 'refatoracao', '--motivo', 'x').status, 0)
  assert.equal(selos(dir, '--recontar').status, 0)
  const r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /menos asserções sem o teste mudar: .*::um \(2 → 1\)/)
}))

test('um helper do kit que deixa de afirmar, com o kit selado como decisão, passa', comMontagem(dir => {
  comHelperNaBase(dir)
  assert.equal(selos(dir, '--kit', KIT_ARQ, '--tipo', 'decisao', '--motivo', 'o usuário decidiu').status, 0)
  assert.equal(selos(dir, '--recontar').status, 0)
  const r = conferir(dir)
  assert.equal(r.status, 0, r.stderr)
}))

test('um test( aninhado ou com nome em template falha a etapa selos', comMontagem(dir => {
  for (const extra of ["\n{\n  // Regra: exemplo.a\n  test('tres', async () => {})\n}\n", "\nconst n = 'x'\n// Regra: exemplo.a\ntest(`t ${n}`, async () => {})\n"]) {
    const original = readFileSync(join(dir, ARQ), 'utf8')
    writeFileSync(join(dir, ARQ), original + extra)
    const r = conferir(dir)
    assert.equal(r.status, 1, extra)
    assert.match(r.stderr, /3 `test\(` no arquivo, 2 testes de topo com nome literal/)
    writeFileSync(join(dir, ARQ), original)
  }
}))

test('dois testes com o mesmo nome no arquivo falham', comMontagem(dir => {
  writeFileSync(join(dir, ARQ), readFileSync(join(dir, ARQ), 'utf8') + "\n// Regra: exemplo.a\ntest('um', async () => {})\n")
  const r = conferir(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /nome de teste repetido em task-tree\/tests\/exemplo\.test\.ts: um/)
}))

test('hash de origem que não existe só avisa', comMontagem(dir => {
  trocar(dir, 'regras/exemplo.md', 'Origem: teste das travas.\nEstado: coberto\n\n### exemplo.b', 'Origem: teste das travas, commit 0123abc.\nEstado: coberto\n\n### exemplo.b')
  let r = regrasEm(dir)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /aviso: exemplo\.md: exemplo\.a: commit citado não existe: 0123abc/)
  const h = gitEm(dir)('rev-parse', '--short=7', 'HEAD').stdout.trim()
  trocar(dir, 'regras/exemplo.md', '0123abc', h)
  r = regrasEm(dir)
  assert.equal(r.status, 0, r.stderr)
  assert.doesNotMatch(r.stdout, /commit citado não existe/)
}))

// O catálogo conferido: a origem, o prefixo do id, o lugar do mapa de código e o "pendente".
const comMapa = (area, cenario, corpo) => {
  const dir = mapa(area, cenario)
  try {
    corpo(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('cenário sem Origem falha o check', () => comMapa('Código da área: hooks/turn.ts', '', dir => {
  trocar(dir, 'regras/turnos.md', 'Dois.\n\nOrigem: teste das travas, 2026-10-29.\n', 'Dois.\n\n')
  const r = regrasEm(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /turnos\.md: turnos\.dois sem "Origem:"/)
}))

test('id com prefixo de outra área falha', () => comMapa('Código da área: hooks/turn.ts', '', dir => {
  trocar(dir, 'regras/turnos.md', '### turnos.dois', '### pedidos.dois')
  const r = regrasEm(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /turnos\.md: pedidos\.dois: o id não começa por "turnos\."/)
}))

test('Código da área: depois do primeiro cenário falha', () => comMapa('', '', dir => {
  trocar(dir, 'regras/turnos.md', '### turnos.dois', 'Código da área: hooks/turn.ts\n\n### turnos.dois')
  const r = regrasEm(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /turnos\.md: "Código da área:" fora do topo/)
}))

test('pendente sem arquivo de teste falha; com o arquivo, passa', () => comMapa('Código da área: hooks/turn.ts', '', dir => {
  trocar(dir, 'regras/turnos.md', 'Estado: checklist (só no app)', 'Estado: pendente')
  let r = regrasEm(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /turnos\.dois está "pendente" sem o arquivo de teste entre parênteses/)
  trocar(dir, 'regras/turnos.md', 'Estado: pendente', 'Estado: pendente (sumiu.test.ts)')
  r = regrasEm(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /arquivo de teste que não existe: sumiu\.test\.ts/)
  trocar(dir, 'regras/turnos.md', 'pendente (sumiu.test.ts)', 'pendente (turnos.test.ts)')
  r = regrasEm(dir)
  assert.equal(r.status, 0, r.stderr)
}))

test('origem sem data e decisão sem aspas só avisam', () => comMapa('Código da área: hooks/turn.ts', '', dir => {
  trocar(dir, 'regras/turnos.md', 'Um.\n\nOrigem: teste das travas, 2026-10-29.', 'Um.\n\nOrigem: regra do painel.')
  trocar(dir, 'regras/turnos.md', 'Dois.\n\nOrigem: teste das travas, 2026-10-29.', 'Dois.\n\nOrigem: decisão do usuário, 2026-10-29.')
  const r = regrasEm(dir)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /aviso: origens sem data \(1\): turnos\.um/)
  assert.match(r.stdout, /aviso: decisões sem as palavras \(1\): turnos\.dois/)
  assert.match(r.stdout, /mapa: 1 cobertos com código, 1 avisos/)
}))
