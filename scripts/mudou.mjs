// O que o hook de pré-commit pode pular: as etapas cujos arquivos não mudaram no que vai no commit
// (o índice contra HEAD). O `npm run check` manual roda tudo. Nunca pula `regras`, `selos`, `plugin
// test` nem `regressao` (esta decide sozinha, pela mudança em task-tree/), e não guarda resultado de
// teste. Decisão do usuário, 2026-10-28: "Sim, pular (Recomendado)".
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
