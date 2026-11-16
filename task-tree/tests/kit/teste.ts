import { test as testDoKit } from 'claude-code/testing'
import type { TestBody, TestOptions, TestRest } from 'claude-code/testing'

// O `test` que todo arquivo de teste importa. Decisão do usuário, 2026-11-15 ("Autorizo"): sai o
// limite de 5 s por teste do kit do Claude Code; fica um teto de 60 s, só para o teste travado. Um
// teste que pede mais que o teto é respeitado; o que pede menos sobe para o teto.
export const TETO_MS = 60_000

export function test(nome: string, ...resto: TestRest): void {
  if (resto.length === 1) {
    const corpo: TestBody = resto[0]
    testDoKit(nome, { timeoutMs: TETO_MS }, corpo)
    return
  }
  const opcoes: TestOptions = resto[0]
  const corpo: TestBody = resto[1]
  testDoKit(nome, { ...opcoes, timeoutMs: Math.max(TETO_MS, opcoes.timeoutMs ?? 0) }, corpo)
}
