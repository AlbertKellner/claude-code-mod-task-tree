// Conta da versão nova do release (.github/workflows/release.yml), a partir do PR mesclado.
// Uso: node scripts/versao.mjs <versão atual>, com TITLE e BODY no ambiente; escreve no stdout as
// linhas level=… e new=….
import { fileURLToPath } from 'node:url'

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
  return { level, nova }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const r = versaoNova(process.env.TITLE ?? '', process.env.BODY ?? '', process.argv[2] ?? '')
    process.stdout.write(`level=${r.level}\nnew=${r.nova}\n`)
  } catch (e) {
    process.stderr.write(`${e.message}\n`)
    process.exit(1)
  }
}
