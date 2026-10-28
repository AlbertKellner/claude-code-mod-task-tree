// O que o hook de pré-commit pode pular: as etapas cujos arquivos não mudaram no que vai no commit
// (o índice contra HEAD). O `npm run check` manual roda tudo. Nunca pula `regras`, `selos`, `plugin
// test` nem `regressao` (esta decide sozinha, pela mudança em task-tree/), e não guarda resultado de
// teste. Decisão do usuário, 2026-10-28: "Sim, pular (Recomendado)".
import { spawnSync } from 'node:child_process'

// As travas testam os scripts: sem mudança em scripts/, o resultado é o mesmo.
export const mudaTravas = p => p.startsWith('scripts/')
// O validate lê os manifestos e o código do mod: sem mudança no mod (fora dos testes) nem no
// marketplace, o resultado é o mesmo.
export const mudaValidate = p => (p.startsWith('task-tree/') && !p.startsWith('task-tree/tests/')) || p.startsWith('.claude-plugin/')

// O tsc lê o código do mod e os testes (task-tree/, com o tsconfig dele).
export const mudaTsc = p => p.startsWith('task-tree/')

// As etapas que o hook roda, pelos caminhos alterados.
export function etapasDoHook(alterados) {
  return { travas: alterados.some(mudaTravas), validate: alterados.some(mudaValidate), tsc: alterados.some(mudaTsc) }
}

// Os caminhos que o índice muda em relação a HEAD (o que vai no commit). Sem HEAD (repositório novo),
// null: o hook roda tudo.
export function alteradosNoIndice(repo, env = process.env) {
  const r = spawnSync('git', ['-C', repo, 'diff', '--cached', '--name-only', 'HEAD'], { encoding: 'utf8', env })
  if (r.status !== 0) return null
  return r.stdout.split('\n').map(s => s.trim()).filter(Boolean)
}
