// Conta da versão nova do release (.github/workflows/release.yml), a partir do PR mesclado.
// Uso: node scripts/versao.mjs <versão atual>, com TITLE e BODY no ambiente; escreve no stdout as
// linhas level=… e new=….
// Retomada: node scripts/versao.mjs --retomada, com COMMIT_TITLE (o título do commit de versão deste
// PR na main, ou vazio) e EXISTS (true quando a release dessa versão existe); escreve acao=… e versao=….
// O commit de versão leva no corpo a linha "PR: #<número>": reexecutar o job de um PR acha o commit
// dele e só cria a release que faltou (ou nada), sem subir a versão de novo.
import { ehPrincipal } from './guarda.mjs'

// Só conta a linha que começa com "BREAKING CHANGE:" (ou "BREAKING-CHANGE:"), o rodapé do
// Conventional Commits; citar a expressão no meio do texto não sobe a major.
function quebraNoRodape(corpo) {
  return /^[ \t]*BREAKING[ -]CHANGE:/m.test(corpo.replace(/\r/g, ''))
}

export function versaoNova(titulo, corpo, atual) {
  if (!/^\d+\.\d+\.\d+$/.test(atual)) throw new Error(`versão fora do formato X.Y.Z: '${atual}'`)
  let level
  if (/^[a-z]+(\([^)]*\))?!:/.test(titulo) || quebraNoRodape(corpo)) level = 'major'
  else if (/^feat(\([^)]*\))?:/.test(titulo)) level = 'minor'
  else level = 'patch'
  const [major, minor, patch] = atual.split('.').map(Number)
  const nova = level === 'major' ? `${major + 1}.0.0` : level === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`
  if (FORMATO.test(titulo)) return { level, nova }
  // Fora do formato a versão sobe como patch mesmo assim (nada falha), com aviso no resumo.
  const aviso = `Título do PR fora do formato Conventional Commits: «${titulo}». A versão subiu como patch (${atual} → ${nova}). Se a mudança era uma funcionalidade (minor) ou quebra (major), ajuste a versão com um PR de correção de título \`feat…\` ou \`…!:\`.`
  return { level, nova, aviso }
}

// tipo(escopo opcional) + "!" opcional + ": " + texto, com o tipo entre os do Conventional Commits.
const FORMATO = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]*\))?!?: \S/

// A versão de um título de commit de versão ("chore(release): task-tree vX.Y.Z"); senão, null.
export function versaoDoCommit(titulo) {
  return /^chore\(release\): task-tree v(\d+\.\d+\.\d+)$/.exec(String(titulo ?? '').trim())?.[1] ?? null
}

// O que o release faz ao rodar para um PR: "subir" (sem commit de versão dele na main), "criar" (o
// commit existe, a release não) ou "nada" (os dois existem).
export function retomada(tituloDoCommit, existe) {
  const versao = versaoDoCommit(tituloDoCommit)
  if (!versao) return { acao: 'subir', versao: null }
  return { acao: existe ? 'nada' : 'criar', versao }
}

if (ehPrincipal(import.meta.url) && process.argv[2] === '--retomada') {
  const r = retomada(process.env.COMMIT_TITLE ?? '', process.env.EXISTS === 'true')
  process.stdout.write(`acao=${r.acao}\nversao=${r.versao ?? ''}\n`)
} else if (ehPrincipal(import.meta.url)) {
  try {
    const r = versaoNova(process.env.TITLE ?? '', process.env.BODY ?? '', process.argv[2] ?? '')
    process.stdout.write(`level=${r.level}\nnew=${r.nova}\n${r.aviso ? `aviso=${r.aviso}\n` : ''}`)
  } catch (e) {
    process.stderr.write(`${e.message}\n`)
    process.exit(1)
  }
}
