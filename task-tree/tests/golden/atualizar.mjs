// Regrava tests/golden/svg.ts com os SVGs que o painel gera hoje: roda `claude plugin test` numa
// cópia da pasta task-tree só com svg-golden.test.ts, recolhe as linhas "GOLDEN-NEW <cenário> <json>"
// que o teste emite para cada cenário fora do golden (ou sem golden) e funde no arquivo, mantendo os
// cenários que já batiam. Uso, da raiz do repositório:
//   node task-tree/tests/golden/atualizar.mjs [caminho do claude.exe]
// O binário é o do PATH se não for dado; use o da mesma versão do app (DESENVOLVIMENTO.md,
// "Validar e testar"). Depois, conferir o diff do git do svg.ts antes de commitar: é a aprovação.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const plugin = resolve(here, '..', '..')
const golden = join(here, 'svg.ts')
const claude = process.argv[2] ?? 'claude'

const work = mkdtempSync(join(tmpdir(), 'task-tree-golden-'))
try {
  cpSync(plugin, join(work, 'task-tree'), {
    recursive: true,
    filter: p => !/[\\/]tests[\\/][^\\/]+\.test\.tsx?$/.test(p) || /svg-golden\.test\.ts$/.test(p),
  })
  const run = spawnSync(claude, ['plugin', 'test', 'task-tree'], { cwd: work, encoding: 'utf8', shell: process.argv[2] === undefined && process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 })
  const out = `${run.stdout ?? ''}\n${run.stderr ?? ''}`
  const fresh = {}
  for (const line of out.split('\n')) {
    const m = /^GOLDEN-NEW (\S+) (.*)$/.exec(line.trim())
    if (m) fresh[m[1]] = JSON.parse(m[2])
  }
  const kept = {}
  const src = readFileSync(golden, 'utf8')
  const body = /export const GOLDEN[^=]*= (\{[\s\S]*\})\s*$/.exec(src)?.[1]
  if (body) Object.assign(kept, JSON.parse(body))
  const names = Object.keys(fresh)
  if (names.length === 0) {
    console.log(run.status === 0 ? 'Nada a atualizar: todos os cenários batem com o golden.' : `O teste falhou sem emitir GOLDEN-NEW; saída:\n${out.slice(-3000)}`)
    process.exit(run.status === 0 ? 0 : 1)
  }
  const all = { ...kept, ...fresh }
  const header = src.slice(0, src.indexOf('export const GOLDEN'))
  // The object is JSON (no trailing commas), one entry per line, so this script can read it back
  // and git shows a changed SVG as one changed line.
  const lines = Object.keys(all)
    .sort()
    .map(k => `  ${JSON.stringify(k)}: [\n${all[k].map(e => `    ${JSON.stringify(e)}`).join(',\n')}\n  ]`)
  writeFileSync(golden, `${header}export const GOLDEN: Record<string, GoldenSvg[]> = {\n${lines.join(',\n')}\n}\n`)
  const unchanged = Object.keys(kept).filter(k => !(k in fresh)).length
  console.log(`svg.ts regravado: ${names.length} cenário(s) novo(s) ou alterado(s) (${names.join(', ')}); ${unchanged} mantido(s). Confira o diff do git.`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
