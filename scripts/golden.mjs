// Golden do SVG: o desenho de 3 cenários (tests/golden.test.ts), travado depois que o usuário o
// valida no app. Ver a seção "Golden do SVG" do CLAUDE.md.
//
// Uso:
//   node scripts/golden.mjs --aprovar <cenário…|--todos> --motivo "<palavras do usuário entre aspas>, AAAA-MM-DD"
//       roda os cenários e grava o desenho atual em tests/golden/svg.ts, com o selo em regras/selos.json;
//       só depois de o usuário validar o painel no app e dizer que está certo (as palavras dele no motivo)
//   node scripts/golden.mjs --pagina
//       opcional, sob pedido: golden-recebido/index.html (fora do git), o aprovado e o atual lado a lado
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acharBinario } from './binario.mjs'
import { aprovarGolden, lerGolden, motivoValido } from './selos.mjs'

export const CENARIOS = ['principal', 'filha', 'envios']

// Roda só o golden.test.ts numa cópia do mod e recolhe o desenho de cada cenário (as linhas GOLDEN-NEW).
export function receber(repo) {
  const tmp = mkdtempSync(join(tmpdir(), 'task-tree-golden-'))
  try {
    const mod = join(tmp, 'task-tree')
    cpSync(join(repo, 'task-tree'), mod, { recursive: true })
    for (const f of readdirSync(join(mod, 'tests'))) if (/\.test\.tsx?$/.test(f) && f !== 'golden.test.ts') rmSync(join(mod, 'tests', f))
    const claude = acharBinario()
    const r = spawnSync(claude, ['plugin', 'test', mod], { encoding: 'utf8', shell: claude === 'claude', maxBuffer: 256 * 1024 * 1024 })
    const recebido = {}
    for (const l of `${r.stdout}\n${r.stderr}`.split(/\r?\n/)) {
      const m = /GOLDEN-NEW (\S+) (.+)$/.exec(l)
      if (m) recebido[m[1]] = JSON.parse(m[2])
    }
    return recebido
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

const xml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

if (process.argv[1] && fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/')) {
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
  const args = process.argv.slice(2)
  const valor = nome => {
    const i = args.indexOf(nome)
    return i >= 0 ? args[i + 1] : undefined
  }
  try {
    if (args.includes('--aprovar')) {
      const motivo = valor('--motivo')
      // Recusa antes de rodar qualquer coisa: sem as palavras do usuário, nada se grava.
      if (!motivoValido(motivo)) throw new Error('--motivo precisa das palavras do usuário entre aspas e da data (AAAA-MM-DD) da validação no app')
      const pedidos = args.includes('--todos') ? CENARIOS : args.filter(a => CENARIOS.includes(a))
      if (pedidos.length === 0) throw new Error(`diga os cenários (${CENARIOS.join(', ')}) ou --todos`)
      const recebido = receber(repo)
      const faltam = pedidos.filter(c => !(c in recebido))
      if (faltam.length > 0) throw new Error(`os cenários não geraram desenho: ${faltam.join(', ')}`)
      const gravados = aprovarGolden(repo, Object.fromEntries(pedidos.map(c => [c, recebido[c]])), motivo)
      console.log(`golden aprovado: ${gravados.join(', ')}`)
    } else if (args.includes('--pagina')) {
      const aprovado = lerGolden(repo)
      const recebido = receber(repo)
      const coluna = lista => (lista ?? []).map(s => `<figure><figcaption>${xml(s.alt ?? '')}</figcaption>${s.source}</figure>`).join('')
      const html = `<!doctype html><meta charset="utf-8"><title>Golden do SVG</title><style>body{font-family:system-ui;margin:16px}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0 0 4px}figcaption{font-size:11px;opacity:.6}</style>${CENARIOS.map(c => `<h2>${c}${JSON.stringify(aprovado[c]) === JSON.stringify(recebido[c]) ? ' (igual)' : ' (diferente)'}</h2><section><div><h3>aprovado</h3>${coluna(aprovado[c])}</div><div><h3>atual</h3>${coluna(recebido[c])}</div></section>`).join('')}`
      const pasta = join(repo, 'golden-recebido')
      mkdirSync(pasta, { recursive: true })
      writeFileSync(join(pasta, 'index.html'), html)
      console.log(join(pasta, 'index.html'))
    } else {
      throw new Error('use --aprovar <cenário…|--todos> --motivo "…" ou --pagina')
    }
  } catch (err) {
    console.error(`recusado: ${err.message}`)
    process.exit(1)
  }
}
