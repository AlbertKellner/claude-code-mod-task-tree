import { mock } from 'claude-code/testing'

// Ambiente fixo dos cenários: relógio parado e as props do painel.

export const AGORA = 1_000_000

export const PROPS = (colunas = 60) =>
  ({ title: 'Tarefas', isFocused: false, bodyColumns: colunas, placement: 'dock', scroll: { top: 0, bodyRows: 40 }, view: {} }) as any

// Relógio fixo; as esperas (every, after, sleep) ficam presas até um advance.
// Chamar antes da primeira chamada a $.
export function fixar(on: any, opcoes: { agora?: number } = {}) {
  const relogio = mock.clock(on, { now: opcoes.agora ?? AGORA })
  // Barra de status e log do host: o mod só escreve neles.
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  // Abaixo do mod, o prompt e o fim do turno só ecoam (o mod já fez a parte dele).
  on('prompt.submit', (_$: any, e: any) => e)
  on('turn.complete', () => ({ text: '' }))
  return { relogio }
}
