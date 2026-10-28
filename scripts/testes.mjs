// Comando único de validação do task-tree: catálogo, travas, selos, validate, tsc, plugin test e
// regressão, nessa ordem. Uso: npm run check (ou node scripts/testes.mjs). CLAUDE_BIN escolhe o
// binário do Claude Code.
// --indice (o hook de pré-commit): o check roda sobre o que vai no commit, o índice copiado para uma
// pasta temporária com git checkout-index, não sobre a pasta de trabalho (onde outra sessão pode
// estar editando).
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acharBinario } from './binario.mjs'
import { alteradosNoIndice, etapasDoHook } from './mudou.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const indice = process.argv.includes('--indice')

// O que se verifica: o repositório, ou a cópia do índice (com o node_modules do repositório ligado).
let raiz = repo
if (indice) {
  raiz = mkdtempSync(join(tmpdir(), 'task-tree-indice-'))
  const r = spawnSync('git', ['checkout-index', '-a', `--prefix=${raiz.replace(/\\/g, '/')}/`], { cwd: repo, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error('não foi possível copiar o índice')
    process.exit(1)
  }
  if (existsSync(join(repo, 'node_modules'))) symlinkSync(join(repo, 'node_modules'), join(raiz, 'node_modules'), 'junction')
  console.log(`Verificando o índice (o que vai no commit), copiado em ${raiz}`)
}

// No hook, as etapas cujos arquivos não mudaram no índice ficam de fora (scripts/mudou.mjs); o check
// manual roda tudo. Sem como saber o que mudou, roda tudo.
const alterados = indice ? alteradosNoIndice(repo) : null
const hook = alterados === null ? { travas: true, validate: true, tsc: true } : etapasDoHook(alterados)

const claude = acharBinario()
const opcoes = cmd => ({ cwd: raiz, shell: cmd === 'claude' || cmd === 'npx' })
const rodar = (cmd, args) => spawnSync(cmd, args, { ...opcoes(cmd), stdio: 'inherit' })
// Em paralelo (o plugin test e a regressão no hook): cada saída é mostrada inteira ao terminar.
const rodarJunto = (cmd, args) =>
  new Promise(fim => {
    const p = spawn(cmd, args, { ...opcoes(cmd), stdio: ['ignore', 'pipe', 'pipe'] })
    let saida = ''
    p.stdout.on('data', d => (saida += d))
    p.stderr.on('data', d => (saida += d))
    p.on('close', status => fim({ status, saida }))
    p.on('error', e => fim({ status: 1, saida: String(e) }))
  })

const versao = spawnSync(claude, ['--version'], { cwd: raiz, encoding: 'utf8', shell: claude === 'claude' })
if (versao.status !== 0) {
  console.error(`Binário do Claude Code não encontrado (${claude}). Defina CLAUDE_BIN.`)
  limpar()
  process.exit(1)
}
console.log(`Claude Code: ${claude} (${versao.stdout.trim()})`)

// O validate gera .claude-plugin/types/ do mod (ignorado pelo git), de que o tsc depende;
// por isso vem antes do tsc.
// O tsc ainda não bloqueia: o código tem erros de tipo antigos (strict + noUncheckedIndexedAccess
// do tsconfig gerado). Passa a bloquear quando eles forem corrigidos.
// [nome, comando, argumentos, bloqueia, roda (no hook: os arquivos dela mudaram), junto (no hook: em
// paralelo com as seguintes marcadas junto)]
const etapas = [
  // O catálogo regras/ contra os testes (ids, estados, ligações); node puro, em milissegundos.
  ['regras', process.execPath, ['scripts/regras.mjs'], true, true],
  // As travas do selo (scripts/selos.mjs), testadas num repositório temporário.
  ['travas', process.execPath, ['--test', 'scripts/travas.test.mjs'], true, hook.travas],
  // Os testes e o kit contra regras/selos.json: teste existente só muda com selo novo.
  ['selos', process.execPath, ['scripts/selos.mjs', '--repo', repo], true, true],
  ['validate do marketplace', claude, ['plugin', 'validate', '.', '--strict'], true, hook.validate],
  ['validate do mod', claude, ['plugin', 'validate', 'task-tree', '--strict'], true, hook.validate],
  ['tsc', 'npx', ['tsc', '--noEmit', '-p', 'task-tree'], false, hook.tsc],
  // Em série: em paralelo com a regressão, na máquina carregada, testes estouravam os 5 s do kit
  // (1 falha em 5 execuções do hook), e um hook que falha à toa empurra para o --no-verify.
  ['plugin test', claude, ['plugin', 'test', 'task-tree'], true, true],
  // Os testes de HEAD contra o código novo; só com diferença em task-tree/ (ela mesma decide).
  ['regressao', process.execPath, ['scripts/regressao.mjs', '--repo', repo, ...(indice ? ['--indice', '--raiz', raiz] : [])], true, true],
]

const resumo = []
let codigo = 0
const marcar = (nome, status, bloqueia) => {
  const marca = status === 0 ? 'ok   ' : bloqueia ? 'FALHA' : 'AVISO'
  resumo.push(`${marca} ${nome}${status === 0 ? '' : ` (exit ${status}${bloqueia ? '' : ', não bloqueia'})`}`)
  if (status !== 0 && bloqueia && codigo === 0) codigo = status
}
for (let i = 0; i < etapas.length && codigo === 0; i++) {
  const [nome, cmd, args, bloqueia, roda, junto] = etapas[i]
  if (!roda) {
    resumo.push(`--    ${nome} (pulada no hook: os arquivos dela não mudaram)`)
    continue
  }
  if (junto) {
    const grupo = etapas.slice(i).filter(e => e[5])
    console.log(`\n== ${grupo.map(e => e[0]).join(' + ')} (em paralelo)`)
    const rs = await Promise.all(grupo.map(([, c, a]) => rodarJunto(c, a)))
    grupo.forEach(([n, , , b], k) => {
      console.log(`\n== ${n}\n${rs[k].saida}`)
      marcar(n, rs[k].status ?? 1, b)
    })
    i += grupo.length - 1
    continue
  }
  console.log(`\n== ${nome}`)
  marcar(nome, rodar(cmd, args).status ?? 1, bloqueia)
}
for (const [nome] of etapas.slice(resumo.length)) resumo.push(`--    ${nome} (não rodou)`)

console.log(`\n${resumo.join('\n')}`)
limpar()
process.exit(codigo)

// A cópia do índice sai; a ligação ao node_modules é desfeita antes, sem tocar no que ela aponta.
function limpar() {
  if (!indice) return
  const link = join(raiz, 'node_modules')
  try {
    unlinkSync(link)
  } catch {
    try {
      rmdirSync(link)
    } catch {}
  }
  if (existsSync(link)) return console.error(`a cópia do índice ficou em ${raiz} (não foi possível desfazer a ligação ao node_modules)`)
  try {
    rmSync(raiz, { recursive: true, force: true })
  } catch {}
}
