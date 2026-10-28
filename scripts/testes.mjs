// Comando único de validação do task-tree: validate, tsc e plugin test, nessa ordem.
// Uso: npm run check (ou node scripts/testes.mjs). CLAUDE_BIN escolhe o binário do Claude Code.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

// Ordena versões "2.1.308" numericamente.
const comparar = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

function acharBinario() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN
  const base = process.env.APPDATA && join(process.env.APPDATA, 'Claude', 'claude-code')
  if (base && existsSync(base)) {
    const versoes = readdirSync(base).filter(v => /^\d+(\.\d+)*$/.test(v)).sort(comparar).reverse()
    for (const v of versoes) {
      const pasta = join(base, v)
      for (const sub of readdirSync(pasta)) {
        const exe = join(pasta, sub, 'claude.exe')
        if (statSync(join(pasta, sub)).isDirectory() && existsSync(exe)) return exe
      }
    }
  }
  return 'claude'
}

const claude = acharBinario()
const rodar = (cmd, args) => spawnSync(cmd, args, { cwd: raiz, stdio: 'inherit', shell: cmd === 'claude' || cmd === 'npx' })

const versao = spawnSync(claude, ['--version'], { cwd: raiz, encoding: 'utf8', shell: claude === 'claude' })
if (versao.status !== 0) {
  console.error(`Binário do Claude Code não encontrado (${claude}). Defina CLAUDE_BIN.`)
  process.exit(1)
}
console.log(`Claude Code: ${claude} (${versao.stdout.trim()})`)

// O validate gera .claude-plugin/types/ do mod (ignorado pelo git), de que o tsc depende;
// por isso vem antes do tsc.
// O tsc ainda não bloqueia: o código tem erros de tipo antigos (strict + noUncheckedIndexedAccess
// do tsconfig gerado). Passa a bloquear quando eles forem corrigidos.
const etapas = [
  // O catálogo regras/ contra os testes (ids, estados, ligações); node puro, em milissegundos.
  ['regras', process.execPath, ['scripts/regras.mjs'], true],
  // As travas do selo (scripts/selos.mjs), testadas num repositório temporário.
  ['travas', process.execPath, ['--test', 'scripts/travas.test.mjs'], true],
  // Os testes e o kit contra regras/selos.json: teste existente só muda com selo novo.
  ['selos', process.execPath, ['scripts/selos.mjs'], true],
  ['validate do marketplace', claude, ['plugin', 'validate', '.', '--strict'], true],
  ['validate do mod', claude, ['plugin', 'validate', 'task-tree', '--strict'], true],
  ['tsc', 'npx', ['tsc', '--noEmit', '-p', 'task-tree'], false],
  ['plugin test', claude, ['plugin', 'test', 'task-tree'], true],
]

const resumo = []
let codigo = 0
for (const [nome, cmd, args, bloqueia] of etapas) {
  console.log(`\n== ${nome}`)
  const r = rodar(cmd, args)
  const status = r.status ?? 1
  const marca = status === 0 ? 'ok   ' : bloqueia ? 'FALHA' : 'AVISO'
  resumo.push(`${marca} ${nome}${status === 0 ? '' : ` (exit ${status}${bloqueia ? '' : ', não bloqueia'})`}`)
  if (status !== 0 && bloqueia) {
    codigo = status
    break
  }
}
for (const [nome] of etapas.slice(resumo.length)) resumo.push(`--    ${nome} (não rodou)`)

console.log(`\n${resumo.join('\n')}`)
process.exit(codigo)
