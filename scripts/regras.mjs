// Confere o catálogo regras/ contra os testes de task-tree/tests/: cada id do catálogo, o seu estado
// e os comentários "// Regra:" acima de cada test(. Uso: node scripts/regras.mjs (primeira etapa do
// npm run check). Sai com 1 e a lista dos problemas quando algo não bate.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const ID = /^### ([a-z0-9]+(?:\.[a-z0-9-]+)+)\s*$/
const TITULO = /^### /
const ESTADO = /^Estado: (coberto|pendente|checklist)\b/
const REGRA = /^\s*\/\/ Regra: (.+)$/
const TESTE = /^\s*test\(/

const problemas = []
const regras = new Map()

// O catálogo: cada "### <id>" abre um cenário; a primeira linha "Estado:" depois dele dá o estado.
const pastaRegras = join(raiz, 'regras')
for (const arquivo of readdirSync(pastaRegras).filter(f => f.endsWith('.md') && f !== 'README.md').sort()) {
  const linhas = readFileSync(join(pastaRegras, arquivo), 'utf8').split(/\r?\n/)
  let atual
  for (const linha of linhas) {
    if (TITULO.test(linha)) {
      const m = ID.exec(linha)
      if (!m) {
        problemas.push(`${arquivo}: id inválido: "${linha}"`)
        atual = undefined
        continue
      }
      if (regras.has(m[1])) problemas.push(`${arquivo}: id repetido: ${m[1]}`)
      atual = { id: m[1], arquivo, estado: undefined }
      regras.set(m[1], atual)
      continue
    }
    const e = ESTADO.exec(linha)
    if (e && atual && atual.estado === undefined) atual.estado = e[1]
  }
}
for (const r of regras.values()) if (r.estado === undefined) problemas.push(`${r.arquivo}: ${r.id} sem "Estado:" válido`)

// Os testes: "// Regra: a, b" na linha logo acima de cada test(.
const citadas = new Map()
const arquivosDeTeste = dir =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? arquivosDeTeste(p) : /\.test\.tsx?$/.test(f) ? [p] : []
  })
for (const p of arquivosDeTeste(join(raiz, 'task-tree', 'tests'))) {
  const nome = relative(raiz, p).replace(/\\/g, '/')
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
      citadas.set(id, [...(citadas.get(id) ?? []), `${nome}:${i + 1}`])
    }
  })
}

for (const r of regras.values()) {
  const onde = citadas.get(r.id)
  if (r.estado === 'coberto' && !onde) problemas.push(`${r.arquivo}: ${r.id} está "coberto", mas nenhum teste o cita`)
  if ((r.estado === 'pendente' || r.estado === 'checklist') && onde) problemas.push(`${r.arquivo}: ${r.id} está "${r.estado}", mas é citado em ${onde.join(', ')}: mude para "coberto"`)
}

const conta = estado => [...regras.values()].filter(r => r.estado === estado).length
for (const p of problemas) console.error(`- ${p}`)
console.log(`regras: ${conta('coberto')} cobertas, ${conta('pendente')} pendentes, ${conta('checklist')} checklist (${regras.size} no total)`)
process.exit(problemas.length > 0 ? 1 : 0)
