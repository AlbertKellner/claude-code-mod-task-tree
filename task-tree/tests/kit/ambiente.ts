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
  // O início da sessão (processo novo) e o SessionStart (retomada, /clear): o mod já fez a parte dele.
  on('session.start', () => ({ cwd: '.' }))
  on('command.register', () => ({ value: {} }))
  on('tool.register', () => ({ value: {} }))
  on('classic.SessionStart', () => ({}))
  return { relogio }
}

// Os subagentes que o host lista (agent.list), para as chamadas com agentId. Chamar antes da
// primeira chamada a $.
export function subagente(on: any, ...ids: string[]) {
  on('agent.list', () => ({ value: ids.map(id => ({ id, type: 'general-purpose', description: `subagente ${id}` })) }))
}

// O id desta sessão no store (`<chave>:<id>`), fixo para que um teste ache o que o anterior gravou.
export const SESSAO = 'uuid-eu'

// Um store que passa de um teste ao outro do mesmo arquivo (o objeto é do arquivo): um teste grava,
// o seguinte (módulo novo, state vazio: outro processo) lê. Chamar antes da primeira chamada a $.
export function armazem(on: any, dados: Record<string, unknown>) {
  on('session.id', () => ({ value: SESSAO }))
  on('store.get', (_$: any, e: any) => ({ value: dados[e.key] }))
  on('store.set', (_$: any, e: any) => {
    dados[e.key] = e.value === undefined ? undefined : JSON.parse(JSON.stringify(e.value))
    return { value: undefined }
  })
  on('store.delete', (_$: any, e: any) => {
    delete dados[e.key]
    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(dados) }))
}

// O $.state de um teste anterior. 'captura': cada state.set fica também em `guardado`. 'semear': o
// state.get devolve o de `guardado` enquanto a chave não foi escrita neste teste (módulo novo, state
// mantido: a recarga a quente), e as escritas também ficam nele. O kit segue guardando por baixo (next).
// Chamar antes da primeira chamada a $.
export function estado(on: any, guardado: Record<string, unknown>, modo: 'captura' | 'semear') {
  const escritas = new Set<string>()
  if (modo === 'semear') {
    on('state.get', async (_$: any, e: any, next: any) => {
      const r = await next(e)
      if (r?.value?.value === undefined && !escritas.has(e.key) && guardado[e.key] !== undefined) return { value: { ...r.value, value: guardado[e.key] } }
      return r
    })
  }
  on('state.set', async (_$: any, e: any, next: any) => {
    escritas.add(e.key)
    const r = await next(e)
    guardado[e.key] = e.value === undefined ? undefined : JSON.parse(JSON.stringify(e.value))
    return r
  })
}

// O host do app desktop: esta sessão, as sessões que ela abriu e o arquivo que cada uma publica.
// `recebeu` simula a outra sessão tomando a mensagem (o `received` do arquivo dela).
// Chamar antes da primeira chamada a $.
export const EU = 'local_00000000-0000-0000-0000-00000000e0e0'
const CASA = 'C:/u'
// `proprio()`: o último arquivo que esta sessão publicou (o que a sessão mãe lê e desenha no cartão).
// `pedidosAoApp()`: as ferramentas do app que o mod chamou (mcp.call), na ordem.
export type Host = { recebeu(id: string, at: number): void; filha(id: string): Filha; proprio(): any; pedidosAoApp(): string[] }
// Uma sessão filha como o host a lista e como ela publica o painel. O id tem o formato do app
// ('local_<uuid>') quando o teste a abre com abrirSessao: o painel só reconhece esse formato.
export type Filha = {
  id: string
  nome?: string
  rodando?: boolean // padrão true
  arquivada?: boolean
  aguardando?: boolean
  aborted?: boolean
  painel?: { tasks: any[]; turns?: any[]; agentes?: any[] } // o grupo principal publicado (e os grupos dos subagentes dela)
  git?: { repo: string; branch?: string; kind?: 'folder' }
  rate?: { toks: number; live: boolean }
  contexto?: number // o % da janela de contexto publicado (o anel do cartão)
  recebidas?: { from: string; at: number }[] // received além do que recebeu() acrescenta (de irmãs)
  envios?: { to: string; anchor?: string; at: number; taken?: boolean }[] // sends publicados (mensagem a uma irmã)
  publicado?: string // o texto cru do arquivo publicado (formatos antigos), no lugar do montado
  listada?: boolean // padrão true; false: a lista do host a deixa de fora
}
// O start_session devolve o id da próxima sessão de `sessoes` ainda não aberta, na ordem.
export function host(on: any, sessoes: Filha[]): Host {
  const recebidas: Record<string, { from: string; at: number }[]> = {}
  const abertas: string[] = []
  const pedidos: string[] = []
  const texto = (t: string) => ({ value: { content: [{ type: 'text', text: t }] } })
  on('mcp.call', (_$: any, e: any) => {
    pedidos.push(String(e.tool))
    if (e.tool === 'get_session') return texto(JSON.stringify({ sessionId: EU }))
    if (e.tool === 'list_sessions')
      return texto(
        JSON.stringify(
          sessoes.filter(s => s.listada !== false).map(s => ({ sessionId: s.id, name: s.nome ?? s.id, title: s.nome ?? s.id, isRunning: s.rodando ?? true, ...(s.arquivada ? { isArchived: true } : {}), startedBy: EU })),
        ),
      )
    return texto('')
  })
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'USERPROFILE' ? CASA : undefined }))
  on('fs.read', (_$: any, e: any) => {
    // O host devolve o caminho com a barra do sistema (\ no Windows).
    const m = /task-tree-waits[\\/](.+)\.json$/.exec(String(e.path))
    const s = m ? sessoes.find(x => x.id === m[1]) : undefined
    if (!s) return { deny: 'sem arquivo' }
    if (s.publicado !== undefined) return { value: s.publicado }
    return {
      value: JSON.stringify({
        version: 1,
        waiting: s.aguardando === true,
        ...(s.aborted ? { aborted: true } : {}),
        waits: [],
        children: [],
        groups: s.painel ? [{ agent: '', label: '', tasks: s.painel.tasks, ...(s.painel.turns ? { turns: s.painel.turns } : {}) }, ...(s.painel.agentes ?? [])] : [],
        ...(s.git ? { git: { ...s.git, at: AGORA } } : {}),
        ...(s.rate ? { rate: { ...s.rate, at: AGORA } } : {}),
        ...(s.contexto !== undefined ? { context: { percent: s.contexto, at: AGORA } } : {}),
        received: [...(s.recebidas ?? []), ...(recebidas[s.id] ?? [])],
        ...(s.envios ? { sends: s.envios } : {}),
      }),
    }
  })
  let meu: any
  on('fs.write', (_$: any, e: any) => {
    if (/task-tree-waits[\\/]/.test(String(e.path)) && String(e.path).includes(EU)) meu = JSON.parse(String(e.text ?? e.content ?? 'null'))
    return { value: undefined }
  })
  on('tool.call', { tool: 'mcp__ccd_session__start_session' }, () => {
    const proxima = sessoes.find(s => !abertas.includes(s.id))
    if (proxima) abertas.push(proxima.id)
    return { result: proxima ? `Started session ${proxima.id}` : 'sem sessão' }
  })
  return {
    recebeu: (id, at) => void (recebidas[id] = [...(recebidas[id] ?? []), { from: EU, at }]),
    filha: id => {
      const s = sessoes.find(x => x.id === id)
      if (!s) throw new Error(`filha ${id} não está no host`)
      return s
    },
    proprio: () => meu,
    pedidosAoApp: () => [...pedidos],
  }
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

// Os subagentes lançados pela ferramenta Agent (agent.spawn): o núcleo responde com o próximo id da
// lista e o modelo dado; o host os lista (agent.list) como general-purpose. Chamar antes da primeira
// chamada a $.
export function lancaveis(on: any, ids: string[], modelo = 'claude-haiku-5-5') {
  let i = 0
  on('agent.spawn', () => ({ model: modelo, agentId: ids[i++] ?? `sub-${i}` }))
  on('agent.list', () => ({ value: ids.map(id => ({ id, type: 'general-purpose', description: `subagente ${id}` })) }))
}

// Os passos do modelo (turn.step), com o stream: `antes` ms até o primeiro chunk, `geracao` ms até o
// chunk 'stop', `tokens` no usage; o relógio parado avança entre os chunks. Chamar antes da primeira
// chamada a $; devolve o roteiro que roda um passo.
export type Passo = { antes?: number; geracao?: number; tokens?: number; agente?: string }
export function passos(on: any, relogio: any) {
  let atual: Required<Omit<Passo, 'agente'>> = { antes: 800, geracao: 2000, tokens: 200 }
  on('turn.step', async function* (_$: any, _e: any, _next: any) {
    const { antes, geracao, tokens } = atual
    await relogio.advance(antes)
    yield { kind: 'text', index: 0, text: 'a' }
    await relogio.advance(geracao)
    yield { kind: 'stop', stopReason: 'end_turn', usage: { output_tokens: tokens, input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { output_tokens: tokens, input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }
  })
  return async ($: any, p: Passo = {}) => {
    atual = { antes: p.antes ?? 800, geracao: p.geracao ?? 2000, tokens: p.tokens ?? 200 }
    const s = $.turn.step({ turnId: 't', index: 0, model: 'claude-opus-5-5', ...(p.agente !== undefined ? { agentId: p.agente } : {}) })
    for await (const _ of s) void _
    return s.result
  }
}
