// Confere o catálogo regras/ contra os testes de task-tree/tests/: cada id do catálogo, o seu estado
// e os comentários "// Regra:" acima de cada test(. Uso: node scripts/regras.mjs [--raiz <pasta>]
// (primeira etapa do npm run check). Sai com 1 e a lista dos problemas quando algo não bate.
//
// O mapa de código (matriz de impacto, npm run impacto): cada arquivo do catálogo tem uma linha
// "Código da área:" (os arquivos do mod, relativos a task-tree/), e um cenário pode ter "Código:" próprio,
// que soma à área. Caminho inexistente falha; cenário coberto sem código, ou arquivo do mod fora do
// mapa, só avisa (decisão do usuário, 2026-10-29: "Só avisar (Recomendado)").
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ID = /^### ([a-z0-9]+(?:\.[a-z0-9-]+)+)\s*$/
const TITULO = /^### /
const ESTADO = /^Estado: (coberto|pendente|checklist)\b/
const AREA = /^Código da área: (.+)$/
const CODIGO = /^Código: (.+)$/
const REGRA = /^\s*\/\/ Regra: (.+)$/
const TESTE = /^\s*test\(/

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

// Linha de comando.
if (process.argv[1] && barra(fileURLToPath(import.meta.url)) === barra(process.argv[1])) {
  const i = process.argv.indexOf('--raiz')
  const raiz = i >= 0 ? process.argv[i + 1] : join(dirname(fileURLToPath(import.meta.url)), '..')
  const cat = lerCatalogo(raiz)
  const tes = lerTestes(raiz, cat.regras)
  const problemas = [...cat.problemas, ...tes.problemas]
  const regras = [...cat.regras.values()]
  const conta = estado => regras.filter(r => r.estado === estado).length
  for (const p of problemas) console.error(`- ${p}`)
  for (const a of cat.avisos) console.log(`  aviso: ${a}`)
  console.log(`regras: ${conta('coberto')} cobertas, ${conta('pendente')} pendentes, ${conta('checklist')} checklist (${regras.length} no total)`)
  console.log(`mapa: ${regras.filter(r => r.estado === 'coberto' && r.codigo.length > 0).length} cobertos com código, ${cat.avisos.length} avisos`)
  process.exit(problemas.length > 0 ? 1 : 0)
}
