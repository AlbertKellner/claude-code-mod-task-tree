// Selo dos testes e do kit: o que cada teste coberto por regra afirma fica registrado em
// regras/selos.json (hash do corpo normalizado e número de asserções). Um teste existente só muda
// com selo novo: de decisão do usuário (cenário com "Reescrito:"), de refatoração (sem perder
// asserções) ou de teste novo. Ver regras/README.md.
//
// Uso:
//   node scripts/selos.mjs                                  confere (etapa "selos" do check)
//   node scripts/selos.mjs --selar "<arquivo>::<nome>" --tipo decisao|refatoracao|novo --motivo "…"
//   node scripts/selos.mjs --kit <arquivo> --tipo … --motivo "…"
//   node scripts/selos.mjs --remover "<arquivo>::<nome>" --tipo decisao --motivo "…"
//   node scripts/selos.mjs --novos --motivo "…"             sela como "novo" todo teste e kit sem selo
// --raiz <pasta>: onde estão os arquivos (padrão: o repositório); --repo <pasta>: o git de HEAD
// (padrão: a própria raiz); --base <ref>: compara com esse commit em vez de HEAD (a CI, a base do PR).
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Chamadas que afirmam: expect e os helpers de leitura que falham com o painel em texto.
export const ASSERCOES = ['expect', 'esperarEstado', 'esperarCarta', 'linha', 'antes']
const SELOS = 'regras/selos.json'
const TIPOS = ['decisao', 'refatoracao', 'novo']

const impressora = ts.createPrinter({ removeComments: true })
const hash = texto => createHash('sha256').update(texto).digest('hex').slice(0, 16)
const barra = p => p.replace(/\\/g, '/')
export const hoje = () => new Date().toLocaleDateString('sv-SE')

const arquivos = (dir, filtro) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap(f => {
        const p = join(dir, f)
        return statSync(p).isDirectory() ? arquivos(p, filtro) : filtro(f) ? [p] : []
      })
    : []

// Os nomes que uma declaração de topo cria (const A, function f, class C).
function nomesDeclarados(st) {
  if (ts.isVariableStatement(st)) return st.declarationList.declarations.flatMap(d => (ts.isIdentifier(d.name) ? [d.name.text] : []))
  if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) && st.name) return [st.name.text]
  return []
}
const ehTeste = st =>
  ts.isExpressionStatement(st) && ts.isCallExpression(st.expression) && ts.isIdentifier(st.expression.expression) && st.expression.expression.text === 'test'

// Os testes de um arquivo: nome, regras citadas no "// Regra:" acima, hash e asserções. O hash cobre o
// corpo reimpresso sem comentários e as declarações de topo que ele usa (um plano A mudado muda o selo).
export function testesDe(caminho, texto) {
  const sf = ts.createSourceFile(caminho, texto, ts.ScriptTarget.Latest, true)
  const linhas = texto.split(/\r?\n/)
  const topo = sf.statements.filter(st => !ts.isImportDeclaration(st) && !ehTeste(st)).map(st => ({ nomes: nomesDeclarados(st), texto: impressora.printNode(ts.EmitHint.Unspecified, st, sf) }))
  const saida = []
  for (const st of sf.statements) {
    if (!ehTeste(st)) continue
    const args = st.expression.arguments
    const nome = args[0]
    const corpo = args[args.length - 1]
    if (!nome || !ts.isStringLiteralLike(nome) || !corpo) continue
    const usados = new Set()
    let assercoes = 0
    const visitar = n => {
      if (ts.isIdentifier(n)) usados.add(n.text)
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ASSERCOES.includes(n.expression.text)) assercoes++
      ts.forEachChild(n, visitar)
    }
    visitar(corpo)
    const corpoTexto = impressora.printNode(ts.EmitHint.Unspecified, corpo, sf)
    const decls = topo.filter(d => d.nomes.some(n => usados.has(n))).map(d => d.texto)
    const linha = sf.getLineAndCharacterOfPosition(st.getStart(sf)).line
    const m = /^\s*\/\/ Regra: (.+)$/.exec(linhas[linha - 1] ?? '')
    const regras = m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : []
    saida.push({ nome: nome.text, regras, corpo: corpoTexto, hash: hash([corpoTexto, ...decls].join('\n')), assercoes })
  }
  return saida
}

// O arquivo do kit inteiro, reimpresso sem comentários.
export function hashDoKit(caminho, texto) {
  const sf = ts.createSourceFile(caminho, texto, ts.ScriptTarget.Latest, true)
  return hash(impressora.printFile(sf))
}

// O catálogo: estado e datas de "Reescrito:" de cada regra.
export function catalogo(raiz) {
  const regras = new Map()
  const pasta = join(raiz, 'regras')
  if (!existsSync(pasta)) return regras
  for (const f of readdirSync(pasta).filter(f => f.endsWith('.md') && f !== 'README.md')) {
    let atual
    for (const l of readFileSync(join(pasta, f), 'utf8').split(/\r?\n/)) {
      const id = /^### (\S+)\s*$/.exec(l)
      if (id) {
        atual = { estado: undefined, reescrito: [] }
        regras.set(id[1], atual)
        continue
      }
      if (!atual) continue
      const e = /^Estado: (coberto|pendente|checklist)\b/.exec(l)
      if (e && atual.estado === undefined) atual.estado = e[1]
      const r = /^Reescrito: (\d{4}-\d{2}-\d{2}),/.exec(l)
      if (r) atual.reescrito.push(r[1])
    }
  }
  return regras
}

// Tudo o que se sela, lido dos arquivos: testes cobertos por regra e o kit.
export function extrair(raiz) {
  const regras = catalogo(raiz)
  const testes = {}
  const pastaTestes = join(raiz, 'task-tree', 'tests')
  for (const p of arquivos(pastaTestes, f => /\.test\.tsx?$/.test(f)).filter(p => !barra(p).includes('/kit/'))) {
    const rel = barra(relative(raiz, p))
    for (const t of testesDe(p, readFileSync(p, 'utf8'))) {
      if (!t.regras.some(id => regras.get(id)?.estado === 'coberto')) continue
      testes[`${rel}::${t.nome}`] = t
    }
  }
  const kit = {}
  for (const p of arquivos(join(pastaTestes, 'kit'), f => /\.tsx?$/.test(f))) kit[barra(relative(raiz, p))] = hashDoKit(p, readFileSync(p, 'utf8'))
  return { testes, kit, regras }
}

const vazio = () => ({ testes: {}, kit: {}, golden: {} })
const lerSelos = raiz => ({ ...vazio(), ...(existsSync(join(raiz, SELOS)) ? JSON.parse(readFileSync(join(raiz, SELOS), 'utf8')) : {}) })
// Os selos de um commit (HEAD por padrão; na CI, a base do PR).
export function selosDeHead(repo, ref = 'HEAD') {
  const r = spawnSync('git', ['-C', repo, 'show', `${ref}:${SELOS}`], { encoding: 'utf8' })
  return { ...vazio(), ...(r.status === 0 ? JSON.parse(r.stdout) : {}) }
}
const gravar = (raiz, selos) => {
  const ordenado = o => Object.fromEntries(Object.keys(o ?? {}).sort().map(k => [k, o[k]]))
  writeFileSync(join(raiz, SELOS), `${JSON.stringify({ testes: ordenado(selos.testes), kit: ordenado(selos.kit), golden: ordenado(selos.golden) }, null, 2)}\n`)
}

// ---- Golden do SVG: o desenho de cada cenário, aprovado pelo usuário no app (tests/golden/svg.ts).
export const GOLDEN = 'task-tree/tests/golden/svg.ts'
const CABECA_GOLDEN = '// Gerado por npm run golden:aprovar, com a aprovação do usuário no app; não editar à mão.\nexport const GOLDEN: Record<string, unknown> = '
// Os cenários gravados: o JSON depois de "GOLDEN ... = ".
export function lerGolden(raiz) {
  const p = join(raiz, GOLDEN)
  if (!existsSync(p)) return {}
  const t = readFileSync(p, 'utf8')
  return JSON.parse(t.slice(t.indexOf('= ', t.indexOf('GOLDEN')) + 2))
}
export const hashGolden = valor => hash(JSON.stringify(valor))
// O motivo de uma aprovação traz a data (AAAA-MM-DD) e as palavras do usuário entre aspas.
export const motivoValido = m => typeof m === 'string' && /\d{4}-\d{2}-\d{2}/.test(m) && /["“][^"”]+["”]/.test(m)
// Grava os cenários aprovados e o selo de cada um.
export function aprovarGolden(raiz, novos, motivo) {
  if (!motivoValido(motivo)) throw new Error('--motivo precisa das palavras do usuário entre aspas e da data (AAAA-MM-DD) da validação no app')
  const golden = { ...lerGolden(raiz), ...novos }
  const ordenado = Object.fromEntries(Object.keys(golden).sort().map(k => [k, golden[k]]))
  writeFileSync(join(raiz, GOLDEN), `${CABECA_GOLDEN}${JSON.stringify(ordenado)}\n`)
  const selos = lerSelos(raiz)
  for (const [cen, valor] of Object.entries(novos)) selos.golden[cen] = { hash: hashGolden(valor), data: hoje(), motivo }
  gravar(raiz, selos)
  return Object.keys(novos)
}
// A etapa regressao aceita a falha do teste de golden de HEAD só com o desenho aprovado hoje (hash
// novo). Com `data` undefined (a CI, contra a base do PR), basta o selo ter mudado no PR.
export function liberaGolden(selos, head, cenario, data) {
  const s = selos.golden?.[cenario]
  return s !== undefined && (data === undefined || s.data === data) && s.hash !== head.golden?.[cenario]?.hash
}
// O mesmo para um teste: selo de decisão do usuário com hash novo, de hoje (ou, na CI, trazido no PR).
export function liberaTeste(s, h, data) {
  return s !== undefined && s.tipo === 'decisao' && (data === undefined || s.data === data) && (h === undefined || s.hash !== h.hash)
}

// A conferência: devolve a lista de problemas.
export function conferir(raiz, repo = raiz, base = 'HEAD') {
  const { testes, kit } = extrair(raiz)
  const selos = lerSelos(raiz)
  const head = selosDeHead(repo, base)
  const problemas = []
  for (const [chave, t] of Object.entries(testes)) {
    const s = selos.testes[chave]
    if (!s) problemas.push(`teste novo sem selo: ${chave} (npm run regras:selar -- "${chave}" --tipo novo --motivo "…")`)
    else if (s.hash !== t.hash) problemas.push(`o teste mudou sem selo novo: ${chave}`)
  }
  for (const chave of Object.keys(selos.testes)) if (!testes[chave]) problemas.push(`teste selado sumiu: ${chave}`)
  for (const [arq, h] of Object.entries(kit)) {
    const s = selos.kit[arq]
    if (!s) problemas.push(`arquivo do kit sem selo: ${arq}`)
    else if (s.hash !== h) problemas.push(`o kit mudou sem selo novo: ${arq}`)
  }
  for (const arq of Object.keys(selos.kit)) if (!kit[arq]) problemas.push(`arquivo do kit selado sumiu: ${arq}`)
  for (const [chave, s] of Object.entries(selos.testes)) {
    const antes = head.testes[chave]
    if (antes && (s.tipo === 'refatoracao' || s.tipo === 'novo') && s.assercoes < antes.assercoes)
      problemas.push(`menos asserções sem decisão: ${chave} (${antes.assercoes} → ${s.assercoes})`)
  }
  const golden = lerGolden(raiz)
  for (const [cen, valor] of Object.entries(golden)) {
    const s = selos.golden[cen]
    if (!s) problemas.push(`desenho do golden sem selo: ${cen} (npm run golden:aprovar, só com a validação do usuário no app)`)
    else if (s.hash !== hashGolden(valor)) problemas.push(`o desenho do golden mudou sem aprovação: ${cen}`)
  }
  for (const cen of Object.keys(selos.golden)) if (!(cen in golden)) problemas.push(`selo de golden sem cenário: ${cen}`)
  return problemas
}

// Exige, em cada regra, um "Reescrito:" com data igual ou posterior a `desde`.
function exigirReescrito(regras, ids, desde) {
  const faltam = ids.filter(id => !(regras.get(id)?.reescrito ?? []).some(d => !desde || d >= desde))
  if (faltam.length > 0) throw new Error(`reescreva o cenário no catálogo com a decisão do usuário antes de selar ("Reescrito: AAAA-MM-DD, …" em ${faltam.join(', ')})`)
}

export function selar(raiz, repo, opcoes) {
  const { testes, kit, regras } = extrair(raiz)
  const selos = lerSelos(raiz)
  const head = selosDeHead(repo)
  const { tipo, motivo = '' } = opcoes
  if (opcoes.novos) {
    let n = 0
    for (const [chave, t] of Object.entries(testes)) {
      if (selos.testes[chave] || head.testes[chave]) continue
      selos.testes[chave] = { regras: t.regras, hash: t.hash, assercoes: t.assercoes, tipo: 'novo', data: hoje(), motivo }
      n++
    }
    for (const [arq, h] of Object.entries(kit)) {
      if (selos.kit[arq]) continue
      selos.kit[arq] = { hash: h, tipo: 'novo', data: hoje(), motivo }
      n++
    }
    gravar(raiz, selos)
    return `${n} selos novos`
  }
  if (!TIPOS.includes(tipo)) throw new Error(`--tipo deve ser ${TIPOS.join(', ')}`)
  if (opcoes.kit) {
    const arq = barra(opcoes.kit)
    if (!kit[arq]) throw new Error(`arquivo do kit não encontrado: ${arq}`)
    selos.kit[arq] = { hash: kit[arq], tipo, data: hoje(), motivo }
    gravar(raiz, selos)
    return `kit selado: ${arq}`
  }
  if (opcoes.remover) {
    const s = selos.testes[opcoes.remover]
    if (!s) throw new Error(`sem selo: ${opcoes.remover}`)
    if (tipo !== 'decisao') throw new Error('remover um teste selado exige --tipo decisao')
    exigirReescrito(regras, s.regras, s.data)
    delete selos.testes[opcoes.remover]
    gravar(raiz, selos)
    return `selo removido: ${opcoes.remover}`
  }
  const chave = opcoes.selar
  const t = testes[chave]
  if (!t) throw new Error(`teste coberto não encontrado: ${chave}`)
  const anterior = selos.testes[chave] ?? head.testes[chave]
  if (tipo === 'novo' && head.testes[chave]) throw new Error(`"novo" só para teste que não existia em HEAD: ${chave}`)
  if (tipo === 'refatoracao' && anterior && t.assercoes < anterior.assercoes)
    throw new Error(`refatoração não pode tirar asserções: ${chave} (${anterior.assercoes} → ${t.assercoes})`)
  if (tipo === 'decisao') exigirReescrito(regras, t.regras, anterior?.data)
  selos.testes[chave] = { regras: t.regras, hash: t.hash, assercoes: t.assercoes, tipo, data: hoje(), motivo }
  gravar(raiz, selos)
  return `teste selado (${tipo}): ${chave}`
}

// Linha de comando.
if (process.argv[1] && barra(fileURLToPath(import.meta.url)) === barra(process.argv[1])) {
  const args = process.argv.slice(2)
  const valor = nome => {
    const i = args.indexOf(nome)
    return i >= 0 ? args[i + 1] : undefined
  }
  const raiz = valor('--raiz') ?? join(dirname(fileURLToPath(import.meta.url)), '..')
  const repo = valor('--repo') ?? raiz
  try {
    if (args.some(a => ['--selar', '--kit', '--remover', '--novos'].includes(a))) {
      console.log(selar(raiz, repo, { selar: valor('--selar'), kit: valor('--kit'), remover: valor('--remover'), novos: args.includes('--novos'), tipo: valor('--tipo'), motivo: valor('--motivo') }))
    } else {
      const problemas = conferir(raiz, repo, valor('--base') ?? 'HEAD')
      for (const p of problemas) console.error(`- ${p}`)
      const s = lerSelos(raiz)
      console.log(`selos: ${Object.keys(s.testes).length} testes, ${Object.keys(s.kit).length} arquivos do kit, ${Object.keys(s.golden).length} desenhos${problemas.length ? `, ${problemas.length} problema(s)` : ''}`)
      process.exit(problemas.length > 0 ? 1 : 0)
    }
  } catch (err) {
    console.error(`recusado: ${err.message}`)
    process.exit(1)
  }
}
