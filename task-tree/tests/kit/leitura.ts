import { expect } from 'claude-code/testing'
import { PROPS } from './ambiente'

// Leitura do painel em comportamento: título e estado de cada linha, pela superfície terminal.
// Único lugar que conhece os glifos e a forma da árvore desenhada.

export type Estado = 'pendente' | 'andamento' | 'concluida' | 'interrompida' | 'aguardando'
export type Linha = { texto: string; titulo: string; estado?: Estado; nivel: number }

const ESTADOS: Record<string, Estado> = { '○': 'pendente', '◉': 'andamento', '✓': 'concluida', '✕': 'interrompida', '◷': 'aguardando' }

// Texto mostrado por um elemento, com o rótulo dos Button.
const mostrado = (el: any): string =>
  typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(mostrado).join('')

export async function painel($: any, opcoes: { colunas?: number } = {}): Promise<Linha[]> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS(opcoes.colunas), requestId: 'task-tree' })
  const raiz: any = await ui.drawn()
  await ui.unmount()
  return ((raiz?.children ?? []) as any[])
    .filter(c => typeof c === 'object')
    .map(l => {
      const partes = ((l.children ?? []) as any[]).filter(c => typeof c === 'object')
      const icone = partes.find(p => mostrado(p) in ESTADOS)
      const titulo = icone ? partes[partes.indexOf(icone) + 1] : undefined
      // O seletor de visão no fim da linha de título fica de fora.
      const texto = mostrado(l).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd()
      const guias = texto.match(/^[\s│├└─]*/)?.[0] ?? ''
      return {
        texto,
        titulo: titulo ? mostrado(titulo).trim() : '',
        estado: icone ? ESTADOS[mostrado(icone)] : undefined,
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
