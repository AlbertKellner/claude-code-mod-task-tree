import { expect } from 'claude-code/testing'
import { PROPS } from './ambiente'

// Leitura do painel em comportamento: título e estado de cada linha, pela superfície terminal, e o
// desenho do app desktop, por key de Box/Button, texto e alt. Único lugar que conhece os glifos e a
// forma da árvore desenhada.

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
      // O ▸/▾ de uma linha de seção que abre (os pedidos anteriores) faz as vezes do ícone.
      const icone = partes.find(p => mostrado(p) in ESTADOS || mostrado(p) === '✉' || mostrado(p) === SESSAO || mostrado(p) === '▸' || mostrado(p) === '▾')
      const titulo = icone ? partes[partes.indexOf(icone) + 1] : undefined
      const texto = mostrado(l).trimEnd()
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

// Cada Svg do desenho do app desktop, como o golden o guarda: o texto normalizado (fins de linha LF,
// números com no máximo 2 casas), o alt e a altura (d.svgs, de noApp).
export type DesenhoSvg = { alt: string; height?: number; width?: number | string; isInteractive?: boolean; source: string }
const normalizar = (s: string) => s.replace(/\r\n/g, '\n').replace(/-?\d+\.\d{3,}/g, n => String(Math.round(Number(n) * 100) / 100))
function svgsDe(raiz: any): DesenhoSvg[] {
  const out: DesenhoSvg[] = []
  const andar = (el: any) => {
    if (typeof el !== 'object' || el === null) return
    if (el.type === 'Svg') {
      const p = el.props ?? {}
      out.push({
        alt: String(p.alt ?? ''),
        ...(p.height !== undefined ? { height: p.height } : {}),
        ...(p.width !== undefined ? { width: p.width } : {}),
        ...(p.isInteractive !== undefined ? { isInteractive: p.isInteractive } : {}),
        source: normalizar(String(p.source ?? '')),
      })
    }
    for (const c of el.children ?? []) andar(c)
  }
  andar(raiz)
  return out
}

// ---- O desenho do app desktop, lido de um jeito que vale para o Svg por linha e para o nativo: o
// texto de uma região é o que ela mostra (strings, rótulo de Button) mais o alt dos Svg dela, na
// ordem do documento. Linha e cabeçalho pela key do Box (r<i>, head), botão pela key do Button.
export type Pedaco = { tipo: 'texto' | 'svg' | 'botao'; texto: string; key?: string; props: Record<string, unknown> }
export type LinhaDoApp = { key: string; texto: string; pedacos: Pedaco[]; botoes: string[]; el: any }
export type DesenhoDoApp = {
  raiz: any
  bytes: number // JSON.stringify(raiz).length, o que o limite de 600 KB mede
  nos: number // elementos mais strings
  fundo: number // a maior profundidade
  aviso: boolean // o desenho virou "Painel grande demais"
  cabecalho: LinhaDoApp // o Box key="head" (texto '' se não houver)
  linhas: LinhaDoApp[] // os Box key="r<i>", em qualquer profundidade, na ordem
  textos: string[] // linhas.map(l => l.texto)
  svgs: DesenhoSvg[] // todos os Svg
  revelados: number // elementos com hover ou display: 'none' (cartão de hover): tem de ser 0
}
const chave = (el: any) => el?.key ?? el?.props?.key
const juntar = (ps: Pedaco[]) => ps.map(p => p.texto).join(' ').replace(/\s+/g, ' ').trim()
function regiao(el: any): LinhaDoApp {
  const pedacos: Pedaco[] = []
  const botoes: string[] = []
  const andar = (x: any, props: Record<string, unknown>) => {
    if (typeof x === 'string') {
      if (/\S/.test(x)) pedacos.push({ tipo: 'texto', texto: x, props })
      return
    }
    if (typeof x !== 'object' || x === null) return
    const k = chave(x)
    if (x.type === 'Svg') {
      pedacos.push({ tipo: 'svg', texto: String(x.props?.alt ?? ''), ...(k !== undefined ? { key: String(k) } : {}), props: x.props ?? {} })
      return
    }
    if (x.type === 'Button') {
      if (k !== undefined) botoes.push(String(k))
      const label = x.props?.label
      if (!(x.children ?? []).length) {
        if (typeof label === 'string' && label.trim() !== '') pedacos.push({ tipo: 'botao', texto: label, ...(k !== undefined ? { key: String(k) } : {}), props: x.props ?? {} })
        return
      }
    }
    for (const c of x.children ?? []) andar(c, x.type === 'Text' ? (x.props ?? {}) : props)
  }
  if (el) andar(el, {})
  return { key: String(chave(el) ?? ''), texto: juntar(pedacos), pedacos, botoes, el }
}
function lerApp(raiz: any): DesenhoDoApp {
  let cabecalho: LinhaDoApp | undefined
  const linhas: LinhaDoApp[] = []
  let nos = 0
  let fundo = 0
  let revelados = 0
  const medir = (x: any, n: number) => {
    nos++
    fundo = Math.max(fundo, n)
    if (typeof x !== 'object' || x === null) return
    if (x.hover !== undefined || x.props?.hover !== undefined || x.props?.display === 'none') revelados++
    for (const c of x.children ?? []) medir(c, n + 1)
  }
  const achar = (x: any) => {
    if (typeof x !== 'object' || x === null) return
    const k = chave(x)
    if (x.type === 'Box' && typeof k === 'string' && /^r\d+$/.test(k)) return void linhas.push(regiao(x))
    if (x.type === 'Box' && k === 'head' && !cabecalho) return void (cabecalho = regiao(x))
    for (const c of x.children ?? []) achar(c)
  }
  medir(raiz, 1)
  achar(raiz)
  return {
    raiz,
    bytes: JSON.stringify(raiz ?? null).length,
    nos,
    fundo,
    aviso: regiao(raiz).texto.includes('Painel grande demais'),
    cabecalho: cabecalho ?? { key: '', texto: '', pedacos: [], botoes: [], el: undefined },
    linhas,
    textos: linhas.map(l => l.texto),
    svgs: svgsDe(raiz),
    revelados,
  }
}
const montarApp = ($: any, colunas?: number) =>
  $.ui.mount({ plugin: 'task-tree', surface: 'desktop', component: 'Pane', props: PROPS(colunas ?? 60), requestId: 'task-tree' })
// O desenho do app desktop, montado uma vez (a 60 colunas, sem dizer outra).
export async function noApp($: any, opcoes: { colunas?: number } = {}): Promise<DesenhoDoApp> {
  const ui = await montarApp($, opcoes.colunas)
  const raiz = await ui.drawn()
  await ui.unmount()
  return lerApp(raiz)
}
// O desenho do app desktop montado, para apertar um botão pela key e reler sem remontar.
export async function montarNoApp($: any, opcoes: { colunas?: number } = {}) {
  const ui = await montarApp($, opcoes.colunas)
  return {
    desenho: async (): Promise<DesenhoDoApp> => lerApp(await ui.drawn()),
    apertar: async (key: string): Promise<void> => void (await ui.press({ key })),
    fim: (): Promise<void> => ui.unmount(),
  }
}
const casa = (texto: string, quem: string | RegExp) => (typeof quem === 'string' ? texto.includes(quem) : quem.test(texto))
export const emTextoDoApp = (d: DesenhoDoApp) => [d.cabecalho.texto, ...d.textos].join('\n')
// A primeira linha cujo texto contém (ou casa).
export const primeiraDoApp = (d: DesenhoDoApp, quem: string | RegExp): LinhaDoApp | undefined => d.linhas.find(l => casa(l.texto, quem))
// A única linha com um pedaço de texto igual (com string; na falta, cujo texto contém) ou cujo texto
// casa (com RegExp); senão, erro com o desenho inteiro.
export function linhaDoApp(d: DesenhoDoApp, quem: string | RegExp): LinhaDoApp {
  const iguais = typeof quem === 'string' ? d.linhas.filter(l => l.pedacos.some(p => p.tipo === 'texto' && p.texto.trim() === quem)) : []
  const achadas = iguais.length > 0 ? iguais : d.linhas.filter(l => casa(l.texto, quem))
  if (achadas.length !== 1) throw new Error(`Linha "${String(quem)}" não encontrada (ou repetida) no app. Painel:\n${emTextoDoApp(d)}`)
  return achadas[0]!
}
// Os pedaços que vêm depois do primeiro pedaço de texto igual ao título (ou que casa); [] sem ele.
export const pedacosDepois = (l: LinhaDoApp, quem: string | RegExp): Pedaco[] => {
  const i = l.pedacos.findIndex(p => p.tipo === 'texto' && (typeof quem === 'string' ? p.texto.trim() === quem : quem.test(p.texto)))
  return i < 0 ? [] : l.pedacos.slice(i + 1)
}
// O estado geral do cabeçalho, a palavra depois de "estado geral: " no pedaço (alt ou texto) que a tem.
export const estadoGeral = (d: DesenhoDoApp): string | undefined =>
  d.cabecalho.pedacos.map(p => /estado geral: ([^,;]+)/.exec(p.texto)?.[1]).find(Boolean)?.trim()

// O golden: a árvore do desenho, normalizada, e as fontes dos Svg numa lista sem repetição (a árvore
// as cita pelo índice). Só type, key, props, hover e children entram: press (o handle não é estável),
// part, group e client não são desenho.
export function arvoreDoApp(raiz: any): { arvore: unknown; svgs: string[] } {
  const svgs: string[] = []
  const ordenado = (o: any) => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]))
  const no = (el: any): unknown => {
    if (typeof el !== 'object' || el === null) return el
    const p = { ...(el.props ?? {}) }
    const k = el.key ?? p.key
    delete p.key
    if (el.type === 'Svg') {
      const s = normalizar(String(p.source ?? ''))
      delete p.source
      const i = svgs.includes(s) ? svgs.indexOf(s) : svgs.push(s) - 1
      return { t: 'Svg', ...(k !== undefined ? { k } : {}), p: ordenado(p), s: i }
    }
    return {
      t: el.type,
      ...(k !== undefined ? { k } : {}),
      ...(Object.keys(p).length ? { p: ordenado(p) } : {}),
      ...(el.hover ? { h: el.hover } : {}),
      ...(el.children?.length ? { c: el.children.map(no) } : {}),
    }
  }
  return { arvore: no(raiz), svgs }
}
// O desenho do app desktop para o golden, a 60 colunas.
export async function desenhoDoApp($: any): Promise<{ arvore: unknown; svgs: string[] }> {
  const ui = await montarApp($, 60)
  const raiz = await ui.drawn()
  await ui.unmount()
  return arvoreDoApp(raiz)
}

export async function painel($: any, opcoes: { colunas?: number } = {}): Promise<Linha[]> {
  const m = await montar($, opcoes)
  const linhas = await m.linhas()
  await m.fim()
  return linhas
}

// O painel com a linha "+N pedidos anteriores" aberta (fica aberta, como a pessoa a deixou).
export async function comHistorico($: any, n: number): Promise<Linha[]> {
  const m = await montar($)
  await m.recolher(`+${n} pedidos anteriores`)
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

// Os cartões de uma filha, na ordem do painel: a tarefa sob a qual cada um está (a linha anterior de
// nível menor que não é cartão), as tarefas dentro dele (as linhas seguintes até a próxima de nível
// menor ou o próximo cartão do mesmo nível) e o nível.
export function cartoes(linhas: Linha[], nome: string): { sob: string; tarefas: string[]; nivel: number }[] {
  return linhas.flatMap((l, i) => {
    if (!l.sessao || l.titulo !== nome) return []
    const antes = linhas.slice(0, i).reverse().find(x => !x.sessao && !x.cabecalho && x.nivel < l.nivel)
    const tarefas: string[] = []
    for (const x of linhas.slice(i + 1)) {
      if (x.nivel < l.nivel || (x.sessao && x.nivel === l.nivel)) break
      if (!x.sessao && x.titulo !== '') tarefas.push(x.titulo)
    }
    return [{ sob: antes?.titulo ?? '', tarefas, nivel: l.nivel }]
  })
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

// A carta de envio (a linha ✉ "Para <sessão>: …") que pende da tarefa com esse título, ou undefined.
export function cartaSob(linhas: Linha[], titulo: string): Carta | undefined {
  const l = linha(linhas, titulo)
  for (const x of linhas.slice(linhas.indexOf(l) + 1)) {
    if (x.nivel <= l.nivel) break
    if (x.carta !== undefined && x.titulo.startsWith('Para ')) return x.carta
  }
  return undefined
}

export function esperarCartaSob(linhas: Linha[], titulo: string, carta: Carta) {
  expect(cartaSob(linhas, titulo), `carta sob ${titulo} no painel:\n${emTexto(linhas)}`).toBe(carta)
}

export function esperarCarta(linhas: Linha[], titulo: string, carta: Carta) {
  expect(linha(linhas, titulo).carta, `${titulo} no painel:\n${emTexto(linhas)}`).toBe(carta)
}
