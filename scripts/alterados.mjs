// Os testes existentes que mudaram, para o relato: contra HEAD (padrão) ou contra a base do PR
// (--pr: merge-base com origin/main, ou main). Mostra as regras, o selo novo e o corpo antes e depois.
// Relato, não trava: sai sempre com 0 (quem trava são as etapas selos e regressao do check).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extrair } from './selos.mjs'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const git = (...a) => spawnSync('git', ['-C', raiz, ...a], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })

let base = 'HEAD'
// --base <ref>: contra esse commit (a CI, a base do PR).
const iBase = process.argv.indexOf('--base')
if (iBase >= 0 && process.argv[iBase + 1]) base = process.argv[iBase + 1]
else if (process.argv.includes('--pr')) {
  const alvo = git('rev-parse', '--verify', '--quiet', 'origin/main').status === 0 ? 'origin/main' : 'main'
  base = git('merge-base', 'HEAD', alvo).stdout.toString().trim()
}

// Os testes e o catálogo da base, numa pasta temporária.
const tmp = mkdtempSync(join(tmpdir(), 'task-tree-alterados-'))
try {
  const lista = git('ls-tree', '-r', '--name-only', base, 'task-tree/tests', 'regras').stdout.toString().split('\n').filter(Boolean)
  for (const p of lista) {
    const destino = join(tmp, ...p.split('/'))
    mkdirSync(dirname(destino), { recursive: true })
    writeFileSync(destino, git('show', `${base}:${p}`).stdout)
  }
  const antes = extrair(tmp).testes
  const depois = extrair(raiz).testes
  const selos = existsSync(join(raiz, 'regras', 'selos.json')) ? JSON.parse(readFileSync(join(raiz, 'regras', 'selos.json'), 'utf8')).testes : {}

  const mudados = Object.keys(antes).filter(k => depois[k] && depois[k].hash !== antes[k].hash)
  const removidos = Object.keys(antes).filter(k => !depois[k])
  const novos = Object.keys(depois).filter(k => !antes[k])
  console.log(`Testes existentes alterados desde ${base === 'HEAD' ? 'HEAD' : `a base do PR (${base.slice(0, 7)})`}: ${mudados.length ? mudados.length : 'nenhum'}`)
  for (const k of mudados) {
    const s = selos[k]
    console.log(`\n## ${k}`)
    console.log(`regras: ${depois[k].regras.join(', ')}; selo: ${s ? `${s.tipo}, ${s.data}, ${s.motivo}` : 'SEM SELO'}; asserções ${antes[k].assercoes} → ${depois[k].assercoes}`)
    for (const l of diff(antes[k].corpo.split('\n'), depois[k].corpo.split('\n'))) console.log(l)
  }
  if (removidos.length) console.log(`\nRemovidos: ${removidos.join(' | ')}`)
  if (novos.length) console.log(`\nNovos: ${novos.join(' | ')}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

// Diferença de linhas pela maior subsequência comum: "-" sai, "+" entra, " " fica.
function diff(a, b) {
  const n = a.length
  const m = b.length
  const t = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])
  const out = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) out.push(`  ${a[i++]}`), j++
    else if (t[i + 1][j] >= t[i][j + 1]) out.push(`- ${a[i++]}`)
    else out.push(`+ ${b[j++]}`)
  }
  while (i < n) out.push(`- ${a[i++]}`)
  while (j < m) out.push(`+ ${b[j++]}`)
  return out
}
