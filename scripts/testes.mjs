// Comando único de validação do task-tree: validate, tsc e plugin test, nessa ordem.
// Uso: npm run check (ou node scripts/testes.mjs). CLAUDE_BIN escolhe o binário do Claude Code.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acharBinario } from './binario.mjs'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

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
  // Os testes de HEAD contra o código novo; só com diferença em task-tree/.
  ['regressao', process.execPath, ['scripts/regressao.mjs'], true],
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
