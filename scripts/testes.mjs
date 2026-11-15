// Comando único de validação do task-tree: catálogo, travas, selos, validate, tsc e plugin test em
// paralelo (a primeira que falha encerra as outras), e depois a regressão. Uso: npm run check (ou node scripts/testes.mjs). CLAUDE_BIN escolhe o
// binário do Claude Code.
// --indice (o hook de pré-commit): o check roda sobre o que vai no commit, o índice copiado para uma
// pasta temporária com git checkout-index, não sobre a pasta de trabalho (onde outra sessão pode
// estar editando).
// As etapas regras e selos terminam com a linha de resumo delas; a que sai com 0 sem essa linha não
// conferiu nada e conta como falha (scripts/guarda.mjs).
// Numa worktree sem node_modules ou sem os tipos gerados, o hook usa os do clone principal; sem
// node_modules em nenhum dos dois, para pedindo o npm install.
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, rmdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acharBinario, avisoDeVersao, lerVersaoFixada, versaoDoTexto } from './binario.mjs'
import { dividir, encerrarTodas, linhasDoResumo, montarEtapas, rodarGrupo } from './etapas.mjs'
import { alteradosNoIndice, clonePrincipal, etapasDoHook, lerBase } from './mudou.mjs'
import { gravarResultados } from './selos.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const indice = process.argv.includes('--indice')
// --base <ref> (a CI): selos e regressão comparam com a base do PR em vez de HEAD; roda tudo. Sem
// valor, ou com uma ref que não é commit, para logo.
const lido = lerBase(process.argv.slice(2))
if (lido.erro) {
  console.error(lido.erro)
  process.exit(1)
}
const base = lido.base
if (base && spawnSync('git', ['-C', repo, 'rev-parse', '--verify', '--quiet', `${base}^{commit}`]).status !== 0) {
  console.error(`a base ${base} não existe`)
  process.exit(1)
}
const comBase = base ? ['--base', base] : []

// O node_modules e os tipos gerados (ignorados pelo git): os do repositório; sem eles (uma worktree
// nova), os do clone principal.
const principal = clonePrincipal(repo)
const achar = rel => [repo, principal].map(p => join(p, rel)).find(p => existsSync(p))
const TIPOS = join('task-tree', '.claude-plugin', 'types')
const modulos = achar('node_modules')
if (!modulos) {
  console.error('falta node_modules: rode npm install no clone (ou nesta worktree)')
  process.exit(1)
}
if (!indice && !existsSync(join(repo, 'node_modules'))) {
  // Os scripts importam o TypeScript a partir da própria pasta; uma ligação criada aqui seria uma
  // mudança na pasta de trabalho.
  console.error('falta node_modules nesta worktree: rode npm install nela; o commit pelo hook funciona sem isso')
  process.exit(1)
}

// O que se verifica: o repositório, ou a cópia do índice (com o node_modules achado ligado).
let raiz = repo
if (indice) {
  raiz = mkdtempSync(join(tmpdir(), 'task-tree-indice-'))
  const r = spawnSync('git', ['checkout-index', '-a', `--prefix=${raiz.replace(/\\/g, '/')}/`], { cwd: repo, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error('não foi possível copiar o índice')
    process.exit(1)
  }
  symlinkSync(modulos, join(raiz, 'node_modules'), 'junction')
  // Os tipos do kit (ignorados pelo git; gravados pelo motor do Claude Code quando carrega o mod de uma
  // pasta, e regravados a cada atualização do app; o validate não os gera): o tsc lê deles.
  const tipos = achar(TIPOS)
  if (tipos) cpSync(tipos, join(raiz, TIPOS), { recursive: true })
  console.log(`Verificando o índice (o que vai no commit), copiado em ${raiz}`)
}

// A pasta temporária do check: os resultados da passada principal, que a regressão lê para não
// repetir os arquivos de teste iguais aos da base. Sai no fim do check, como a cópia do índice.
const tmp = mkdtempSync(join(tmpdir(), 'task-tree-check-'))

// No hook, as etapas cujos arquivos não mudaram no índice ficam de fora (scripts/mudou.mjs); o check
// manual roda tudo. Sem como saber o que mudou, roda tudo.
const alterados = indice ? alteradosNoIndice(repo) : null
const hook = alterados === null ? { travas: true, validate: true, tsc: true } : etapasDoHook(alterados)

const claude = acharBinario()
const opcoes = cmd => ({ cwd: raiz, shell: cmd === 'claude' })
const rodar = (cmd, args) => spawnSync(cmd, args, { ...opcoes(cmd), stdio: 'inherit' })

// Ctrl+C ou fim pedido: as etapas em curso (fora do Windows, em grupos de processos próprios, que não
// recebem o Ctrl+C do terminal) são encerradas, e a cópia do índice sai.
for (const sinal of ['SIGINT', 'SIGTERM'])
  process.on(sinal, () => {
    encerrarTodas()
    limpar()
    process.exit(130)
  })

const versao = spawnSync(claude, ['--version'], { cwd: raiz, encoding: 'utf8', shell: claude === 'claude' })
if (versao.status !== 0) {
  console.error(`Binário do Claude Code não encontrado (${claude}). Defina CLAUDE_BIN.`)
  limpar()
  process.exit(1)
}
console.log(`Claude Code: ${claude} (${versao.stdout.trim()})`)
// A versão fixada (a da CI) contra a que o check usa: só avisa, e o aviso volta no resumo final.
const avisoVersao = avisoDeVersao(versaoDoTexto(versao.stdout), lerVersaoFixada())
if (avisoVersao) console.log(avisoVersao)

// O tsc depende de .claude-plugin/types/ do mod (ignorado pelo git), que o validate não gera: quem
// grava a pasta é o motor do Claude Code quando carrega o mod de uma pasta (e a regrava a cada
// atualização do app); num clone novo, sem ela, o tsc falha.
// O tsc bloqueia: strict + noUncheckedIndexedAccess do tsconfig gerado, e noUnusedLocals do
// task-tree/tsconfig.json (decisão do usuário, 2026-10-28).
// As etapas e a ordem do resumo: scripts/etapas.mjs. As leves rodam em paralelo com o plugin test, e a
// primeira que falha encerra as que ainda rodam; a regressão só depois de todas passarem.
const etapas = montarEtapas({ claude, modulos, repo, raiz, indice, comBase, tmp, hook })
const { antes, grupo, depois } = dividir(etapas)
const estados = new Map()
let codigo = 0
const falhou = est => est.estado === 'falhou' || est.estado === 'naoConferiu'
const mostrar = (etapa, est) => {
  console.log(`\n== ${etapa.nome}`)
  process.stdout.write(est.saida ?? '')
  if (est.estado === 'naoConferiu') console.error('a etapa não conferiu nada: o script saiu sem a linha de resumo')
}
const registrar = async lista => {
  const rs = await rodarGrupo(lista, { opcoes, aoTerminar: mostrar })
  for (const [nome, est] of rs) {
    estados.set(nome, est)
    if (est.naoFechou) console.error(`a etapa ${nome} não fechou depois de encerrada`)
    if (falhou(est) && codigo === 0) codigo = est.codigo || 1
  }
}

if (etapas.find(e => e.nome === 'tsc').roda && !existsSync(join(raiz, TIPOS))) {
  // Sem os tipos, nada é lançado.
  console.log('\n== tsc')
  console.error(`faltam os tipos gerados do mod (${TIPOS}): o motor do Claude Code grava a pasta quando carrega o mod do clone`)
  estados.set('tsc', { estado: 'falhou', codigo: 1 })
  codigo = 1
}
for (const e of antes) if (codigo === 0) await registrar([e])
if (codigo === 0 && grupo.length) {
  console.log(`\n== ${grupo.map(e => e.nome).join(' + ')} (em paralelo)`)
  await registrar(grupo)
}
const passadaPrincipal = estados.get('plugin test')
if (passadaPrincipal?.saida !== undefined) gravarResultados(tmp, passadaPrincipal.saida)
for (const e of depois) {
  if (codigo !== 0) break
  console.log(`\n== ${e.nome}`)
  const status = rodar(e.cmd, e.args).status ?? 1
  estados.set(e.nome, status === 0 ? { estado: 'passou', codigo: 0 } : { estado: e.bloqueia ? 'falhou' : 'aviso', codigo: status })
  if (status !== 0 && e.bloqueia) codigo = status
}
const resumo = linhasDoResumo(etapas, estados)
if (avisoVersao) resumo.push(avisoVersao)
console.log(`\n${resumo.join('\n')}`)
limpar()
process.exit(codigo)

// A cópia do índice sai; a ligação ao node_modules é desfeita antes, sem tocar no que ela aponta.
function limpar() {
  try {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
  } catch {}
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
    rmSync(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
  } catch {}
  if (existsSync(raiz)) console.error(`a cópia do índice ficou em ${raiz} (um processo ainda segura a pasta)`)
}
