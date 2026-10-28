import { expect } from 'claude-code/testing'
import { PROPS } from './ambiente'

// Leitura do painel em comportamento: título e estado de cada linha, pela superfície terminal.
// Único lugar que conhece os glifos e a forma da árvore desenhada.

export type Estado = 'pendente' | 'andamento' | 'concluida' | 'interrompida' | 'aguardando'
// A carta (✉) de uma tarefa de mensagem: onde a mensagem está, pela cor do ícone.
export type Carta = 'fila' | 'entregue' | 'interrompida'
// `sessao`: a linha de cartão de uma sessão filha (o ◍ no começo, o nome como título).
// `cabecalho`: uma linha do cabeçalho (título com os números, barra com os chips).
export type Linha = { texto: string; titulo: string; estado?: Estado; carta?: Carta; sessao?: true; cabecalho?: true; nivel: number }

const ESTADOS: Record<string, Estado> = { '○': 'pendente', '◉': 'andamento', '✓': 'concluida', '✕': 'interrompida', '◷': 'aguardando' }
const CARTAS: Record<string, Carta> = { permission: 'fila', success: 'entregue', inactive: 'interrompida' }
// O ícone de sessão: no começo da linha de cartão; no fim da linha da tarefa de que o cartão pende (o busto).
const SESSAO = '◍'

// Texto mostrado por um elemento, com o rótulo dos Button.
const mostrado = (el: any): string =>
  typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(mostrado).join('')

// A cor do ícone: no próprio elemento ou no primeiro filho que a tem (dentro do Button, quando a linha dobra).
const cor = (el: any): string | undefined =>
  typeof el !== 'object' || el === null ? undefined : (el.props?.color ?? (el.children ?? []).map(cor).find((c: string | undefined) => c !== undefined))

// As linhas do cabeçalho: o título com "d de n · p%", a barra com os chips, ou o painel vazio.
const DO_CABECALHO = (texto: string) => / \d+ de \d+ · \d+%/.test(texto) || /^[█░]/.test(texto) || texto === 'Nenhuma tarefa planejada.'

// Cada linha desenhada, como elemento (para agir nela) e como Linha (para ler).
function ler(raiz: any): { el: any; linha: Linha }[] {
  return ((raiz?.children ?? []) as any[])
    .filter(c => typeof c === 'object')
    .map(l => {
      const partes = ((l.children ?? []) as any[]).filter(c => typeof c === 'object')
      const icone = partes.find(p => mostrado(p) in ESTADOS || mostrado(p) === '✉' || mostrado(p) === SESSAO)
      const titulo = icone ? partes[partes.indexOf(icone) + 1] : undefined
      // O seletor de visão no fim da linha de título fica de fora.
      const texto = mostrado(l).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd()
      const guias = texto.match(/^[\s│├└─]*/)?.[0] ?? ''
      const glifo = icone ? mostrado(icone) : ''
      const linha: Linha = {
        texto,
        titulo: titulo ? mostrado(titulo).trim() : '',
        estado: ESTADOS[glifo],
        ...(glifo === '✉' ? { carta: CARTAS[cor(icone) ?? ''] } : {}),
        ...(glifo === SESSAO ? { sessao: true as const } : {}),
        ...(!icone && DO_CABECALHO(texto) ? { cabecalho: true as const } : {}),
        nivel: Math.round(guias.length / 2),
      }
      return { el: l, linha }
    })
}

// O primeiro Button dentro do elemento (o ícone que recolhe a linha).
const botao = (el: any): any =>
  typeof el !== 'object' || el === null ? undefined : el.type === 'Button' ? el : (el.children ?? []).map(botao).find((b: any) => b !== undefined)

// O painel montado, para agir nele (recolher uma linha) e reler sem remontar.
export async function montar($: any, opcoes: { colunas?: number } = {}) {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS(opcoes.colunas), requestId: 'task-tree' })
  const desenho = async () => ler(await ui.drawn())
  return {
    linhas: async (): Promise<Linha[]> => (await desenho()).map(d => d.linha),
    // Aperta o ícone da linha com esse título, como a pessoa recolhe (ou abre) a linha.
    recolher: async (titulo: string) => {
      const d = await desenho()
      const achadas = d.filter(x => x.linha.titulo === titulo)
      const b = achadas.length === 1 ? botao(achadas[0]!.el) : undefined
      const key = b?.key ?? b?.props?.key
      if (key === undefined) throw new Error(`Linha "${titulo}" sem ícone para recolher. Painel:\n${emTexto(d.map(x => x.linha))}`)
      await ui.press({ key })
    },
    fim: () => ui.unmount(),
  }
}

export async function painel($: any, opcoes: { colunas?: number } = {}): Promise<Linha[]> {
  const m = await montar($, opcoes)
  const linhas = await m.linhas()
  await m.fim()
  return linhas
}

// O cabeçalho lido das linhas: título, "d de n · p%", "sessão inteira: a de b" e os chips.
export type Cabecalho = {
  titulo: string
  feitas: number
  total: number
  pct: number
  inteira?: { feitas: number; total: number }
  chips: { andamento: number; pendentes: number; aguardando: number; sessao: number; interrompidas: number; ativas: number }
  vazio: boolean
}
const CHIPS: Record<string, keyof Cabecalho['chips']> = { '●': 'andamento', '○': 'pendentes', '◷': 'aguardando', '✉': 'sessao', '✕': 'interrompidas', '◍': 'ativas' }
export function cabecalho(linhas: Linha[]): Cabecalho {
  const cab = linhas.filter(l => l.cabecalho)
  const chips = { andamento: 0, pendentes: 0, aguardando: 0, sessao: 0, interrompidas: 0, ativas: 0 }
  if (cab.some(l => l.texto === 'Nenhuma tarefa planejada.')) return { titulo: '', feitas: 0, total: 0, pct: 0, chips, vazio: true }
  const topo = cab.find(l => / \d+ de \d+ · \d+%/.test(l.texto))
  const m = topo ? /^(.*?)  (\d+) de (\d+) · (\d+)%/.exec(topo.texto) : null
  if (!topo || !m) throw new Error(`Cabeçalho não encontrado. Painel:\n${emTexto(linhas)}`)
  const w = /sessão inteira: (\d+) de (\d+)/.exec(topo.texto)
  for (const l of cab.filter(l => /^[█░]/.test(l.texto))) for (const c of l.texto.matchAll(/([●○◷✉✕◍]) (\d+)/g)) chips[CHIPS[c[1]!]!] = Number(c[2])
  return {
    titulo: m[1]!.trim(),
    feitas: Number(m[2]),
    total: Number(m[3]),
    pct: Number(m[4]),
    ...(w ? { inteira: { feitas: Number(w[1]), total: Number(w[2]) } } : {}),
    chips,
    vazio: false,
  }
}

export const emTexto = (linhas: Linha[]) => linhas.map(l => l.texto).join('\n')

// A única linha com esse título; senão, erro com o painel inteiro.
export function linha(linhas: Linha[], titulo: string): Linha {
  const achadas = linhas.filter(l => l.titulo === titulo)
  if (achadas.length !== 1) throw new Error(`Linha "${titulo}" não encontrada (ou repetida). Painel:\n${emTexto(linhas)}`)
  return achadas[0]!
}

export function esperarEstado(linhas: Linha[], titulo: string, estado: Estado) {
  expect(linha(linhas, titulo).estado, `${titulo} no painel:\n${emTexto(linhas)}`).toBe(estado)
}

// A linha de tarefa tem o ícone de sessão depois do título.
export function temBusto(linhas: Linha[], titulo: string): boolean {
  const l = linha(linhas, titulo)
  return !l.sessao && l.texto.slice(l.texto.indexOf(titulo) + titulo.length).includes(SESSAO)
}

// A linha (de tarefa ou de cartão) mostra a palavra.
export function esperarPalavra(linhas: Linha[], titulo: string, palavra: string) {
  expect(linha(linhas, titulo).texto, `${titulo} no painel:\n${emTexto(linhas)}`).toContain(palavra)
}

export function esperarCarta(linhas: Linha[], titulo: string, carta: Carta) {
  expect(linha(linhas, titulo).carta, `${titulo} no painel:\n${emTexto(linhas)}`).toBe(carta)
}
