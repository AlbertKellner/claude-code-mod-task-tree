// Gera os mockups SVG das propostas de cabeçalho (fora do repositório) e o index.html.
// Uso: node gerar.mjs  (na própria pasta). Mesmos dados do print 6; temas claro/escuro; larguras
// 1200 (pane largo) e 432 (60 colunas: floor(60 × 7,2)). Só desenho: nada do mod é importado.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))

// Os dados do print 6.
const D = {
  titulo: 'Explicar as opções para os PRs antigos',
  feitas: 15, total: 19, pct: 79, tempo: '21:50', toks: '79 toks/s',
  repo: 'claude-code-mod-task-tree', branch: 'feat/filha-completa-na-orquestradora',
  chips: [['current', 1, 'em andamento'], ['open', 3, 'pendentes'], ['interrupted', 1, 'interrompida'], ['running', 1, 'sessão ativa']],
}

// A paleta do mod (draw/svg.ts, LIGHT e DARK), com a página do app atrás do cartão.
const TEMAS = {
  claro: { page: '#fcfcfb', cd: '#f9f9f7', cs: '#e1e1df', p: '#2c2c2a', s: '#5f5e5a', am: '#ba7517', gr: '#639922', gy: '#888780', bl: '#378add', rd: '#e24b4a', tr: 'rgba(136,135,128,.25)', btn: '#2c2c2a', btnt: '#f9f9f7' },
  escuro: { page: '#1a1a19', cd: '#20201f', cs: '#373736', p: '#e8e6dc', s: '#b4b2a9', am: '#ef9f27', gr: '#97c459', gy: '#9c9a92', bl: '#85b7eb', rd: '#f09595', tr: 'rgba(136,135,128,.25)', btn: '#e8e6dc', btnt: '#20201f' },
}
const PAD = 14.5, CR = 2.5, GAP = 8, ICONS_W = 72
const FONT = `font-family="ui-sans-serif, system-ui, 'Segoe UI', sans-serif"`

// Largura estimada do texto (o mod também estima: sem fonte externa).
const tw = (s, size) => s.length * size * 0.54
const fit = (s, size, max) => {
  if (tw(s, size) <= max) return s
  let n = s.length
  while (n > 1 && tw(s.slice(0, n) + '…', size) > max) n--
  return s.slice(0, n).trimEnd() + '…'
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const text = (x, y, s, size, fill, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`
const num = 'font-variant-numeric="tabular-nums"'

// Peças compartilhadas.
const card = (W, H, t) => `<rect x="${CR}" y="${CR}" width="${W - 2 * CR}" height="${H - GAP - 2 * CR}" rx="8" fill="${t.cd}" stroke="${t.cs}"/>`
const botoes = (W, y, t) => {
  const x = W - PAD - 58
  return `<rect x="${x}" y="${y - 12}" width="26" height="24" rx="6" fill="${t.btn}"/><text x="${x + 13}" y="${y + 5}" font-size="14" fill="${t.btnt}" text-anchor="middle">≡</text>` +
    `<text x="${x + 45}" y="${y + 5}" font-size="14" fill="${t.s}" text-anchor="middle" opacity=".7">▤</text>`
}
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
// Repositório e branch numa linha; sem espaço, só a branch; sem espaço para ela, nada.
const contexto = (x, y, max, size, t, d, extra = '') => {
  const full = `${d.repo}    ${d.branch}`
  let s = ''
  if (tw(full, size) + 36 <= max) s = repoIcone(x + 6, y - 4, t) + text(x + 16, y, d.repo, size, t.s) + branchIcone(x + 16 + tw(d.repo, size) + 16, y - 4, t) + text(x + 16 + tw(d.repo, size) + 28, y, d.branch, size, t.s)
  else if (tw(d.branch, size) + 16 <= max) s = branchIcone(x + 6, y - 4, t) + text(x + 16, y, fit(d.branch, size, max - 16), size, t.s)
  return s + (extra && s ? text(x + 16 + Math.min(tw(full, size) + 30, max), y, extra, size, t.s, 'opacity=".6"') : '')
}
const barra = (x, y, w, h, pct, t, cor = t.gr) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${t.tr}"/><rect x="${x}" y="${y}" width="${Math.max(h, (w * pct) / 100)}" height="${h}" rx="${h / 2}" fill="${cor}"/>`
const anel = (cx, cy, r, sw, pct, t, label = true, size = 11) => {
  const c = 2 * Math.PI * r
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${t.tr}" stroke-width="${sw}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${t.gr}" stroke-width="${sw}" stroke-dasharray="${(c * pct) / 100} ${c}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>` +
    (label ? `<text x="${cx}" y="${cy + size * 0.36}" font-size="${size}" font-weight="700" fill="${t.p}" text-anchor="middle" ${num}>${pct}%</text>` : '')
}
// Chips como hoje: ícone + texto (ou só o número, apertado).
const chipsLinha = (x, y, max, t, d, size = 12) => {
  const wide = d.chips.reduce((w, c) => w + 32 + tw(`${c[1]} ${c[2]}`, size), -16) <= max
  let cx = x, out = ''
  for (const [tone, n, palavra] of d.chips) {
    const s = wide ? `${n} ${palavra}` : `${n}`
    const w = 16 + tw(s, size)
    if (cx + w > x + max) break
    out += icone(tone, cx + 5, y - 4, t) + text(cx + 15, y, s, size, t.s)
    cx += w + 16
  }
  return out
}
// Chips em pílulas coloridas (fundo na cor do estado, bem fraco).
const pilulas = (x, y, max, t, d, size = 12, h = 22) => {
  const wide = d.chips.reduce((w, c) => w + 44 + tw(`${c[1]} ${c[2]}`, size), -8) <= max
  let cx = x, out = ''
  for (const [tone, n, palavra] of d.chips) {
    const s = wide ? `${n} ${palavra}` : `${n}`
    const w = 30 + tw(s, size)
    if (cx + w > x + max) break
    const cor = corDo(tone, t)
    out += `<rect x="${cx}" y="${y - h + 6}" width="${w}" height="${h}" rx="${h / 2}" fill="${cor}" fill-opacity=".13"/>` + icone(tone, cx + 13, y - 4, t) + text(cx + 23, y, s, size, t.p)
    cx += w + 8
  }
  return out
}
const faixaStatus = (x, y, t, d, size = 12) => {
  // Só ícone + número, colorido; as palavras ficam no tooltip.
  let cx = x, out = ''
  for (const [tone, n] of d.chips) { out += icone(tone, cx + 5, y - 4, t) + text(cx + 15, y, String(n), size, corDo(tone, t), `font-weight="600" ${num}`); cx += 38 }
  return out
}

// ---- Atual (recriado a partir do headerSvg, para comparar).
function atual(W, t, d) {
  const H = 100, L = PAD, R = W - PAD
  const score = `${d.feitas} de ${d.total} · ${d.pct}% · ${d.tempo}`
  let s = card(W, H, t)
  s += text(L, 22, fit(d.titulo, 14, R - ICONS_W - L), 14, t.p, 'font-weight="600"')
  s += text(L, 40, score, 12, t.s, num) + text(L + tw(score + ' ', 12), 40, `· ${d.toks}`, 12, t.s, `${num} opacity=".45"`)
  s += contexto(L + tw(`${score} · ${d.toks} `, 12) + 10, 40, R - (L + tw(`${score} · ${d.toks} `, 12) + 10), 12, t, d)
  s += barra(L, 50, R - L, 4, d.pct, t)
  s += chipsLinha(L, 76, R - L, t, d)
  s += botoes(W, 20, t)
  return { H, s }
}

// ---- P1: anel de progresso + título; contexto discreto; chips em pílulas.
function p1(W, t, d) {
  const H = 100, L = PAD, R = W - PAD, narrow = W < 600
  let s = card(W, H, t)
  if (!narrow) {
    s += anel(L + 20, 40, 17, 5, d.pct, t)
    const tx = L + 50
    const metricas = `${d.feitas} de ${d.total} · ${d.tempo} · ${d.toks}`
    s += text(tx, 29, fit(d.titulo, 14, R - ICONS_W - tx - tw(metricas, 12) - 16), 14, t.p, 'font-weight="600"')
    s += text(R - ICONS_W, 29, metricas, 12, t.s, `${num} text-anchor="end"`)
    s += contexto(tx - 6, 50, R - tx, 12, t, d)
    s += pilulas(tx, 82, R - tx, t, d)
  } else {
    s += anel(L + 16, 34, 13, 4, d.pct, t, true, 9)
    const tx = L + 40
    s += text(tx, 26, fit(d.titulo, 14, R - ICONS_W - tx), 14, t.p, 'font-weight="600"')
    s += text(tx, 44, `${d.feitas} de ${d.total} · ${d.tempo} · ${d.toks}`, 11, t.s, num)
    s += contexto(L - 6, 62, R - L, 11, t, d)
    s += pilulas(L, 86, R - L, t, d, 11, 20)
  }
  s += botoes(W, 20, t)
  return { H, s }
}

// ---- P2: a barra é o estado: segmentos coloridos; legenda embaixo; métricas à direita.
function p2(W, t, d) {
  const H = 92, L = PAD, R = W - PAD, narrow = W < 600
  let s = card(W, H, t)
  const direita = `${d.feitas}/${d.total} · ${d.tempo}`
  s += text(L, 24, fit(d.titulo, 14, R - ICONS_W - L - tw(direita, 12) - 16), 14, t.p, 'font-weight="600"')
  s += text(R - ICONS_W, 24, direita, 12, t.s, `${num} text-anchor="end"`)
  s += contexto(L - 6, 42, R - L - (narrow ? 0 : 90), 12, t, d, narrow ? '' : `· ${d.toks}`)
  // Barra segmentada: concluídas (verde), em andamento (âmbar), pendentes (trilho); a interrompida fica fora do total.
  const w = R - L, un = w / d.total
  const andamento = d.chips.find(c => c[0] === 'current')?.[1] ?? 0
  s += `<rect x="${L}" y="54" width="${w}" height="6" rx="3" fill="${t.tr}"/>`
  s += `<rect x="${L}" y="54" width="${un * d.feitas}" height="6" rx="3" fill="${t.gr}"/>`
  s += `<rect x="${L + un * d.feitas - 3}" y="54" width="${un * andamento + 3}" height="6" rx="3" fill="${t.am}"/>`
  // Legenda: pontos na cor de cada segmento, com as palavras.
  const itens = [[t.gr, `${d.feitas} concluídas`], ...d.chips.map(([tone, n, p]) => [corDo(tone, t), `${n} ${p}`])]
  let cx = L
  for (const [cor, label] of itens) {
    const lab = narrow ? label.split(' ')[0] : label
    const wl = 14 + tw(lab, 12)
    if (cx + wl > R) break
    s += `<circle cx="${cx + 4}" cy="74" r="3.5" fill="${cor}"/>` + text(cx + 13, 78, lab, 12, t.s)
    cx += wl + 14
  }
  s += botoes(W, 20, t)
  return { H, s }
}

// ---- P3: métricas em pílulas (progresso com mini-barra, tempo, ritmo); faixa de estado só com números.
function p3(W, t, d) {
  const H = 100, L = PAD, R = W - PAD, narrow = W < 600
  let s = card(W, H, t)
  s += text(L, 24, fit(d.titulo, 14, R - ICONS_W - L), 14, t.p, 'font-weight="600"')
  // Pílulas de métrica.
  const pil = (x, y, w, inner) => `<rect x="${x}" y="${y - 15}" width="${w}" height="22" rx="11" fill="${t.gy}" fill-opacity=".12"/>` + inner
  let x = L
  const w1 = narrow ? 112 : 150
  s += pil(x, 46, w1, barra(x + 10, 43, narrow ? 36 : 60, 4, d.pct, t) + text(x + (narrow ? 52 : 78), 50, `${d.pct}% · ${d.feitas}/${d.total}`, 11, t.p, `font-weight="600" ${num}`))
  x += w1 + 8
  const w2 = 14 + tw(`◷ ${d.tempo}`, 11) + 6
  s += pil(x, 46, w2, text(x + 10, 50, `◷ ${d.tempo}`, 11, t.p, num))
  x += w2 + 8
  const w3 = 14 + tw(`↗ ${d.toks}`, 11) + 6
  s += pil(x, 46, w3, text(x + 10, 50, `↗ ${d.toks}`, 11, t.s, num))
  s += contexto(L - 6, 70, R - L, 11, t, d)
  s += faixaStatus(L, 90, t, d)
  s += text(L + 4 * 38 + 4, 90, narrow ? '' : 'em andamento · pendentes · interrompida · sessão ativa', 10, t.s, 'opacity=".55"')
  s += botoes(W, 20, t)
  return { H, s }
}

// ---- P4: compacto (56 px): tudo numa linha, contexto numa segunda linha fina, barra no rodapé.
function p4(W, t, d) {
  const H = 56, L = PAD, R = W - PAD, narrow = W < 600
  let s = `<rect x="${CR}" y="${CR}" width="${W - 2 * CR}" height="${H - GAP - 2 * CR}" rx="8" fill="${t.cd}" stroke="${t.cs}"/>`
  s += anel(L + 9, 21, 7, 3, d.pct, t, false)
  const direita = narrow ? `${d.feitas}/${d.total}` : `${d.feitas}/${d.total} · ${d.tempo}`
  const chipsW = narrow ? 4 * 30 : 4 * 38
  const tx = L + 24
  s += text(tx, 26, fit(d.titulo, 13, R - ICONS_W - tx - chipsW - tw(direita, 11) - 24), 13, t.p, 'font-weight="600"')
  s += faixaStatus(R - ICONS_W - tw(direita, 11) - 16 - chipsW, 26, t, d, 11)
  s += text(R - ICONS_W, 26, direita, 11, t.s, `${num} text-anchor="end"`)
  s += contexto(tx - 6, 41, R - tx - 80, 10.5, t, d, narrow ? '' : `· ${d.toks}`)
  s += barra(L, 44, R - L, 3, d.pct, t)
  s += botoes(W, 22, t)
  return { H, s }
}

// ---- P5: faixa de estado à esquerda + bloco de números à direita (painel).
function p5(W, t, d) {
  const H = 100, L = PAD + 8, R = W - PAD, narrow = W < 600
  let s = card(W, H, t)
  // A faixa: âmbar com algo em andamento; verde com tudo concluído; cinza parado.
  s += `<path d="M${CR + 1} ${CR + 8}a7 7 0 0 1 7 -7h0v${H - GAP - 2 * CR - 2}h0a7 7 0 0 1 -7 -7z" fill="${t.am}"/>`
  const bloco = narrow ? 70 : 120
  s += text(L, 26, fit(d.titulo, 15, R - ICONS_W - L - bloco), 15, t.p, 'font-weight="600"')
  s += contexto(L - 6, 46, R - L - bloco, 12, t, d)
  s += barra(L, 56, R - L - bloco - 16, 4, d.pct, t)
  s += pilulas(L, 84, R - L - bloco - 16, t, d, 12, 20)
  // O bloco de números: % grande, abaixo os pares.
  const bx = R - ICONS_W - 6
  s += text(bx, 46, `${d.pct}%`, narrow ? 18 : 22, t.p, `font-weight="700" text-anchor="end" ${num}`)
  s += text(bx, 64, `${d.feitas} de ${d.total}`, 11, t.s, `text-anchor="end" ${num}`)
  s += text(bx, 80, narrow ? d.tempo : `${d.tempo} · ${d.toks}`, 11, t.s, `text-anchor="end" ${num}`)
  s += botoes(W, 20, t)
  return { H, s }
}

const PROPOSTAS = [
  ['atual', 'Atual (recriado)', atual],
  ['p1-anel', 'P1 · Anel de progresso e pílulas', p1],
  ['p2-barra', 'P2 · A barra é o estado', p2],
  ['p3-pilulas', 'P3 · Métricas em pílulas, estado só em números', p3],
  ['p4-compacto', 'P4 · Compacto, uma linha (56 px)', p4],
  ['p5-faixa', 'P5 · Faixa de estado e bloco de números', p5],
]
const LARGURAS = [['largo', 1200], ['60col', 432]]

const svg = (W, H, inner, t) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ${FONT}><rect width="${W}" height="${H}" fill="${t.page}"/>${inner}</svg>`

let html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cabeçalho do painel: propostas</title>
<style>body{margin:0;padding:24px;font:14px/1.5 ui-sans-serif,system-ui,'Segoe UI',sans-serif;background:#111;color:#ddd}h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 6px;color:#fff}p{margin:0 0 10px;color:#aaa;max-width:1200px}.row{display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:8px}.pair{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}.lab{font-size:11px;color:#888;margin:0 0 2px}img{display:block;border-radius:8px;max-width:100%;height:auto}.sep{border:0;border-top:1px solid #333;margin:24px 0}</style></head><body>
<h1>Cabeçalho do painel de tarefas: propostas</h1><p>Mesmos dados do print atual. Cada proposta em pane largo (1200 px) e em 60 colunas (432 px), nos temas claro e escuro. O desenho real é feito pelo mod com a mesma estimativa de largura de texto; o navegador pinta com outra fonte, então a referência final é o app.</p>`

for (const [id, nome, fn] of PROPOSTAS) {
  html += `<hr class="sep"><h2>${nome}</h2>`
  for (const [lnome, W] of LARGURAS) {
    html += `<div class="row"><div class="pair">`
    for (const [tnome, t] of Object.entries(TEMAS)) {
      const { H, s } = fn(W, t, D)
      const file = `${id}-${tnome}-${lnome}.svg`
      writeFileSync(join(aqui, file), svg(W, H, s, t))
      html += `<div><div class="lab">${tnome} · ${lnome}</div><img src="${file}" width="${Math.min(W, 1200)}" height="${H}" alt="${nome}, ${tnome}, ${lnome}"></div>`
    }
    html += `</div></div>`
  }
}
html += `</body></html>`
writeFileSync(join(aqui, 'index.html'), html)
console.log(`gerados: ${PROPOSTAS.length} propostas × 2 temas × 2 larguras em ${aqui}`)
