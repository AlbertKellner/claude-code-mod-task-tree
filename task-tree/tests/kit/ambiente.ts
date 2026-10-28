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

// O host do app desktop: esta sessão, as sessões que ela abriu e o arquivo que cada uma publica.
// `recebeu` simula a outra sessão tomando a mensagem (o `received` do arquivo dela).
// Chamar antes da primeira chamada a $.
export const EU = 'local_00000000-0000-0000-0000-00000000e0e0'
const CASA = 'C:/u'
export type Host = { recebeu(id: string, at: number): void }
export function host(on: any, sessoes: { id: string; nome?: string; rodando?: boolean }[]): Host {
  const recebidas: Record<string, { from: string; at: number }[]> = {}
  const texto = (t: string) => ({ value: { content: [{ type: 'text', text: t }] } })
  on('mcp.call', (_$: any, e: any) => {
    if (e.tool === 'get_session') return texto(JSON.stringify({ sessionId: EU }))
    if (e.tool === 'list_sessions')
      return texto(JSON.stringify(sessoes.map(s => ({ sessionId: s.id, name: s.nome ?? s.id, title: s.nome ?? s.id, isRunning: s.rodando ?? true, startedBy: EU }))))
    return texto('')
  })
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'USERPROFILE' ? CASA : undefined }))
  on('fs.read', (_$: any, e: any) => {
    // O host devolve o caminho com a barra do sistema (\ no Windows).
    const m = /task-tree-waits[\\/](.+)\.json$/.exec(String(e.path))
    if (!m || !sessoes.some(s => s.id === m[1])) return { deny: 'sem arquivo' }
    return { value: JSON.stringify({ version: 1, waiting: false, waits: [], children: [], groups: [], received: recebidas[m[1]!] ?? [] }) }
  })
  on('fs.write', () => ({ value: undefined }))
  return { recebeu: (id, at) => void (recebidas[id] = [...(recebidas[id] ?? []), { from: EU, at }]) }
}

// O host responde o SendMessage: 'fila' (queued) ou 'entregue' (a sessão começou a tratar).
// Chamar antes da primeira chamada a $; `modo` muda entre envios.
export function responderEnvio(on: any): { modo: 'fila' | 'entregue' } {
  const estado: { modo: 'fila' | 'entregue' } = { modo: 'fila' }
  on('tool.call', { tool: 'SendMessage' }, () => ({
    result:
      estado.modo === 'fila'
        ? '{"success":true,"message":"Message queued; it will be delivered when the session is idle"}'
        : '{"success":true,"message":"Message delivered; its turn has started on it"}',
  }))
  return estado
}

// O host responde a ferramenta depois de `ms` no relógio do teste (o diálogo aberto até um advance).
// Chamar antes da primeira chamada a $.
export function responderDepois(on: any, relogio: { sleep(ms: number): Promise<void> }, tool: string, resultado: string, ms = 1000) {
  on('tool.call', { tool }, async () => {
    if (ms > 0) await relogio.sleep(ms)
    return { result: resultado }
  })
}
