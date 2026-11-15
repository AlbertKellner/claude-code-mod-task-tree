// Confere o catálogo regras/ contra os testes de task-tree/tests/: cada id do catálogo, o seu estado
// e os comentários "// Regra:" acima de cada test(. Uso: node scripts/regras.mjs [--raiz <pasta>]
// (primeira etapa do npm run check). Sai com 1 e a lista dos problemas quando algo não bate.
//
// O mapa de código (matriz de impacto, npm run impacto): cada arquivo do catálogo tem uma linha
// "Código da área:" (os arquivos do mod, relativos a task-tree/), e um cenário pode ter "Código:" próprio,
// que soma à área. Caminho inexistente falha; cenário coberto sem código, ou arquivo do mod fora do
// mapa, só avisa (decisão do usuário, 2026-10-29: "Só avisar (Recomendado)"). Um commit citado nas
// linhas "Origem:" e "Reescrito:" que não existe no repositório (--repo, padrão a raiz) também só avisa;
// sem git na pasta, nada a avisar.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ehPrincipal } from './guarda.mjs'

const ID = /^### ([a-z0-9]+(?:\.[a-z0-9-]+)+)\s*$/
const TITULO = /^### /
const ESTADO = /^Estado: (coberto|pendente|checklist)\b/
const AREA = /^Código da área: (.+)$/
const CODIGO = /^Código: (.+)$/
const REGRA = /^\s*\/\/ Regra: (.+)$/
export const TESTE = /^\s*test\(/
const CITACAO = /^(?:Origem|Reescrito): /
// Hash curto: 7 a 12 hexadecimais com ao menos uma letra; só de dígitos, logo depois de "commit(s)".
const HASHES = /\bcommits?\s+((?:[0-9a-f]{7,12}(?:,?\s*(?:e\s+)?)?)+)|\b([0-9a-f]{7,12})\b/g

// Arquivos que redesenham ou ligam tudo: tocá-los afeta todos os cenários (no script, não no catálogo).
export const NUCLEO = ['hooks/register.tsx', 'hooks/render.tsx', 'types/index.d.ts']

const caminhos = texto => texto.split(',').map(s => s.trim()).filter(Boolean)
const barra = p => p.replace(/\\/g, '/')

// Os arquivos .ts/.tsx do mod, relativos a task-tree/ (fora dos testes e dos tipos gerados).
export function arquivosDoMod(raiz) {
  const base = join(raiz, 'task-tree')
  const andar = dir =>
    existsSync(dir)
      ? readdirSync(dir).flatMap(f => {
          const p = join(dir, f)
          const rel = barra(relative(base, p))
          if (statSync(p).isDirectory()) return ['tests', '.claude-plugin', 'node_modules'].includes(rel) ? [] : andar(p)
          return /\.tsx?$/.test(f) ? [rel] : []
        })
      : []
  return andar(base)
}

// O catálogo: os cenários (id, arquivo, estado, código efetivo), os problemas e os avisos do mapa.
export function lerCatalogo(raiz) {
  const problemas = []
  const avisos = []
  const regras = new Map()
  const pastaRegras = join(raiz, 'regras')
  const existe = c => existsSync(join(raiz, 'task-tree', ...c.split('/')))
  for (const arquivo of readdirSync(pastaRegras).filter(f => f.endsWith('.md') && f !== 'README.md').sort()) {
    const linhas = readFileSync(join(pastaRegras, arquivo), 'utf8').split(/\r?\n/)
    let area
    let atual
    const conferirCaminhos = (lista, onde) => {
      for (const c of lista) if (!existe(c)) problemas.push(`${arquivo}: ${onde}: caminho inexistente em task-tree/: ${c}`)
    }
    for (const linha of linhas) {
      if (TITULO.test(linha)) {
        const m = ID.exec(linha)
        if (!m) {
          problemas.push(`${arquivo}: id inválido: "${linha}"`)
          atual = undefined
          continue
        }
        if (regras.has(m[1])) problemas.push(`${arquivo}: id repetido: ${m[1]}`)
        atual = { id: m[1], arquivo, estado: undefined, area: area ?? [], proprio: undefined }
        regras.set(m[1], atual)
        continue
      }
      const a = AREA.exec(linha)
      if (a && !atual) {
        if (area) problemas.push(`${arquivo}: "Código da área:" repetido`)
        area = caminhos(a[1])
        conferirCaminhos(area, 'Código da área')
        continue
      }
      const c = CODIGO.exec(linha)
      if (c && atual) {
        if (atual.proprio) problemas.push(`${arquivo}: ${atual.id}: "Código:" repetido`)
        atual.proprio = caminhos(c[1])
        conferirCaminhos(atual.proprio, atual.id)
        continue
      }
      const e = ESTADO.exec(linha)
      if (e && atual && atual.estado === undefined) atual.estado = e[1]
    }
  }
  for (const r of regras.values()) {
    r.codigo = [...new Set([...r.area, ...(r.proprio ?? [])])]
    if (r.estado === undefined) problemas.push(`${r.arquivo}: ${r.id} sem "Estado:" válido`)
    if (r.estado === 'coberto' && r.codigo.length === 0) avisos.push(`${r.arquivo}: ${r.id} está "coberto" sem código no mapa`)
  }
  const mapeados = new Set([...regras.values()].flatMap(r => r.codigo))
  for (const f of arquivosDoMod(raiz)) if (!mapeados.has(f) && !NUCLEO.includes(f)) avisos.push(`fora do mapa: task-tree/${f} (nenhum cenário o cita)`)
  return { regras, problemas, avisos }
}

// Os commits citados nas linhas "Origem:" e "Reescrito:": [{ arquivo, id, hash }].
export function hashesCitados(raiz) {
  const pasta = join(raiz, 'regras')
  const saida = []
  for (const arquivo of readdirSync(pasta).filter(f => f.endsWith('.md') && f !== 'README.md').sort()) {
    let id
    for (const linha of readFileSync(join(pasta, arquivo), 'utf8').split(/\r?\n/)) {
      const m = ID.exec(linha)
      if (m) id = m[1]
      if (!id || !CITACAO.test(linha)) continue
      const vistos = new Set()
      for (const h of linha.matchAll(HASHES)) {
        const lista = h[1] ? (h[1].match(/[0-9a-f]{7,12}/g) ?? []) : /[a-f]/.test(h[2]) ? [h[2]] : []
        for (const hash of lista)
          if (!vistos.has(hash)) {
            vistos.add(hash)
            saida.push({ arquivo, id, hash })
          }
      }
    }
  }
  return saida
}

// Os avisos dos commits citados que não existem em `repo`; sem git na pasta, nenhum.
export function avisosDeCommits(raiz, repo) {
  if (spawnSync('git', ['-C', repo, 'rev-parse', '--git-dir'], { encoding: 'utf8' }).status !== 0) return []
  const citados = hashesCitados(raiz)
  const unicos = [...new Set(citados.map(c => c.hash))]
  if (unicos.length === 0) return []
  const r = spawnSync('git', ['-C', repo, 'cat-file', '--batch-check'], { input: `${unicos.map(h => `${h}^{commit}`).join('\n')}\n`, encoding: 'utf8' })
  const faltam = new Set((r.stdout ?? '').split(/\r?\n/).filter(l => / missing$/.test(l)).map(l => l.replace(/\^\{commit\} missing$/, '')))
  return citados.filter(c => faltam.has(c.hash)).map(c => `${c.arquivo}: ${c.id}: commit citado não existe: ${c.hash}`)
}

// Os testes: "// Regra: a, b" na linha logo acima de cada test(. Devolve onde cada id é citado.
export function lerTestes(raiz, regras) {
  const problemas = []
  const citadas = new Map()
  const arquivosDeTeste = dir =>
    existsSync(dir)
      ? readdirSync(dir).flatMap(f => {
          const p = join(dir, f)
          return statSync(p).isDirectory() ? arquivosDeTeste(p) : /\.test\.tsx?$/.test(f) ? [p] : []
        })
      : []
  for (const p of arquivosDeTeste(join(raiz, 'task-tree', 'tests'))) {
    const nome = barra(relative(raiz, p))
    const linhas = readFileSync(p, 'utf8').split(/\r?\n/)
    linhas.forEach((linha, i) => {
      if (!TESTE.test(linha)) return
      const m = i > 0 ? REGRA.exec(linhas[i - 1]) : null
      if (!m) {
        problemas.push(`${nome}:${i + 1}: test( sem "// Regra:" na linha de cima`)
        return
      }
      for (const id of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
        if (!regras.has(id)) problemas.push(`${nome}:${i + 1}: cita regra inexistente: ${id}`)
        citadas.set(id, [...(citadas.get(id) ?? []), { arquivo: nome, linha: i + 1 }])
      }
    })
  }
  for (const r of regras.values()) {
    const onde = citadas.get(r.id)
    if (r.estado === 'coberto' && !onde) problemas.push(`${r.arquivo}: ${r.id} está "coberto", mas nenhum teste o cita`)
    if ((r.estado === 'pendente' || r.estado === 'checklist') && onde)
      problemas.push(`${r.arquivo}: ${r.id} está "${r.estado}", mas é citado em ${onde.map(o => `${o.arquivo}:${o.linha}`).join(', ')}: mude para "coberto"`)
  }
  return { citadas, problemas }
}

// A tabela de durabilidade (task-tree/state/durability.ts) contra as chaves do state do mod
// (`PluginState['task-tree']` em task-tree/types/index.d.ts): cada chave tem uma linha que vive no
// state (`state` ou `state+store`), e cada linha dessas tem a chave. Leitura de texto; sem os dois
// arquivos, nada a conferir.
export function lerDurabilidade(raiz) {
  const tipos = join(raiz, 'task-tree', 'types', 'index.d.ts')
  const tabela = join(raiz, 'task-tree', 'state', 'durability.ts')
  if (!existsSync(tipos) || !existsSync(tabela)) return []
  const texto = readFileSync(tipos, 'utf8')
  const ini = texto.search(/'task-tree':\s*\{/)
  if (ini < 0) return [`task-tree/types/index.d.ts: PluginState['task-tree'] não encontrado`]
  // As chaves do objeto: o que vem antes do primeiro ':' de cada membro de profundidade 0.
  const chaves = []
  let prof = 0
  let membro = ''
  for (const ch of texto.slice(texto.indexOf('{', ini) + 1)) {
    if ('{<([' .includes(ch)) prof++
    if ('}>)]'.includes(ch)) {
      if (prof === 0) break
      prof--
    }
    if (prof === 0 && ch === ';') {
      chaves.push(membro)
      membro = ''
    } else membro += ch
  }
  chaves.push(membro)
  const doState = new Set(chaves.map(m => m.split(':')[0].trim().replace(/\?$/, '')).filter(Boolean))
  const linhas = new Set([...readFileSync(tabela, 'utf8').matchAll(/\{\s*key:\s*'([^']+)',\s*lives:\s*'(state|state\+store)'/g)].map(m => m[1]))
  return [
    ...[...doState].filter(k => !linhas.has(k)).map(k => `task-tree/state/durability.ts: chave do state sem linha na tabela de durabilidade: ${k}`),
    ...[...linhas].filter(k => !doState.has(k)).map(k => `task-tree/state/durability.ts: linha da tabela de durabilidade sem chave no state: ${k}`),
  ]
}

// Linha de comando.
if (ehPrincipal(import.meta.url)) {
  const i = process.argv.indexOf('--raiz')
  const raiz = i >= 0 ? process.argv[i + 1] : join(dirname(fileURLToPath(import.meta.url)), '..')
  const j = process.argv.indexOf('--repo')
  const repo = j >= 0 ? process.argv[j + 1] : raiz
  const cat = lerCatalogo(raiz)
  cat.avisos.push(...avisosDeCommits(raiz, repo))
  const tes = lerTestes(raiz, cat.regras)
  const problemas = [...cat.problemas, ...tes.problemas, ...lerDurabilidade(raiz)]
  const regras = [...cat.regras.values()]
  const conta = estado => regras.filter(r => r.estado === estado).length
  for (const p of problemas) console.error(`- ${p}`)
  for (const a of cat.avisos) console.log(`  aviso: ${a}`)
  console.log(`regras: ${conta('coberto')} cobertas, ${conta('pendente')} pendentes, ${conta('checklist')} checklist (${regras.length} no total)`)
  console.log(`mapa: ${regras.filter(r => r.estado === 'coberto' && r.codigo.length > 0).length} cobertos com código, ${cat.avisos.length} avisos`)
  process.exit(problemas.length > 0 ? 1 : 0)
}
