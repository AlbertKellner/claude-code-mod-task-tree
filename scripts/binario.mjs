// O binário do Claude Code: CLAUDE_BIN, senão o claude.exe da versão mais nova do app desktop que
// responde ao --version (a pasta nova de uma atualização em curso não bloqueia), senão `claude` no PATH.
// A versão fixada (scripts/versao-do-claude-code.txt) é a da CI; o check avisa quando roda em outra.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ARQUIVO_DA_VERSAO = join(dirname(fileURLToPath(import.meta.url)), 'versao-do-claude-code.txt')

// Ordena versões "2.1.308" numericamente.
const comparar = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

// Os executáveis das pastas de versão do app, da mais nova para a mais antiga.
export function candidatos(env = process.env) {
  const base = env.APPDATA && join(env.APPDATA, 'Claude', 'claude-code')
  if (!base || !existsSync(base)) return []
  const lista = []
  const versoes = readdirSync(base).filter(v => /^\d+(\.\d+)*$/.test(v)).sort(comparar).reverse()
  for (const v of versoes) {
    const pasta = join(base, v)
    for (const sub of readdirSync(pasta)) {
      const exe = join(pasta, sub, 'claude.exe')
      if (statSync(join(pasta, sub)).isDirectory() && existsSync(exe)) {
        lista.push(exe)
        break
      }
    }
  }
  return lista
}

export const responde = exe => {
  try {
    return spawnSync(exe, ['--version'], { encoding: 'utf8', timeout: 30000 }).status === 0
  } catch {
    return false
  }
}

export function acharBinario(env = process.env, pergunta = responde) {
  if (env.CLAUDE_BIN) return env.CLAUDE_BIN
  const lista = candidatos(env)
  return lista.find(exe => pergunta(exe)) ?? lista[0] ?? 'claude'
}

export const versaoDoTexto = texto => /(\d+\.\d+\.\d+)/.exec(String(texto ?? ''))?.[1] ?? null

export function lerVersaoFixada(arquivo = ARQUIVO_DA_VERSAO) {
  try {
    return versaoDoTexto(readFileSync(arquivo, 'utf8'))
  } catch {
    return null
  }
}

export const avisoDeVersao = (achada, fixada) =>
  !achada || !fixada || achada === fixada
    ? null
    : `AVISO: o check roda no Claude Code ${achada}, a versão fixada é ${fixada} (scripts/versao-do-claude-code.txt): suba o arquivo junto com o app`
