// O binário do Claude Code: CLAUDE_BIN, senão o claude.exe mais novo do app desktop, senão `claude` no PATH.
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Ordena versões "2.1.308" numericamente.
const comparar = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

export function acharBinario() {
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
