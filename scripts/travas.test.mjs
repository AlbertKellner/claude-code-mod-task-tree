// Testes das próprias travas do selo (scripts/selos.mjs), num repositório git temporário com um
// catálogo mínimo, dois testes e um arquivo de kit. Uso: node --test scripts/travas.test.mjs.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const SELOS = join(dirname(fileURLToPath(import.meta.url)), 'selos.mjs')
const hoje = new Date().toLocaleDateString('sv-SE')

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

// Um repositório novo, com tudo selado como "novo" e commitado.
function montar() {
  const dir = mkdtempSync(join(tmpdir(), 'travas-'))
  mkdirSync(join(dir, 'regras'))
  mkdirSync(join(dir, 'task-tree', 'tests', 'kit'), { recursive: true })
  writeFileSync(join(dir, 'regras', 'exemplo.md'), CATALOGO)
  writeFileSync(join(dir, ARQ), TESTES)
  writeFileSync(join(dir, 'task-tree', 'tests', 'kit', 'leitura.ts'), KIT)
  const git = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' })
  git('init', '-q')
  assert.equal(selos(dir, '--novos', '--motivo', 'linha de base').status, 0)
  git('add', '-A')
  git('commit', '-q', '-m', 'base')
  return dir
}
const selos = (dir, ...a) => spawnSync(process.execPath, [SELOS, '--raiz', dir, ...a], { encoding: 'utf8' })
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
