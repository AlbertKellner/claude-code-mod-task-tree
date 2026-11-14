// Golden do desenho: a árvore do app desktop (Box, Text, Button e os Svg que restam) de 4 cenários
// (tests/golden.test.ts), travada depois que o usuário valida o painel no app. Ver a seção "Golden do
// desenho" do CLAUDE.md.
//
// Formato de cada cenário em tests/golden/desenho.ts: { arvore, svgs }. A árvore é a de ui.drawn()
// normalizada (tests/kit/leitura.ts, arvoreDoApp): cada nó é { t: tipo, k?: key, p?: props, h?: hover,
// c?: filhos } ou uma string; um Svg é { t: 'Svg', p: { alt, width?, height? }, s: índice em svgs },
// e svgs guarda cada fonte uma vez só.
//
// Uso:
//   node scripts/golden.mjs --aprovar <cenário…|--todos> --motivo "<palavras do usuário entre aspas>, AAAA-MM-DD"
//       roda os cenários e grava o desenho atual em tests/golden/desenho.ts, com o selo em regras/selos.json;
//       só depois de o usuário validar o painel no app e dizer que está certo (as palavras dele no motivo)
//   node scripts/golden.mjs --pagina
//       opcional, sob pedido: golden-recebido/index.html (fora do git), o aprovado e o atual lado a lado:
//       um desenho aproximado da árvore (o aceite é no app, não aqui), as diferenças da árvore linha a
//       linha e as fontes dos Svg
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acharBinario } from './binario.mjs'
import { aprovarGolden, lerGolden, motivoValido } from './selos.mjs'

export const CENARIOS = ['principal', 'filha', 'envios', 'subagente']

// Roda só o golden.test.ts numa cópia do mod e recolhe o desenho de cada cenário (as linhas GOLDEN-NEW).
export function receber(repo) {
  const tmp = mkdtempSync(join(tmpdir(), 'task-tree-golden-'))
  try {
    const mod = join(tmp, 'task-tree')
    cpSync(join(repo, 'task-tree'), mod, { recursive: true })
    for (const f of readdirSync(join(mod, 'tests'))) if (/\.test\.tsx?$/.test(f) && f !== 'golden.test.ts') rmSync(join(mod, 'tests', f))
    const claude = acharBinario()
    const r = spawnSync(claude, ['plugin', 'test', mod], { encoding: 'utf8', shell: claude === 'claude', maxBuffer: 256 * 1024 * 1024 })
    const recebido = {}
    for (const l of `${r.stdout}\n${r.stderr}`.split(/\r?\n/)) {
      const m = /GOLDEN-NEW (\S+) (.+)$/.exec(l)
      if (m) recebido[m[1]] = JSON.parse(m[2])
    }
    return recebido
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

// ---- Página de comparação (--pagina). Nada aqui entra no check nem no selo.

const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const attr = s => xml(s).replace(/"/g, '&quot;')

// Um golden gravado antes do formato da árvore (lista de { alt, source }) vira só a lista de fontes.
const formato = v => (Array.isArray(v) ? { arvore: null, svgs: v.map(s => String(s.source ?? '')), antigo: true } : v ?? { arvore: null, svgs: [] })

// A árvore em texto, um nó por linha, recuada pela profundidade: o que a diferença compara.
function contorno(arvore) {
  const linhas = []
  const props = p => (p && Object.keys(p).length ? ' ' + Object.entries(p).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ') : '')
  const andar = (n, fundo) => {
    const recuo = '  '.repeat(fundo)
    if (typeof n !== 'object' || n === null) return void linhas.push(`${recuo}${JSON.stringify(n)}`)
    const k = n.k !== undefined ? ` #${n.k}` : ''
    const s = n.s !== undefined ? ` svg[${n.s}]` : ''
    const h = n.h ? ` hover=${JSON.stringify(n.h)}` : ''
    linhas.push(`${recuo}${n.t}${k}${s}${props(n.p)}${h}`)
    for (const c of n.c ?? []) andar(c, fundo + 1)
  }
  if (arvore) andar(arvore, 0)
  return linhas
}

// Diferença linha a linha (maior subsequência comum). Árvores muito grandes caem num corte simples.
function diferenca(a, b) {
  const n = a.length, m = b.length
  if (n * m > 25_000_000) return [...a.map(l => ['-', l]), ...b.map(l => ['+', l])]
  const t = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])
  const out = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) out.push([' ', a[i++]]), j++
    else if (t[i + 1][j] >= t[i][j + 1]) out.push(['-', a[i++]])
    else out.push(['+', b[j++]])
  }
  while (i < n) out.push(['-', a[i++]])
  while (j < m) out.push(['+', b[j++]])
  return out
}

// Só as linhas que mudaram, com 2 de contexto; o resto vira "… N linhas iguais".
function diferencaHtml(dif) {
  if (!dif.some(([s]) => s !== ' ')) return '<p class="igual">árvore igual</p>'
  const perto = dif.map((_, i) => dif.slice(Math.max(0, i - 2), i + 3).some(([s]) => s !== ' '))
  const out = []
  let pulo = 0
  dif.forEach(([s, l], i) => {
    if (!perto[i]) return void pulo++
    if (pulo) out.push(`<div class="pulo">… ${pulo} linhas iguais</div>`), (pulo = 0)
    out.push(`<div class="${s === '-' ? 'sai' : s === '+' ? 'entra' : 'ctx'}">${s} ${xml(l)}</div>`)
  })
  if (pulo) out.push(`<div class="pulo">… ${pulo} linhas iguais</div>`)
  return `<pre class="dif">${out.join('')}</pre>`
}

// Cores aproximadas das chaves de tema (claro); cor crua (#…, rgb…) passa como está.
const TEMA = {
  text: '#1f1f1f', inactive: '#8a8a8a', subtle: '#b0b0b0', success: '#2e8b57', error: '#c62828', warning: '#d98a00',
  permission: '#3b6fd8', suggestion: '#3b6fd8', claude: '#d97757', effortUltra: '#8700ff', userMessageBackground: '#f2f1ee',
}
const cor = c => (typeof c !== 'string' ? undefined : TEMA[c] ?? (/^(#|rgb|hsl)/.test(c) ? c : '#999'))
const larg = v => (typeof v === 'number' ? `${v}ch` : v)
const alt = v => (typeof v === 'number' ? `${v * 1.5}em` : v)
const TAMANHO = { title: '1.25em', heading: '1.1em', body: '1em', caption: '.85em', footnote: '.8em' }

// Desenho aproximado da árvore: Box → div flex (células: ch na horizontal, 1,5em por linha), Text →
// span, Button → button, Svg → a fonte em linha. Não é a pintura do app.
function desenho(arvore, svgs) {
  const css = p => {
    const s = []
    const add = (k, v) => v !== undefined && v !== null && s.push(`${k}:${v}`)
    add('flex-direction', p.flexDirection)
    add('flex-grow', p.flexGrow)
    add('flex-shrink', p.flexShrink)
    add('align-items', p.alignItems)
    add('justify-content', p.justifyContent)
    add('position', p.position)
    add('top', alt(p.top)), add('bottom', alt(p.bottom)), add('left', larg(p.left)), add('right', larg(p.right))
    add('width', larg(p.width)), add('height', alt(p.height)), add('min-width', larg(p.minWidth)), add('min-height', alt(p.minHeight))
    add('gap', larg(p.gap ?? p.columnGap))
    add('padding-left', larg(p.paddingLeft ?? p.paddingX ?? p.padding)), add('padding-right', larg(p.paddingRight ?? p.paddingX ?? p.padding))
    add('padding-top', alt(p.paddingTop ?? p.paddingY ?? p.padding)), add('padding-bottom', alt(p.paddingBottom ?? p.paddingY ?? p.padding))
    add('margin-left', larg(p.marginLeft ?? p.marginX ?? p.margin)), add('margin-right', larg(p.marginRight ?? p.marginX ?? p.margin))
    add('margin-top', alt(p.marginTop ?? p.marginY ?? p.margin)), add('margin-bottom', alt(p.marginBottom ?? p.marginY ?? p.margin))
    if (p.borderStyle) add('border', `1px solid ${cor(p.borderColor) ?? '#ccc'}`), add('border-radius', p.borderStyle === 'round' ? '6px' : '0')
    if (p.borderDimColor) add('border-color', '#ddd')
    add('background', cor(p.backgroundColor))
    add('overflow', p.overflow)
    add('display', p.display)
    return s.join(';')
  }
  const texto = p => {
    const s = []
    if (cor(p.color)) s.push(`color:${cor(p.color)}`)
    if (p.dimColor) s.push('opacity:.6')
    if (p.mono) s.push('font-family:ui-monospace,Consolas,monospace')
    if (p.tabular) s.push('font-variant-numeric:tabular-nums')
    if (TAMANHO[p.size]) s.push(`font-size:${TAMANHO[p.size]}`)
    if (p.bold || p.weight === 'bold' || p.weight === 'semibold') s.push('font-weight:600')
    if (typeof p.wrap === 'string' && p.wrap.startsWith('truncate')) s.push('white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0')
    else s.push('white-space:pre')
    return s.join(';')
  }
  const no = n => {
    if (typeof n !== 'object' || n === null) return xml(n ?? '')
    const p = n.p ?? {}
    const filhos = (n.c ?? []).map(no).join('')
    const dica = attr([n.t, n.k !== undefined ? `#${n.k}` : '', Object.keys(p).length ? JSON.stringify(p) : ''].filter(Boolean).join(' '))
    if (n.t === 'Svg') {
      const st = `display:inline-block;flex-shrink:0;width:${typeof p.width === 'number' ? `${p.width}px` : p.width ?? '100%'};height:${typeof p.height === 'number' ? `${p.height}px` : p.height ?? 'auto'}`
      return `<span class="svg" style="${st}" title="${dica}">${svgs[n.s] ?? ''}</span>`
    }
    if (n.t === 'Text') return `<span class="text" style="${texto(p)}" title="${dica}">${filhos}</span>`
    if (n.t === 'Button') return `<button class="botao${p.plain ? ' plain' : ''}" style="${p.dimColor ? 'opacity:.6' : ''}" title="${dica}">${xml(p.label ?? '')}${filhos}</button>`
    if (n.t === 'Box') return `<div class="box" style="display:flex;${css(p)}" title="${dica}">${filhos}</div>`
    return `<span class="outro" title="${dica}">${n.t}${filhos}</span>`
  }
  return arvore ? `<div class="painel">${no(arvore)}</div>` : '<p class="vazio">sem árvore</p>'
}

// Números do cenário: tamanho do JSON, nós, Svg, botões (pelas keys).
function medidas(v) {
  let nos = 0
  const botoes = []
  const andar = n => {
    nos++
    if (typeof n === 'object' && n !== null) {
      if (n.t === 'Button' && n.k !== undefined) botoes.push(n.k)
      for (const c of n.c ?? []) andar(c)
    }
  }
  if (v.arvore) andar(v.arvore)
  return `${(JSON.stringify(v).length / 1024).toFixed(1)} KB · ${nos} nós · ${v.svgs.length} fontes de Svg · ${botoes.length} botões`
}

const fontes = v =>
  v.svgs.map((s, i) => `<figure><figcaption>svg[${i}] · ${s.length} caracteres</figcaption><div class="fonte">${s}</div><details><summary>fonte</summary><pre>${xml(s)}</pre></details></figure>`).join('') ||
  '<p class="vazio">nenhum Svg</p>'

export function pagina(aprovado, recebido) {
  const blocos = CENARIOS.map(c => {
    const a = formato(aprovado[c])
    const r = formato(recebido[c])
    const igual = JSON.stringify(aprovado[c]) === JSON.stringify(recebido[c])
    const svgsIguais = JSON.stringify(a.svgs) === JSON.stringify(r.svgs)
    const lado = (titulo, v) => `<div><h3>${titulo}</h3><p class="medidas">${v.antigo ? 'formato antigo (lista de SVG) · ' : ''}${medidas(v)}</p>${desenho(v.arvore, v.svgs)}</div>`
    return `<section id="${c}">
<h2>${c} <span class="${igual ? 'ok' : 'muda'}">${igual ? 'igual' : 'diferente'}</span></h2>
${c in recebido ? '' : '<p class="muda">o cenário não gerou desenho nesta rodada</p>'}
<div class="lados">${lado('aprovado', a)}${lado('atual', r)}</div>
<details${igual ? '' : ' open'}><summary>árvore: aprovado → atual (− sai, + entra)</summary>${diferencaHtml(diferenca(contorno(a.arvore), contorno(r.arvore)))}</details>
<details${svgsIguais ? '' : ' open'}><summary>fontes dos Svg${svgsIguais ? ' (iguais)' : ' (diferentes)'}</summary><div class="lados"><div><h3>aprovado</h3>${fontes(a)}</div><div><h3>atual</h3>${fontes(r)}</div></div></details>
</section>`
  }).join('\n')
  const indice = CENARIOS.map(c => `<a href="#${c}">${c}${JSON.stringify(aprovado[c]) === JSON.stringify(recebido[c]) ? '' : ' ●'}</a>`).join(' · ')
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Golden do desenho</title>
<style>
body{font-family:system-ui,sans-serif;margin:16px;color:#1f1f1f;background:#fff}
.aviso{font-size:13px;opacity:.75;max-width:70ch}
.lados{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
@media (max-width:900px){.lados{grid-template-columns:1fr}}
h2 span{font-size:13px;font-weight:500;padding:1px 8px;border-radius:9px}
.ok{background:#e3f3e8;color:#2e8b57}.muda{background:#fdecea;color:#c62828}
.medidas{font-size:12px;opacity:.7;margin:0 0 6px}
.painel{width:60ch;max-width:100%;font-size:13px;line-height:1.5em;border:1px dashed #ccc;padding:4px;overflow:hidden}
.painel .box,.painel .text,.painel .svg{box-sizing:border-box;min-width:0}
.painel .svg svg{width:100%;height:100%;display:block}
.botao{font:inherit;padding:0 2px;border:1px solid #bbb;border-radius:3px;background:#fafafa;cursor:pointer}
.botao.plain{border-color:transparent;background:rgba(59,111,216,.12)}
.dif{font-size:12px;background:#fafafa;padding:8px;overflow:auto;max-height:60vh}
.dif div{white-space:pre}.sai{background:#fdecea}.entra{background:#e3f3e8}.ctx{opacity:.6}.pulo{opacity:.45;font-style:italic}
.igual,.vazio{font-size:13px;opacity:.7}
figure{margin:0 0 10px}figcaption{font-size:11px;opacity:.6}.fonte{max-width:60ch}.fonte svg{max-width:100%;height:auto}
pre{white-space:pre-wrap;word-break:break-all;font-size:11px}
section{border-top:1px solid #ddd;margin-top:20px;padding-top:4px}
</style>
<h1>Golden do desenho</h1>
<p class="aviso">Desenho aproximado da árvore de Box, Text, Button e Svg (60 colunas; ch por coluna, 1,5em por linha; cores do tema claro aproximadas). Não é a pintura do app: o aceite é do usuário, no app. Passe o mouse sobre um elemento para ver tipo, key e props.</p>
<p>${indice}</p>
${blocos}`
}

if (process.argv[1] && fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/')) {
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
  const args = process.argv.slice(2)
  const valor = nome => {
    const i = args.indexOf(nome)
    return i >= 0 ? args[i + 1] : undefined
  }
  try {
    if (args.includes('--aprovar')) {
      const motivo = valor('--motivo')
      // Recusa antes de rodar qualquer coisa: sem as palavras do usuário, nada se grava.
      if (!motivoValido(motivo)) throw new Error('--motivo precisa das palavras do usuário entre aspas e da data (AAAA-MM-DD) da validação no app')
      const pedidos = args.includes('--todos') ? CENARIOS : args.filter(a => CENARIOS.includes(a))
      if (pedidos.length === 0) throw new Error(`diga os cenários (${CENARIOS.join(', ')}) ou --todos`)
      const recebido = receber(repo)
      const faltam = pedidos.filter(c => !(c in recebido))
      if (faltam.length > 0) throw new Error(`os cenários não geraram desenho: ${faltam.join(', ')}`)
      const gravados = aprovarGolden(repo, Object.fromEntries(pedidos.map(c => [c, recebido[c]])), motivo)
      console.log(`golden aprovado: ${gravados.join(', ')}`)
    } else if (args.includes('--pagina')) {
      const html = pagina(lerGolden(repo), receber(repo))
      const pasta = join(repo, 'golden-recebido')
      mkdirSync(pasta, { recursive: true })
      writeFileSync(join(pasta, 'index.html'), html)
      console.log(join(pasta, 'index.html'))
    } else {
      throw new Error('use --aprovar <cenário…|--todos> --motivo "…" ou --pagina')
    }
  } catch (err) {
    console.error(`recusado: ${err.message}`)
    process.exit(1)
  }
}
