import { expect } from 'claude-code/testing'
import { PROPS } from './ambiente'

// Leitura do painel em comportamento: título e estado de cada linha, pela superfície terminal.
// Único lugar que conhece os glifos e a forma da árvore desenhada.

export type Estado = 'pendente' | 'andamento' | 'concluida' | 'interrompida' | 'aguardando'
// A carta (✉) de uma tarefa de mensagem: onde a mensagem está, pela cor do ícone.
export type Carta = 'fila' | 'entregue' | 'interrompida'
export type Linha = { texto: string; titulo: string; estado?: Estado; carta?: Carta; nivel: number }

const ESTADOS: Record<string, Estado> = { '○': 'pendente', '◉': 'andamento', '✓': 'concluida', '✕': 'interrompida', '◷': 'aguardando' }
const CARTAS: Record<string, Carta> = { permission: 'fila', success: 'entregue', inactive: 'interrompida' }

// Texto mostrado por um elemento, com o rótulo dos Button.
const mostrado = (el: any): string =>
  typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(mostrado).join('')

// A cor do ícone: no próprio elemento ou no primeiro filho que a tem (dentro do Button, quando a linha dobra).
const cor = (el: any): string | undefined =>
  typeof el !== 'object' || el === null ? undefined : (el.props?.color ?? (el.children ?? []).map(cor).find((c: string | undefined) => c !== undefined))

export async function painel($: any, opcoes: { colunas?: number } = {}): Promise<Linha[]> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS(opcoes.colunas), requestId: 'task-tree' })
  const raiz: any = await ui.drawn()
  await ui.unmount()
  return ((raiz?.children ?? []) as any[])
    .filter(c => typeof c === 'object')
    .map(l => {
      const partes = ((l.children ?? []) as any[]).filter(c => typeof c === 'object')
      const icone = partes.find(p => mostrado(p) in ESTADOS || mostrado(p) === '✉')
      const titulo = icone ? partes[partes.indexOf(icone) + 1] : undefined
      // O seletor de visão no fim da linha de título fica de fora.
      const texto = mostrado(l).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd()
      const guias = texto.match(/^[\s│├└─]*/)?.[0] ?? ''
      const glifo = icone ? mostrado(icone) : ''
      return {
        texto,
        titulo: titulo ? mostrado(titulo).trim() : '',
        estado: ESTADOS[glifo],
        ...(glifo === '✉' ? { carta: CARTAS[cor(icone) ?? ''] } : {}),
        nivel: Math.round(guias.length / 2),
      }
    })
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

export function esperarCarta(linhas: Linha[], titulo: string, carta: Carta) {
  expect(linha(linhas, titulo).carta, `${titulo} no painel:\n${emTexto(linhas)}`).toBe(carta)
}
