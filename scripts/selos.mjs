// Selo dos testes e do kit: o que cada teste coberto por regra afirma fica registrado em
// regras/selos.json (hash do corpo normalizado e número de asserções). Um teste existente só muda
// com selo novo: de decisão do usuário (cenário com "Reescrito:"), de refatoração (sem perder
// asserções) ou de teste novo. Ver regras/README.md.
//
// Uso:
//   node scripts/selos.mjs                                  confere (etapa "selos" do check)
//   node scripts/selos.mjs --selar "<arquivo>::<nome>" --tipo decisao|refatoracao|novo --motivo "…"
//   node scripts/selos.mjs --kit <arquivo> --tipo … --motivo "…"
//   node scripts/selos.mjs --remover "<arquivo>::<nome>" --tipo decisao --motivo "…"   (registra em "removidos")
//   node scripts/selos.mjs --renomear "<chave antiga>" --para "<chave nova>" --tipo refatoracao|decisao --motivo "…"
//   node scripts/selos.mjs --novos --motivo "…"             sela como "novo" todo teste e kit sem selo
//   node scripts/selos.mjs --recontar                       regrava só "assercoes" dos selos que conferem
//   node scripts/selos.mjs --migrar                         regrava os hashes do algoritmo anterior pelo atual
// --raiz <pasta>: onde estão os arquivos (padrão: o repositório); --repo <pasta>: o git de HEAD
// (padrão: a própria raiz); --base <ref>: compara com esse commit em vez de HEAD (a CI, a base do PR).
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { ehPrincipal } from './guarda.mjs'
import { TESTE } from './regras.mjs'

// Chamadas que afirmam: expect e as funções exportadas de tests/kit/leitura.ts que chamam expect ou
// lançam erro (derivadas do arquivo, ver assercoesDoKit).
export const KIT_LEITURA = 'task-tree/tests/kit/leitura.ts'
const SELOS = 'regras/selos.json'
const TIPOS = ['decisao', 'refatoracao', 'novo']
// Versão do cálculo do hash dos testes (campo "algoritmo" do selos.json; sem o campo, 1). 1: o corpo e as
// declarações de topo que ele cita; 2: o corpo e tudo o que ele alcança no arquivo, por tabela.
export const ALGORITMO = 2

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
// As funções de topo de um arquivo: declaração (function f) ou const com arrow/function expression.
function funcoesDeTopo(sf) {
  const saida = []
  for (const st of sf.statements) {
    const exportada = !!st.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
    if (ts.isFunctionDeclaration(st) && st.name && st.body) saida.push({ nome: st.name.text, corpo: st.body, exportada })
    else if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations)
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)))
          saida.push({ nome: d.name.text, corpo: d.initializer.body, exportada })
  }
  return saida
}
const chama = (n, nome) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nome
// O corpo chama expect(...) ou tem throw, fora de funções aninhadas (que ele só cria, sem rodar).
function afirma(no) {
  let sim = false
  const visitar = n => {
    if (sim) return
    if (chama(n, 'expect') || ts.isThrowStatement(n)) sim = true
    else if (!ts.isFunctionLike(n)) ts.forEachChild(n, visitar)
  }
  visitar(no)
  return sim
}
// Os nomes que afirmam: expect mais as funções exportadas do kit de leitura que afirmam.
export function assercoesDoKit(texto) {
  const sf = ts.createSourceFile(KIT_LEITURA, texto ?? '', ts.ScriptTarget.Latest, true)
  return ['expect', ...funcoesDeTopo(sf).filter(f => f.exportada && afirma(f.corpo)).map(f => f.nome)]
}
const lerAssercoes = raiz => {
  const p = join(raiz, KIT_LEITURA)
  return assercoesDoKit(existsSync(p) ? readFileSync(p, 'utf8') : '')
}

const ehTeste = st =>
  ts.isExpressionStatement(st) && ts.isCallExpression(st.expression) && ts.isIdentifier(st.expression.expression) && st.expression.expression.text === 'test'

// Os testes de um arquivo: nome, regras citadas no "// Regra:" acima, hash e asserções. O hash cobre o
// corpo reimpresso sem comentários e as declarações de topo que ele alcança: as que cita, as que essas
// citam, e assim por diante (um plano A mudado muda o selo, mesmo usado só por um helper).
// As asserções somam as chamadas diretas a `nomes` e, por chamada, as de cada função de topo do
// próprio arquivo que o corpo chama (com alcance por outras funções de topo; ciclo cortado).
export function testesDe(caminho, texto, nomes = ['expect'], algoritmo = ALGORITMO) {
  const sf = ts.createSourceFile(caminho, texto, ts.ScriptTarget.Latest, true)
  const linhas = texto.split(/\r?\n/)
  const funcoes = new Map(funcoesDeTopo(sf).map(f => [f.nome, f.corpo]))
  const contaDe = new Map()
  const contar = (no, pilha) => {
    let n = 0
    const visitar = x => {
      if (ts.isCallExpression(x) && ts.isIdentifier(x.expression)) {
        const nome = x.expression.text
        if (nomes.includes(nome)) n++
        else if (funcoes.has(nome) && !pilha.includes(nome)) n += daFuncao(nome, pilha)
      }
      ts.forEachChild(x, visitar)
    }
    visitar(no)
    return n
  }
  const daFuncao = (nome, pilha) => {
    if (!contaDe.has(nome)) contaDe.set(nome, contar(funcoes.get(nome), [...pilha, nome]))
    return contaDe.get(nome)
  }
  const idsDe = no => {
    const ids = new Set()
    const visitar = n => {
      if (ts.isIdentifier(n)) ids.add(n.text)
      ts.forEachChild(n, visitar)
    }
    visitar(no)
    return ids
  }
  const topo = sf.statements.filter(st => !ts.isImportDeclaration(st) && !ehTeste(st)).map(st => ({ nomes: nomesDeclarados(st), usa: idsDe(st), texto: impressora.printNode(ts.EmitHint.Unspecified, st, sf) }))
  // Algoritmo 1: só as declarações que o corpo cita. Algoritmo 2: o fecho por alcance.
  const alcance = usados => {
    if (algoritmo < 2) return topo.filter(d => d.nomes.some(n => usados.has(n)))
    const dentro = new Set()
    const vistos = new Set(usados)
    let cresceu = true
    while (cresceu) {
      cresceu = false
      for (const d of topo)
        if (!dentro.has(d) && d.nomes.some(n => vistos.has(n))) {
          dentro.add(d)
          for (const n of d.usa) vistos.add(n)
          cresceu = true
        }
    }
    return topo.filter(d => dentro.has(d))
  }
  const saida = []
  for (const st of sf.statements) {
    if (!ehTeste(st)) continue
    const args = st.expression.arguments
    const nome = args[0]
    const corpo = args[args.length - 1]
    if (!nome || !ts.isStringLiteralLike(nome) || !corpo) continue
    const usados = idsDe(corpo)
    const assercoes = contar(corpo, [])
    const corpoTexto = impressora.printNode(ts.EmitHint.Unspecified, corpo, sf)
    const decls = alcance(usados).map(d => d.texto)
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

// Arquivo de apoio dos testes (fixtures): de tests/, sem ser teste, kit nem golden. Selado como o kit,
// na mesma seção "kit" do selos.json e pelo mesmo --kit.
const ehApoio = rel => /\.tsx?$/.test(rel) && !/\.test\.tsx?$/.test(rel) && !rel.includes('/tests/kit/') && !rel.includes('/tests/golden/')
export const ehDoKit = rel => rel.includes('/tests/kit/')
const nomeDe = arq => (ehDoKit(arq) ? 'arquivo do kit' : 'arquivo de apoio dos testes')

// Tudo o que se sela, lido dos arquivos: testes cobertos por regra, o kit e os arquivos de apoio.
export function extrair(raiz, algoritmo = ALGORITMO) {
  const regras = catalogo(raiz)
  const nomes = lerAssercoes(raiz)
  const testes = {}
  // Por arquivo de teste: as linhas que o catálogo conta como test( e os nomes que viram selo.
  const porArquivo = []
  const pastaTestes = join(raiz, 'task-tree', 'tests')
  for (const p of arquivos(pastaTestes, f => /\.test\.tsx?$/.test(f)).filter(p => !barra(p).includes('/kit/'))) {
    const rel = barra(relative(raiz, p))
    const texto = readFileSync(p, 'utf8')
    const todos = testesDe(p, texto, nomes, algoritmo)
    porArquivo.push({ rel, linhas: texto.split(/\r?\n/).filter(l => TESTE.test(l)).length, nomes: todos.map(t => t.nome), testDireto: importaTestDireto(p, texto) })
    for (const t of todos) {
      if (!t.regras.some(id => regras.get(id)?.estado === 'coberto')) continue
      testes[`${rel}::${t.nome}`] = t
    }
  }
  const kit = {}
  for (const p of arquivos(join(pastaTestes, 'kit'), f => /\.tsx?$/.test(f))) kit[barra(relative(raiz, p))] = hashDoKit(p, readFileSync(p, 'utf8'))
  for (const p of arquivos(pastaTestes, () => true)) {
    const rel = barra(relative(raiz, p))
    if (ehApoio(rel)) kit[rel] = hashDoKit(p, readFileSync(p, 'utf8'))
  }
  return { testes, kit, regras, porArquivo }
}

// O `test` com o teto por teste (decisão do usuário, 2026-11-15: "Autorizo"): com ele no repositório,
// o arquivo de teste não importa `test` direto do kit do Claude Code, que daria os 5 s de antes.
export const KIT_TESTE = 'task-tree/tests/kit/teste.ts'
export function importaTestDireto(caminho, texto) {
  const fonte = ts.createSourceFile(caminho, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  return fonte.statements.some(s => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text === 'claude-code/testing' &&
    s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings) &&
    s.importClause.namedBindings.elements.some(e => (e.propertyName ?? e.name).text === 'test'))
}

const vazio = () => ({ algoritmo: 1, testes: {}, kit: {}, golden: {}, removidos: {} })
// Sem selos.json, um começo do zero já é do algoritmo atual; um selos.json sem o campo é do algoritmo 1.
const lerSelos = raiz => (existsSync(join(raiz, SELOS)) ? { ...vazio(), ...JSON.parse(readFileSync(join(raiz, SELOS), 'utf8')) } : { ...vazio(), algoritmo: ALGORITMO })
// A ref é um commit deste repositório?
export const ehCommit = (repo, ref) => spawnSync('git', ['-C', repo, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { encoding: 'utf8' }).status === 0
// Os selos de um commit (HEAD por padrão; na CI, a base do PR). Uma ref que não é commit é erro, salvo
// HEAD num repositório ainda sem commit (o começo do zero: sem selos). Sem o arquivo no commit, vazio.
export function selosDeHead(repo, ref = 'HEAD') {
  if (!ehCommit(repo, ref)) {
    if (ref === 'HEAD') return vazio()
    throw new Error(`a base ${ref} não existe neste repositório`)
  }
  const r = spawnSync('git', ['-C', repo, 'show', `${ref}:${SELOS}`], { encoding: 'utf8' })
  return { ...vazio(), ...(r.status === 0 ? JSON.parse(r.stdout) : {}) }
}

// A saída do `plugin test`: uma linha por teste, agrupadas pelo arquivo ("tests\x.test.ts:" e
// "(pass|fail) <nome> [ms]"). Devolve { chave, ok } por teste.
export function lerResultados(saida) {
  let arquivo
  const resultados = []
  for (const linha of saida.split(/\r?\n/)) {
    const a = /^tests[\\/](.+):$/.exec(linha)
    if (a) {
      arquivo = `task-tree/tests/${a[1].replace(/\\/g, '/')}`
      continue
    }
    const t = /^\((pass|fail)\) (.+?)(?: \[[\d.]+m?s\])?$/.exec(linha)
    if (t && arquivo) resultados.push({ chave: `${arquivo}::${t[2]}`, ok: t[1] === 'pass' })
  }
  return resultados
}
// As chaves seladas que não aparecem nos resultados (o teste não rodou).
export function naoRodaram(chaves, resultados) {
  const vistas = new Set(resultados.map(r => r.chave))
  return chaves.filter(c => !vistas.has(c))
}
// As refatorações que um commit traz: selo "refatoracao" com hash diferente do da base. Teste sem selo
// na base (novo, ou nome novo de um renome) não entra; selo igual ao da base veio de antes. A etapa
// regressao roda cada uma contra o código anterior (decisão do usuário, 2026-11-15: "Sim, provar
// (Recomendado)").
export function refatoracoesDoCommit(agora, base) {
  return Object.entries(agora.testes ?? {})
    .filter(([chave, s]) => s.tipo === 'refatoracao' && base.testes?.[chave] !== undefined && base.testes[chave].hash !== s.hash)
    .map(([chave]) => chave)
}
const gravar = (raiz, selos) => {
  const ordenado = o => Object.fromEntries(Object.keys(o ?? {}).sort().map(k => [k, o[k]]))
  writeFileSync(join(raiz, SELOS), `${JSON.stringify({ algoritmo: selos.algoritmo, testes: ordenado(selos.testes), kit: ordenado(selos.kit), golden: ordenado(selos.golden), removidos: ordenado(selos.removidos) }, null, 2)}\n`)
}

// ---- Golden do desenho: a árvore e as fontes dos Svg de cada cenário, aprovadas pelo usuário no app (tests/golden/desenho.ts).
export const GOLDEN = 'task-tree/tests/golden/desenho.ts'
// Os cenários previstos do golden (reexportados por golden.mjs). A etapa selos exige cada um quando o
// repositório tem o teste do golden.
export const CENARIOS = ['principal', 'filha', 'envios', 'subagente', 'largo', 'filha-modelo-e-carta']
const TESTE_GOLDEN = 'task-tree/tests/golden.test.ts'
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

// O mesmo para um teste removido (ou renomeado) por decisão: o registro em "removidos" veio agora (não
// estava na base) e é de hoje (ou, na CI, trazido no PR). Renome de refatoração não libera: o teste da
// base tem de continuar passando.
export function liberaRemovido(agora, base, chave, data) {
  const r = agora.removidos?.[chave]
  return r !== undefined && r.tipo === 'decisao' && base.removidos?.[chave] === undefined && (data === undefined || r.data === data)
}

// Os selos da base com o hash recalculado pelo algoritmo pedido, a partir dos testes da própria base,
// quando ela foi selada por outro algoritmo: a comparação com a base segue valendo depois da migração.
// Teste que não está mais na base (arquivo ou nome) fica com o hash guardado.
export function selosDaBase(repo, ref = 'HEAD', algoritmo = ALGORITMO, nomes = ['expect']) {
  const head = selosDeHead(repo, ref)
  if (head.algoritmo === algoritmo) return head
  const porArquivo = new Map()
  for (const chave of Object.keys(head.testes)) {
    const arq = chave.slice(0, chave.indexOf('::'))
    if (porArquivo.has(arq)) continue
    const r = spawnSync('git', ['-C', repo, 'show', `${ref}:${arq}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    porArquivo.set(arq, r.status === 0 ? new Map(testesDe(arq, r.stdout, nomes, algoritmo).map(t => [t.nome, t.hash])) : new Map())
  }
  const testes = {}
  for (const [chave, s] of Object.entries(head.testes)) {
    const i = chave.indexOf('::')
    const h = porArquivo.get(chave.slice(0, i))?.get(chave.slice(i + 2))
    testes[chave] = h === undefined ? s : { ...s, hash: h }
  }
  return { ...head, algoritmo, testes }
}

// A conferência: devolve a lista de problemas.
export function conferir(raiz, repo = raiz, base = 'HEAD') {
  const { testes, kit, regras, porArquivo } = extrair(raiz)
  const selos = lerSelos(raiz)
  const head = selosDaBase(repo, base, selos.algoritmo, lerAssercoes(raiz))
  const problemas = []
  // Todo test( é uma instrução de topo, com nome literal e único no arquivo: o resto não seria selado.
  const temKitTeste = existsSync(join(raiz, KIT_TESTE))
  for (const { rel, linhas, nomes, testDireto } of porArquivo) {
    if (temKitTeste && testDireto) problemas.push(`${rel}: importa \`test\` de 'claude-code/testing'; o teto por teste vem de './kit/teste'`)
    if (linhas !== nomes.length) problemas.push(`${rel}: ${linhas} \`test(\` no arquivo, ${nomes.length} testes de topo com nome literal (teste aninhado, em laço ou com nome em template não é selado)`)
    for (const n of new Set(nomes.filter((n, i) => nomes.indexOf(n) !== i))) problemas.push(`nome de teste repetido em ${rel}: ${n}`)
  }
  if (selos.algoritmo !== ALGORITMO) problemas.push(`selos do algoritmo ${selos.algoritmo}, o atual é o ${ALGORITMO} (node scripts/selos.mjs --migrar)`)
  for (const [chave, t] of Object.entries(testes)) {
    const s = selos.testes[chave]
    if (!s) problemas.push(`teste novo sem selo: ${chave} (npm run regras:selar -- "${chave}" --tipo novo --motivo "…")`)
    else if (s.hash !== t.hash) problemas.push(`o teste mudou sem selo novo: ${chave}`)
  }
  for (const chave of Object.keys(selos.testes)) if (!testes[chave]) problemas.push(`teste selado sumiu: ${chave}`)
  for (const [arq, h] of Object.entries(kit)) {
    const s = selos.kit[arq]
    if (!s) problemas.push(`${nomeDe(arq)} sem selo: ${arq} (npm run regras:selar -- --kit "${arq}" --tipo novo --motivo "…")`)
    else if (s.hash !== h) problemas.push(`${ehDoKit(arq) ? 'o kit' : 'o arquivo de apoio dos testes'} mudou sem selo novo: ${arq}`)
  }
  for (const arq of Object.keys(selos.kit)) if (!kit[arq]) problemas.push(`${nomeDe(arq)} selado sumiu: ${arq}`)
  // O selo do kit que mudou contra a base: "novo" só para arquivo que não existia nela, e sempre com motivo.
  for (const [arq, s] of Object.entries(selos.kit)) {
    const b = head.kit[arq]
    if (b && s.hash === b.hash) continue
    if (b && s.tipo === 'novo') problemas.push(`tipo \`novo\` em arquivo do kit que já existia: ${arq}`)
    if (!s.motivo) problemas.push(`selo do kit sem motivo: ${arq}`)
  }
  // Um helper do kit que deixa de afirmar baixa a contagem sem o teste mudar: só com o kit selado como decisão.
  const kitDecidido = selos.kit[KIT_LEITURA]?.tipo === 'decisao' && selos.kit[KIT_LEITURA]?.hash !== head.kit[KIT_LEITURA]?.hash
  // A lista do que afirma é derivada do kit: um helper exportado com expect( fora dela é a derivação quebrada.
  const pKit = join(raiz, KIT_LEITURA)
  if (existsSync(pKit)) {
    const nomes = lerAssercoes(raiz)
    for (const m of readFileSync(pKit, 'utf8').matchAll(/^export (?:function (\w+)|const (\w+) =)[^\n]*\n(?:(?!export )[^\n]*\n)*?[^\n]*\bexpect\(/gm)) {
      const nome = m[1] ?? m[2]
      if (!nomes.includes(nome)) problemas.push(`helper do kit que afirma fora da contagem de asserções: ${nome}`)
    }
  }
  for (const [chave, s] of Object.entries(selos.testes)) {
    const t = testes[chave]
    // O número gravado tem de ser o contado: escrito à mão, ele esconderia uma perda.
    if (t && s.assercoes !== t.assercoes) problemas.push(`asserções do selo diferentes das contadas: ${chave} (selo ${s.assercoes}, contadas ${t.assercoes})`)
    const antes = head.testes[chave]
    if (t && antes && s.hash === antes.hash && t.assercoes < antes.assercoes && !kitDecidido)
      problemas.push(`menos asserções sem o teste mudar: ${chave} (${antes.assercoes} → ${t.assercoes}): um helper do kit deixou de afirmar`)
    if (!antes || s.hash === antes.hash) continue
    const contadas = t?.assercoes ?? s.assercoes
    if (s.tipo === 'novo') problemas.push(`tipo \`novo\` em teste que já existia: ${chave}`)
    if ((s.tipo === 'refatoracao' || s.tipo === 'novo') && contadas < antes.assercoes)
      problemas.push(`menos asserções sem decisão: ${chave} (${antes.assercoes} → ${contadas})`)
    if (s.tipo === 'decisao' && (s.regras ?? []).some(id => !(regras.get(id)?.reescrito ?? []).some(d => !antes.data || d >= antes.data)))
      problemas.push(`decisão sem \`Reescrito:\`: ${chave} (cada regra do selo precisa de "Reescrito:" desde ${antes.data})`)
  }
  // Selo da base que saiu do arquivo: só com o registro de --remover ou --renomear.
  for (const chave of Object.keys(head.testes)) if (!selos.testes[chave] && !selos.removidos[chave]) problemas.push(`selo apagado sem registro: ${chave}`)
  const golden = lerGolden(raiz)
  for (const [cen, valor] of Object.entries(golden)) {
    const s = selos.golden[cen]
    if (!s) problemas.push(`desenho do golden sem selo: ${cen} (npm run golden:aprovar, só com a validação do usuário no app)`)
    else if (s.hash !== hashGolden(valor)) problemas.push(`o desenho do golden mudou sem aprovação: ${cen}`)
  }
  for (const cen of Object.keys(selos.golden)) if (!(cen in golden)) problemas.push(`selo de golden sem cenário: ${cen}`)
  // Cenário previsto (com o teste do golden no repositório) ou da base que sumiu do desenho e do selo.
  const previstos = new Set([...(existsSync(join(raiz, TESTE_GOLDEN)) ? CENARIOS : []), ...Object.keys(head.golden)])
  for (const cen of previstos) if (!(cen in golden) || !selos.golden[cen]) problemas.push(`cenário do golden sumido: ${cen}`)
  return problemas
}

// Exige, em cada regra, um "Reescrito:" com data igual ou posterior a `desde`; devolve a data mais nova.
function exigirReescrito(regras, ids, desde) {
  const faltam = ids.filter(id => !(regras.get(id)?.reescrito ?? []).some(d => !desde || d >= desde))
  if (faltam.length > 0) throw new Error(`reescreva o cenário no catálogo com a decisão do usuário antes de selar ("Reescrito: AAAA-MM-DD, …" em ${faltam.join(', ')})`)
  return ids.flatMap(id => regras.get(id)?.reescrito ?? []).sort().at(-1)
}

export function selar(raiz, repo, opcoes) {
  const { testes, kit, regras } = extrair(raiz)
  const selos = lerSelos(raiz)
  // Migração do algoritmo: cada selo tem de conferir pelo algoritmo antigo; o hash vira o do atual e
  // tipo, data, motivo, regras e asserções ficam. Os arquivos de apoio ainda sem selo entram como novo.
  if (opcoes.migrar) {
    if (selos.algoritmo === ALGORITMO) throw new Error(`os selos já são do algoritmo ${ALGORITMO}`)
    const antigos = extrair(raiz, selos.algoritmo).testes
    const fora = Object.keys(selos.testes).filter(c => antigos[c]?.hash !== selos.testes[c].hash)
    if (fora.length > 0) throw new Error(`teste selado com hash diferente pelo algoritmo ${selos.algoritmo} (selar antes de migrar): ${fora.join('; ')}`)
    let mudaram = 0
    for (const [chave, s] of Object.entries(selos.testes))
      if (s.hash !== testes[chave].hash) {
        s.hash = testes[chave].hash
        mudaram++
      }
    let apoio = 0
    for (const [arq, h] of Object.entries(kit))
      if (!selos.kit[arq] && !ehDoKit(arq)) {
        selos.kit[arq] = { hash: h, tipo: 'novo', data: hoje(), motivo: opcoes.motivo ?? 'arquivo de apoio dos testes, selado na migração do hash' }
        apoio++
      }
    const de = selos.algoritmo
    selos.algoritmo = ALGORITMO
    gravar(raiz, selos)
    return `algoritmo ${de} → ${ALGORITMO}: ${mudaram} de ${Object.keys(selos.testes).length} hashes regravados; ${apoio} arquivo(s) de apoio selado(s)`
  }
  if (selos.algoritmo !== ALGORITMO) throw new Error(`selos do algoritmo ${selos.algoritmo}: rode --migrar antes`)
  if (opcoes.recontar) {
    const divergentes = Object.keys(selos.testes).filter(c => testes[c]?.hash !== selos.testes[c].hash)
    if (divergentes.length > 0) throw new Error(`teste selado com hash diferente (selar antes de recontar): ${divergentes.join('; ')}`)
    let n = 0
    for (const [chave, s] of Object.entries(selos.testes))
      if (s.assercoes !== testes[chave].assercoes) {
        s.assercoes = testes[chave].assercoes
        n++
      }
    gravar(raiz, selos)
    return `${n} contagens de asserções regravadas`
  }
  const head = selosDeHead(repo)
  const { tipo, motivo = '' } = opcoes
  if (opcoes.novos) {
    if (!motivo) throw new Error('--novos exige --motivo')
    let n = 0
    for (const [chave, t] of Object.entries(testes)) {
      if (selos.testes[chave] || head.testes[chave]) continue
      selos.testes[chave] = { regras: t.regras, hash: t.hash, assercoes: t.assercoes, tipo: 'novo', data: hoje(), motivo }
      n++
    }
    for (const [arq, h] of Object.entries(kit)) {
      if (selos.kit[arq] || head.kit[arq]) continue
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
    if (tipo === 'novo' && head.kit[arq]) throw new Error(`"novo" só para arquivo que não existia em HEAD: ${arq}`)
    if (!motivo) throw new Error('o selo do kit exige --motivo')
    selos.kit[arq] = { hash: kit[arq], tipo, data: hoje(), motivo }
    gravar(raiz, selos)
    return `kit selado: ${arq}`
  }
  if (opcoes.remover) {
    const s = selos.testes[opcoes.remover]
    if (!s) throw new Error(`sem selo: ${opcoes.remover}`)
    if (tipo !== 'decisao') throw new Error('remover um teste selado exige --tipo decisao')
    const reescrito = exigirReescrito(regras, s.regras, s.data)
    delete selos.testes[opcoes.remover]
    selos.removidos[opcoes.remover] = { regras: s.regras, data: hoje(), motivo, reescrito, hash: s.hash, tipo }
    gravar(raiz, selos)
    return `selo removido (registrado): ${opcoes.remover}`
  }
  if (opcoes.renomear) {
    const de = opcoes.renomear
    const para = opcoes.para
    const s = selos.testes[de]
    if (!s) throw new Error(`sem selo: ${de}`)
    if (!para) throw new Error('--renomear exige --para "<chave nova>"')
    const t = testes[para]
    if (!t) throw new Error(`teste coberto não encontrado: ${para}`)
    if (tipo === 'novo') throw new Error('renomear exige --tipo refatoracao ou decisao')
    let reescrito
    if (tipo === 'refatoracao') {
      if (t.hash !== s.hash) throw new Error(`refatoração só para renome puro (o corpo mudou): ${de} → ${para}; use --tipo decisao`)
    } else reescrito = exigirReescrito(regras, t.regras, s.data)
    delete selos.testes[de]
    selos.testes[para] = { regras: t.regras, hash: t.hash, assercoes: t.assercoes, tipo, data: hoje(), motivo }
    selos.removidos[de] = { regras: s.regras, data: hoje(), motivo, ...(reescrito ? { reescrito } : {}), hash: s.hash, para, tipo }
    gravar(raiz, selos)
    return `selo renomeado (${tipo}): ${de} → ${para}`
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
if (ehPrincipal(import.meta.url)) {
  const args = process.argv.slice(2)
  const valor = nome => {
    const i = args.indexOf(nome)
    return i >= 0 ? args[i + 1] : undefined
  }
  const raiz = valor('--raiz') ?? join(dirname(fileURLToPath(import.meta.url)), '..')
  const repo = valor('--repo') ?? raiz
  try {
    if (args.some(a => ['--selar', '--kit', '--remover', '--renomear', '--novos', '--recontar', '--migrar'].includes(a))) {
      console.log(selar(raiz, repo, { selar: valor('--selar'), kit: valor('--kit'), remover: valor('--remover'), renomear: valor('--renomear'), para: valor('--para'), novos: args.includes('--novos'), recontar: args.includes('--recontar'), migrar: args.includes('--migrar'), tipo: valor('--tipo'), motivo: valor('--motivo') }))
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
