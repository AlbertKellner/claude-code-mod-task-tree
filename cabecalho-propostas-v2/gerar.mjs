// Rodada 2: a P5 como guia (faixa de estado à esquerda + bloco de números à direita) e 5 variações.
// Gera os .svg (tema × largura) e o HTML autocontido propostas-cabecalho-v2.html (SVGs inline).
// Uso: node gerar.mjs, nesta pasta. Só desenho; nada do mod é importado.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))

const D = {
  titulo: 'Explicar as opções para os PRs antigos',
  feitas: 15, total: 19, pct: 79, tempo: '21:50', toks: '79 toks/s',
  repo: 'claude-code-mod-task-tree', branch: 'feat/filha-completa-na-orquestradora',
  chips: [['current', 1, 'em andamento'], ['open', 3, 'pendentes'], ['interrupted', 1, 'interrompida'], ['running', 1, 'sessão ativa']],
  estado: 'andamento',
}
// A paleta do mod (LIGHT/DARK de draw/svg.ts) e a página do app.
const TEMAS = {
  claro: { page: '#fcfcfb', cd: '#f9f9f7', cs: '#e1e1df', p: '#2c2c2a', s: '#5f5e5a', am: '#ba7517', gr: '#639922', gy: '#888780', bl: '#378add', rd: '#e24b4a', tr: 'rgba(136,135,128,.25)', btn: '#2c2c2a', btnt: '#f9f9f7' },
  escuro: { page: '#1a1a19', cd: '#20201f', cs: '#373736', p: '#e8e6dc', s: '#b4b2a9', am: '#ef9f27', gr: '#97c459', gy: '#9c9a92', bl: '#85b7eb', rd: '#f09595', tr: 'rgba(136,135,128,.25)', btn: '#e8e6dc', btnt: '#20201f' },
}
// O estado geral do painel e a cor da faixa: em andamento (âmbar), aguardando (âmbar apagado), sessão
// ativa sem nada próprio em andamento (azul), interrompido (cinza), tudo concluído (verde).
const ESTADOS = [['andamento', 'em andamento'], ['aguardando', 'aguardando'], ['sessao', 'sessão ativa'], ['interrompido', 'interrompido'], ['concluido', 'tudo concluído']]
const corEstado = (estado, t) => ({ andamento: t.am, aguardando: t.am, sessao: t.bl, interrompido: t.gy, concluido: t.gr }[estado])
const opEstado = estado => (estado === 'aguardando' ? '.5' : '1')

const PAD = 14.5, CR = 2.5, GAP = 8, ICONS_W = 72
const FONT = `font-family="ui-sans-serif, system-ui, 'Segoe UI', sans-serif"`
const tw = (s, size) => s.length * size * 0.54
const fit = (s, size, max) => { if (tw(s, size) <= max) return s; let n = s.length; while (n > 1 && tw(s.slice(0, n) + '…', size) > max) n--; return s.slice(0, n).trimEnd() + '…' }
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const text = (x, y, s, size, fill, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`
const num = 'font-variant-numeric="tabular-nums"'
const card = (W, H, t, stroke = t.cs, sw = 1) => `<rect x="${CR}" y="${CR}" width="${W - 2 * CR}" height="${H - GAP - 2 * CR}" rx="8" fill="${t.cd}" stroke="${stroke}" stroke-width="${sw}"/>`
const botoes = (W, y, t) => { const x = W - PAD - 58; return `<rect x="${x}" y="${y - 12}" width="26" height="24" rx="6" fill="${t.btn}"/><text x="${x + 13}" y="${y + 5}" font-size="14" fill="${t.btnt}" text-anchor="middle">≡</text><text x="${x + 45}" y="${y + 5}" font-size="14" fill="${t.s}" text-anchor="middle" opacity=".7">▤</text>` }
const icone = (tone, x, y, t) => {
  switch (tone) {
    case 'current': return `<circle cx="${x}" cy="${y}" r="5.5" fill="none" stroke="${t.am}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="2.2" fill="${t.am}"/>`
    case 'done': return `<path d="M${x - 4.5} ${y}l3 3.5l6 -7" fill="none" stroke="${t.gr}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    case 'interrupted': return `<path d="M${x - 3.5} ${y - 3.5}l7 7M${x + 3.5} ${y - 3.5}l-7 7" stroke="${t.gy}" stroke-width="1.6" stroke-linecap="round"/>`
    case 'running': return `<circle cx="${x}" cy="${y - 2.5}" r="2.6" fill="none" stroke="${t.bl}" stroke-width="1.6"/><path d="M${x - 5} ${y + 5.5}a5 5 0 0 1 10 0" fill="none" stroke="${t.bl}" stroke-width="1.6" stroke-linecap="round"/>`
    default: return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${t.gy}" stroke-width="1.5"/>`
  }
}
const corDo = (tone, t) => ({ current: t.am, done: t.gr, interrupted: t.gy, running: t.bl, open: t.gy }[tone])
const repoIcone = (x, y, t) => `<path d="M${x} ${y - 5}l5 5l-5 5l-5 -5z" fill="none" stroke="${t.s}" stroke-width="1.4"/>`
const branchIcone = (x, y, t) => `<circle cx="${x - 3}" cy="${y - 4}" r="1.8" fill="none" stroke="${t.s}" stroke-width="1.3"/><circle cx="${x - 3}" cy="${y + 4}" r="1.8" fill="none" stroke="${t.s}" stroke-width="1.3"/><circle cx="${x + 4}" cy="${y - 2}" r="1.8" fill="none" stroke="${t.s}" stroke-width="1.3"/><path d="M${x - 3} ${y - 2.2}v4.4M${x + 4} ${y - .2}q0 3 -4 3.5" fill="none" stroke="${t.s}" stroke-width="1.3"/>`
// Contexto com ícones (como hoje) ou como trilha "repo / branch" (breadcrumb, sem ícones).
const contexto = (x, y, max, size, t, d, extra = '') => {
  const full = `${d.repo}    ${d.branch}`
  let s = ''
  if (tw(full, size) + 36 <= max) s = repoIcone(x + 6, y - 4, t) + text(x + 16, y, d.repo, size, t.s) + branchIcone(x + 16 + tw(d.repo, size) + 16, y - 4, t) + text(x + 16 + tw(d.repo, size) + 28, y, d.branch, size, t.s)
  else if (tw(d.branch, size) + 16 <= max) s = branchIcone(x + 6, y - 4, t) + text(x + 16, y, fit(d.branch, size, max - 16), size, t.s)
  return s + (extra && s ? text(x + 16 + Math.min(tw(full, size) + 30, max), y, extra, size, t.s, 'opacity=".6"') : '')
}
const trilha = (x, y, max, size, t, d) => {
  const full = `${d.repo}  /  ${d.branch}`
  if (tw(full, size) <= max) return text(x, y, d.repo, size, t.s, 'opacity=".75"') + text(x + tw(d.repo + '  ', size), y, '/', size, t.s, 'opacity=".4"') + text(x + tw(d.repo + '  /  ', size), y, d.branch, size, t.s)
  return text(x, y, fit(d.branch, size, max), size, t.s)
}
const barra = (x, y, w, h, pct, t, cor = t.gr) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${t.tr}"/><rect x="${x}" y="${y}" width="${Math.max(h, (w * pct) / 100)}" height="${h}" rx="${h / 2}" fill="${cor}"/>`
const anel = (cx, cy, r, sw, pct, t, cor = t.gr) => { const c = 2 * Math.PI * r; return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${t.tr}" stroke-width="${sw}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${cor}" stroke-width="${sw}" stroke-dasharray="${(c * pct) / 100} ${c}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>` }
const pilulas = (x, y, max, t, d, size = 12, h = 20, leve = false) => {
  const wide = d.chips.reduce((w, c) => w + 44 + tw(`${c[1]} ${c[2]}`, size), -8) <= max
  let cx = x, out = ''
  for (const [tone, n, palavra] of d.chips) {
    const s = wide ? `${n} ${palavra}` : `${n}`
    const w = 30 + tw(s, size)
    if (cx + w > x + max) break
    const cor = corDo(tone, t)
    out += leve
      ? `<rect x="${cx + .5}" y="${y - h + 6.5}" width="${w - 1}" height="${h - 1}" rx="${h / 2}" fill="none" stroke="${cor}" stroke-opacity=".45"/>`
      : `<rect x="${cx}" y="${y - h + 6}" width="${w}" height="${h}" rx="${h / 2}" fill="${cor}" fill-opacity=".13"/>`
    out += icone(tone, cx + 13, y - 4, t) + text(cx + 23, y, s, size, t.p)
    cx += w + 8
  }
  return out
}
const faixaStatus = (x, y, t, d, size = 12) => { let cx = x, out = ''; for (const [tone, n] of d.chips) { out += icone(tone, cx + 5, y - 4, t) + text(cx + 15, y, String(n), size, corDo(tone, t), `font-weight="600" ${num}`); cx += 38 }; return out }
// A faixa à esquerda, dentro do raio do cartão.
const faixa = (H, t, d, w = 7) => `<path d="M${CR + 1} ${CR + 8}a7 7 0 0 1 7 -7v${H - GAP - 2 * CR - 2}a7 7 0 0 1 -7 -7z" fill="${corEstado(d.estado, t)}" opacity="${opEstado(d.estado)}"/>`.replace('a7 7 0 0 1 7 -7v', `a7 7 0 0 1 7 -7h${w - 7}v`).replace('a7 7 0 0 1 -7 -7z', `h${7 - w}a7 7 0 0 1 -7 -7z`)

// ---- P5 (referência, igual à rodada 1).
function p5(W, t, d) {
  const H = 100, L = PAD + 8, R = W - PAD, narrow = W < 600
  let s = card(W, H, t) + faixa(H, t, d)
  const bloco = narrow ? 70 : 120
  s += text(L, 26, fit(d.titulo, 15, R - ICONS_W - L - bloco), 15, t.p, 'font-weight="600"')
  s += contexto(L - 6, 46, R - L - bloco, 12, t, d)
  s += barra(L, 56, R - L - bloco - 16, 4, d.pct, t)
  s += pilulas(L, 84, R - L - bloco - 16, t, d, 12, 20)
  const bx = R - ICONS_W - 6
  s += text(bx, 46, `${d.pct}%`, narrow ? 18 : 22, t.p, `font-weight="700" text-anchor="end" ${num}`)
  s += text(bx, 64, `${d.feitas} de ${d.total}`, 11, t.s, `text-anchor="end" ${num}`)
  s += text(bx, 80, narrow ? d.tempo : `${d.tempo} · ${d.toks}`, 11, t.s, `text-anchor="end" ${num}`)
  s += botoes(W, 20, t)
  return { H, s }
}

// ---- V1: anel no mostrador. O % dentro de um anel de progresso; a faixa fica; pílulas leves (só contorno).
function v1(W, t, d) {
  const H = 100, L = PAD + 8, R = W - PAD, narrow = W < 600
  let s = card(W, H, t) + faixa(H, t, d)
  const bloco = narrow ? 92 : 150
  s += text(L, 26, fit(d.titulo, 15, R - ICONS_W - L - bloco), 15, t.p, 'font-weight="600"')
  s += contexto(L - 6, 46, R - L - bloco, 12, t, d)
  s += barra(L, 56, R - L - bloco - 16, 4, d.pct, t)
  s += pilulas(L, 84, R - L - bloco - 16, t, d, 12, 20, true)
  // O mostrador: anel com o % dentro e, à direita dele, os pares.
  const cx = R - ICONS_W - (narrow ? 66 : 104), cy = 55
  s += anel(cx, cy, narrow ? 16 : 20, narrow ? 4 : 5, d.pct, t)
  s += text(cx, cy + 4.5, `${d.pct}%`, narrow ? 10 : 12, t.p, `font-weight="700" text-anchor="middle" ${num}`)
  const bx = R - ICONS_W - 6
  s += text(bx, 50, `${d.feitas} de ${d.total}`, 11, t.p, `text-anchor="end" font-weight="600" ${num}`)
  s += text(bx, 66, narrow ? d.tempo : `${d.tempo} · ${d.toks}`, 11, t.s, `text-anchor="end" ${num}`)
  s += botoes(W, 20, t)
  return { H, s }
}

// ---- V2: borda tingida e selo. A faixa vira a borda inteira do cartão na cor do estado (fina) e um
// selo com a palavra do estado antes do título; mostrador com % e mini-barra embaixo (sem barra longa).
function v2(W, t, d) {
  const H = 100, L = PAD, R = W - PAD, narrow = W < 600
  const cor = corEstado(d.estado, t)
  let s = card(W, H, t, cor, 1.5).replace(`stroke="${cor}"`, `stroke="${cor}" stroke-opacity="${d.estado === 'aguardando' ? '.45' : '.8'}"`)
  const palavra = ESTADOS.find(e => e[0] === d.estado)[1]
  const sw = tw(palavra, 10) + 16
  s += `<rect x="${L}" y="12" width="${sw}" height="18" rx="9" fill="${cor}" fill-opacity=".16"/>` + text(L + 8, 25, palavra, 10, cor, 'font-weight="700" letter-spacing=".3"')
  const bloco = narrow ? 80 : 130
  const tx = L + sw + 10
  s += text(tx, 26, fit(d.titulo, 15, R - ICONS_W - tx - bloco), 15, t.p, 'font-weight="600"')
  s += trilha(L, 48, R - L - bloco, 12, t, d)
  s += pilulas(L, 80, R - L - bloco - 10, t, d, 12, 20)
  const bx = R - ICONS_W - 6
  s += text(bx, 50, `${d.pct}%`, narrow ? 18 : 22, t.p, `font-weight="700" text-anchor="end" ${num}`)
  s += barra(bx - (narrow ? 60 : 100), 56, narrow ? 60 : 100, 4, d.pct, t)
  s += text(bx, 76, narrow ? `${d.feitas}/${d.total} · ${d.tempo}` : `${d.feitas} de ${d.total} · ${d.tempo} · ${d.toks}`, 11, t.s, `text-anchor="end" ${num}`)
  s += botoes(W, 20, t)
  return { H, s }
}

// ---- V3: faixa em gradiente e estado na linha da barra. A faixa se dissolve para dentro do cartão; a
// barra e os ícones de estado dividem uma linha; contexto como trilha; mostrador como na P5.
function v3(W, t, d) {
  const H = 96, L = PAD + 8, R = W - PAD, narrow = W < 600
  const cor = corEstado(d.estado, t)
  let s = card(W, H, t)
  s += `<defs><linearGradient id="gf" x1="0" x2="1"><stop offset="0" stop-color="${cor}" stop-opacity="${d.estado === 'aguardando' ? '.35' : '.75'}"/><stop offset="1" stop-color="${cor}" stop-opacity="0"/></linearGradient></defs>`
  s += `<path d="M${CR + 1} ${CR + 8}a7 7 0 0 1 7 -7h40v${H - GAP - 2 * CR - 2}h-40a7 7 0 0 1 -7 -7z" fill="url(#gf)"/>`
  const bloco = narrow ? 70 : 120
  s += text(L, 28, fit(d.titulo, 15, R - ICONS_W - L - bloco), 15, t.p, 'font-weight="600"')
  s += trilha(L, 48, R - L - bloco, 11.5, t, d)
  const bw = narrow ? R - L - bloco - 16 - 4 * 30 : Math.min(360, R - L - bloco - 16 - 4 * 38 - 10)
  s += barra(L, 70, bw, 5, d.pct, t)
  s += faixaStatus(L + bw + 14, 76, t, d, 12)
  const bx = R - ICONS_W - 6
  s += text(bx, 48, `${d.pct}%`, narrow ? 18 : 22, t.p, `font-weight="700" text-anchor="end" ${num}`)
  s += text(bx, 66, `${d.feitas} de ${d.total}`, 11, t.s, `text-anchor="end" ${num}`)
  s += text(bx, 80, narrow ? d.tempo : `${d.tempo} · ${d.toks}`, 11, t.s, `text-anchor="end" ${num}`)
  s += botoes(W, 20, t)
  return { H, s }
}

// ---- V4: respiro. A P5 com mais espaço: faixa fina de altura inteira, título maior, uma linha por
// camada, pílulas espaçadas, números tabulares; o mostrador com o % maior.
function v4(W, t, d) {
  const H = 116, L = PAD + 8, R = W - PAD, narrow = W < 600
  let s = card(W, H, t) + faixa(H, t, d, 5)
  const bloco = narrow ? 76 : 130
  s += text(L, 30, fit(d.titulo, 16, R - ICONS_W - L - bloco), 16, t.p, 'font-weight="600"')
  s += contexto(L - 6, 52, R - L - bloco, 12, t, d)
  s += barra(L, 66, R - L - bloco - 20, 4, d.pct, t)
  s += pilulas(L, 98, R - L - bloco - 20, t, d, 12, 22)
  const bx = R - ICONS_W - 6
  s += text(bx, 54, `${d.pct}%`, narrow ? 20 : 26, t.p, `font-weight="700" text-anchor="end" ${num}`)
  s += text(bx, 74, `${d.feitas} de ${d.total}`, 12, t.s, `text-anchor="end" ${num}`)
  s += text(bx, 92, narrow ? d.tempo : `${d.tempo} · ${d.toks}`, 12, t.s, `text-anchor="end" ${num}`)
  s += botoes(W, 22, t)
  return { H, s }
}

// ---- V5: duas linhas (72 px). Faixa; linha 1: título + estado em números; linha 2: trilha + barra +
// mostrador pequeno; devolve 28 px à árvore.
function v5(W, t, d) {
  const H = 72, L = PAD + 8, R = W - PAD, narrow = W < 600
  let s = card(W, H, t) + faixa(H, t, d, 6)
  const bloco = narrow ? 64 : 150
  const chipsW = narrow ? 4 * 30 : 4 * 38
  s += text(L, 26, fit(d.titulo, 14, R - ICONS_W - L - chipsW - 20), 14, t.p, 'font-weight="600"')
  s += faixaStatus(R - ICONS_W - chipsW - 4, 26, t, d, 11)
  const bw = narrow ? 110 : 200
  s += trilha(L, 50, R - L - bloco - bw - 24, 11, t, d)
  s += barra(R - ICONS_W - bloco - bw - 8, 46, bw, 4, d.pct, t)
  const bx = R - ICONS_W - 6
  s += text(bx, 52, narrow ? `${d.pct}%` : `${d.pct}%  ·  ${d.feitas}/${d.total}  ·  ${d.tempo}`, narrow ? 14 : 13, t.p, `font-weight="700" text-anchor="end" ${num}`)
  s += botoes(W, 22, t)
  return { H, s }
}

const PROPOSTAS = [
  ['p5', 'P5 · Faixa de estado e bloco de números (referência)', 'A escolhida na rodada 1, sem mudança: faixa à esquerda com a cor do estado geral; % grande à direita com os pares embaixo; barra e pílulas.', p5],
  ['v1-anel', 'V1 · Anel no mostrador, pílulas leves', 'O % entra num anel de progresso; as pílulas viram só contorno (menos tinta); a barra longa fica.', v1],
  ['v2-borda-selo', 'V2 · Borda tingida e selo do estado', 'A faixa vira a borda inteira do cartão, fina, na cor do estado, e um selo com a palavra do estado; trilha repo / branch; mini-barra sob o %.', v2],
  ['v3-gradiente', 'V3 · Faixa em gradiente, estado na linha da barra', 'A faixa se dissolve para dentro do cartão; barra e ícones de estado na mesma linha; trilha discreta.', v3],
  ['v4-respiro', 'V4 · Respiro (116 px)', 'A P5 com mais ar: faixa fina de altura inteira, título em 16 px, uma linha por camada, % em 26 px, números tabulares.', v4],
  ['v5-duas-linhas', 'V5 · Duas linhas (72 px)', 'A P5 comprimida: título e estado na primeira linha; trilha, barra e mostrador na segunda; devolve 28 px à árvore.', v5],
]
const LARGURAS = [['largo', 1200], ['60col', 432]]
const svg = (W, H, inner, t, id = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ${FONT}><rect width="${W}" height="${H}" fill="${t.page}"/>${inner}</svg>`
// Ids de gradiente únicos por SVG inline (vários na mesma página).
let seq = 0
const unico = s => { seq++; return s.replace(/id="gf"/g, `id="gf${seq}"`).replace(/url\(#gf\)/g, `url(#gf${seq})`) }

let html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cabeçalho do painel: propostas v2 (a partir da P5)</title>
<style>body{margin:0;padding:24px;font:14px/1.5 ui-sans-serif,system-ui,'Segoe UI',sans-serif;background:#111;color:#ddd}h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 2px;color:#fff}h3{font-size:12px;color:#999;margin:14px 0 6px;font-weight:600}p{margin:0 0 10px;color:#aaa;max-width:1200px}.pair{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px}.lab{font-size:11px;color:#888;margin:0 0 2px}.m svg{display:block;border-radius:8px;max-width:100%;height:auto}.sep{border:0;border-top:1px solid #333;margin:24px 0}.estados{display:flex;gap:12px;flex-wrap:wrap}.estados .m{width:360px}.rec{border-left:3px solid #97c459;padding-left:12px}</style></head><body>
<h1>Cabeçalho do painel: propostas v2, a partir da P5</h1><p>Mesmos dados do print atual. A P5 é a referência; as cinco variações mantêm o princípio dela (faixa de estado à esquerda; bloco de números à direita com o % em destaque). Cada uma em pane largo (1200 px) e 60 colunas (432 px), nos temas claro e escuro. O navegador pinta com outra fonte; a referência final é o app.</p>`

for (const [id, nome, desc, fn] of PROPOSTAS) {
  html += `<hr class="sep"><h2${id === 'v4-respiro' ? ' class="rec"' : ''}>${nome}</h2><p>${desc}</p>`
  for (const [lnome, W] of LARGURAS) {
    html += `<div class="pair">`
    for (const [tnome, t] of Object.entries(TEMAS)) {
      const { H, s } = fn(W, t, D)
      const out = svg(W, H, s, t)
      writeFileSync(join(aqui, `${id}-${tnome}-${lnome}.svg`), out)
      html += `<div class="m" style="width:${Math.min(W, 1200)}px"><div class="lab">${tnome} · ${lnome}</div>${unico(out)}</div>`
    }
    html += `</div>`
  }
  // As cores da faixa por estado geral: na referência e na recomendada.
  if (id === 'p5' || id === 'v4-respiro') {
    for (const [tnome, t] of Object.entries(TEMAS)) {
      html += `<h3>A faixa por estado geral · ${tnome}</h3><div class="estados">`
      for (const [estado, palavra] of ESTADOS) {
        const d = { ...D, estado, titulo: `${palavra[0].toUpperCase()}${palavra.slice(1)}: ${D.titulo}` }
        const { H, s } = fn(432, t, d)
        html += `<div class="m"><div class="lab">${palavra}</div>${unico(svg(432, H, s, t))}</div>`
      }
      html += `</div>`
    }
  }
}
html += `<hr class="sep"><h2>Recomendação</h2><p>V4 (respiro): é a P5 que ele escolheu, com a hierarquia mais nítida (título, contexto, barra, estado, cada um na sua linha) e o mostrador mais forte; custa 16 px a mais de altura. Se a altura importar, V5 (duas linhas) é a mesma ideia comprimida.</p></body></html>`
writeFileSync(join(aqui, 'propostas-cabecalho-v2.html'), html)
console.log(`gerados: ${PROPOSTAS.length} propostas × 2 temas × 2 larguras, mais as faixas por estado, em ${aqui}`)
