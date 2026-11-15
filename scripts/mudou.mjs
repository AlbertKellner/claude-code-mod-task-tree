// O que o hook de pré-commit pode pular: as etapas cujos arquivos não mudaram no que vai no commit
// (o índice contra HEAD). O `npm run check` manual roda tudo. Nunca pula `regras`, `selos`, `plugin
// test` nem `regressao` (esta decide sozinha, pela mudança em task-tree/), e não guarda resultado de
// teste. Decisão do usuário, 2026-10-28: "Sim, pular (Recomendado)". Dentro da regressão, o arquivo de
// teste igual ao da base não é repetido (arquivosDaRegressao, abaixo).
// O que mudou é lido sem detecção de renome e sem aspas (um arquivo movido conta pelos dois caminhos;
// um nome com acento, como é), e o package.json e o package-lock.json (o TypeScript que o tsc e a
// etapa selos usam) contam para as travas e o tsc.
import { spawnSync } from 'node:child_process'
import { basename, dirname, resolve } from 'node:path'

const PACOTE = new Set(['package.json', 'package-lock.json'])

// As travas testam os scripts (e a etapa selos lê com o TypeScript): sem mudança em scripts/ nem no
// pacote, o resultado é o mesmo.
export const mudaTravas = p => p.startsWith('scripts/') || PACOTE.has(p)
// O validate lê os manifestos e o código do mod: sem mudança no mod (fora dos testes) nem no
// marketplace, o resultado é o mesmo.
export const mudaValidate = p => (p.startsWith('task-tree/') && !p.startsWith('task-tree/tests/')) || p.startsWith('.claude-plugin/')

// O tsc lê o código do mod e os testes (task-tree/, com o tsconfig dele), com o TypeScript do pacote.
export const mudaTsc = p => p.startsWith('task-tree/') || PACOTE.has(p)

// As etapas que o hook roda, pelos caminhos alterados.
export function etapasDoHook(alterados) {
  return { travas: alterados.some(mudaTravas), validate: alterados.some(mudaValidate), tsc: alterados.some(mudaTsc) }
}

// Os caminhos que o índice muda em relação a HEAD (o que vai no commit). Sem HEAD (repositório novo),
// null: o hook roda tudo.
export function alteradosNoIndice(repo, env = process.env) {
  const r = spawnSync('git', ['-C', repo, 'diff', '--cached', '--name-only', '--no-renames', '-z', 'HEAD'], { encoding: 'utf8', env })
  if (r.status !== 0) return null
  return r.stdout.split('\0').filter(Boolean)
}

// A pasta do clone principal (a pasta comum do git; a de cima, quando ela é um .git): numa worktree, o
// clone de onde ela saiu; num clone comum, ele mesmo; sem resposta do git, o próprio repo.
export function clonePrincipal(repo, env = process.env) {
  const r = spawnSync('git', ['-C', repo, 'rev-parse', '--git-common-dir'], { encoding: 'utf8', env })
  if (r.status !== 0 || !r.stdout.trim()) return repo
  const comum = resolve(repo, r.stdout.trim())
  return basename(comum) === '.git' ? dirname(comum) : comum
}

// A base do relato (`testes:alterados`, `impacto`): HEAD quando o índice ou a pasta de trabalho diferem
// de HEAD (rastreados, e não rastreados fora do .gitignore); sem essa diferença (logo depois do commit
// local), o commit anterior, para o relato mostrar o último commit; sem commit anterior, HEAD.
export function baseDoRelato(repo, env = process.env) {
  const git = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8', env })
  const mudou = git('status', '--porcelain', '--untracked-files=all').stdout.trim() !== ''
  if (mudou) return 'HEAD'
  const anterior = git('rev-parse', '--verify', '--quiet', 'HEAD~1')
  return anterior.status === 0 ? anterior.stdout.trim() : 'HEAD'
}

// O --base dos argumentos: ausente, { base: undefined }; com valor, { base }; presente sem valor (fim
// dos argumentos, texto vazio ou outra --opção no lugar), { erro }.
export function lerBase(args) {
  const i = args.indexOf('--base')
  if (i < 0) return { base: undefined }
  const v = args[i + 1]
  if (v === undefined || v.trim() === '' || v.startsWith('--')) return { erro: '--base sem valor: diga a ref (ex.: o merge-base com o main)' }
  return { base: v }
}

// A regressão só do que mudou (decisão do usuário, 2026-11-15: "Autorizo"): dos arquivos de teste da
// base, repete os que mudaram contra ela (modificado, removido ou renomeado: o caminho antigo roda da
// base); o igual vale pela passada principal do mesmo check, que roda os mesmos arquivos contra o mesmo
// código. Com qualquer mudança em task-tree/tests fora dos arquivos de teste (kit, apoios, golden), sem
// a passada principal ou sem resposta do git, repete todos, e o motivo diz por quê.
export const ehArquivoDeTeste = p => p.startsWith('task-tree/tests/') && /\.test\.tsx?$/.test(p)
export function arquivosDaRegressao(daBase, alterados, comPrincipal = true) {
  const todos = { repete: [...daBase], iguais: [] }
  if (!comPrincipal) return { ...todos, motivo: 'sem a passada principal' }
  if (alterados === null) return { ...todos, motivo: 'o git não respondeu' }
  const apoio = alterados.find(p => p.startsWith('task-tree/tests/') && !ehArquivoDeTeste(p))
  if (apoio) return { ...todos, motivo: `o kit, um apoio ou o golden mudou: ${apoio}` }
  const mudou = new Set(alterados)
  return { repete: daBase.filter(p => mudou.has(p)), iguais: daBase.filter(p => !mudou.has(p)) }
}

// Os caminhos de task-tree/tests que mudaram contra ref, pelo git (o blob, não o disco), sem renome: no
// hook, o índice; senão, a pasta de trabalho, mais os não rastreados. Sem resposta do git, null.
export function alteradosEmTestes(repo, ref, indice, env = process.env) {
  const git = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8', env })
  const diff = git('diff', ...(indice ? ['--cached'] : []), '--name-only', '--no-renames', '-z', ref, '--', 'task-tree/tests')
  if (diff.status !== 0) return null
  const lista = diff.stdout.split('\0').filter(Boolean)
  if (indice) return lista
  const novos = git('ls-files', '--others', '--exclude-standard', '-z', '--', 'task-tree/tests')
  if (novos.status !== 0) return null
  return [...lista, ...novos.stdout.split('\0').filter(Boolean)]
}
