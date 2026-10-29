// Matriz de impacto: dos arquivos do mod tocados aos cenários do catálogo, aos testes que os cobrem,
// ao checklist do app e ao golden. Orientação, nunca bloqueio: sai sempre com 0, e não roda testes
// (o check roda todos). Decisão do usuário, 2026-10-29: "Só avisar (Recomendado)", "Por arquivo
// (Recomendado)".
//
// Uso:
//   npm run impacto                    a pasta de trabalho e o índice contra HEAD
//   npm run impacto -- --base <ref>    contra a base (a CI, um PR): git diff <ref>...HEAD
//   npm run impacto -- <arquivo>…      arquivos à mão (a Análise, antes de implementar), relativos a
//                                      task-tree/ ou ao repositório
// --raiz <pasta>: o repositório (padrão: o deste script).
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NUCLEO, lerCatalogo, lerTestes } from './regras.mjs'

const barra = p => p.replace(/\\/g, '/')

// Os arquivos do mod (relativos a task-tree/, fora dos testes) entre os caminhos dados.
export const doMod = lista =>
  [...new Set(lista.map(barra).map(p => (p.startsWith('task-tree/') ? p.slice('task-tree/'.length) : p)))].filter(
    p => /\.tsx?$/.test(p) && !p.startsWith('tests/') && !p.startsWith('.claude-plugin/'),
  )

// O impacto de uma lista de arquivos do mod: os cenários, os testes, o checklist e o golden.
export function impacto(raiz, tocados) {
  const { regras } = lerCatalogo(raiz)
  const { citadas } = lerTestes(raiz, regras)
  const todos = [...regras.values()]
  const nucleo = tocados.filter(f => NUCLEO.includes(f))
  const afetados = nucleo.length > 0 ? todos.filter(r => r.estado === 'coberto' || r.codigo.some(c => tocados.includes(c))) : todos.filter(r => r.codigo.some(c => tocados.includes(c)))
  const mapeados = new Set(todos.flatMap(r => r.codigo))
  const testes = id => {
    const porArquivo = new Map()
    for (const o of citadas.get(id) ?? []) porArquivo.set(o.arquivo, (porArquivo.get(o.arquivo) ?? 0) + 1)
    return [...porArquivo].map(([a, n]) => `${a}: ${n} ${n === 1 ? 'teste' : 'testes'}`)
  }
  return {
    tocados,
    nucleo,
    cenarios: afetados.map(r => ({ id: r.id, estado: r.estado, testes: testes(r.id) })),
    checklist: (nucleo.length > 0 ? todos : afetados).filter(r => r.estado === 'checklist').map(r => r.id),
    golden: (nucleo.length > 0 ? todos : afetados).filter(r => r.id.startsWith('visual.desenho-')).map(r => r.id),
    fora: tocados.filter(f => !mapeados.has(f) && !NUCLEO.includes(f)),
  }
}

export function texto(r) {
  const linhas = [`Arquivos do mod tocados: ${r.tocados.length ? r.tocados.join(', ') : 'nenhum'}`]
  if (r.nucleo.length > 0) linhas.push(`Núcleo tocado (${r.nucleo.join(', ')}): todos os cenários cobertos (o check roda todos)`)
  linhas.push(`Cenários afetados (${r.cenarios.length}):`)
  const largura = Math.max(0, ...r.cenarios.map(c => c.id.length))
  for (const c of r.cenarios) linhas.push(`  ${c.id.padEnd(largura)}   ${(c.estado ?? '').padEnd(9)} ${c.testes.join('; ') || '—'}`)
  linhas.push(`Checklist do app: ${r.checklist.length ? r.checklist.join(', ') : 'nenhum'}`)
  linhas.push(`Golden: ${r.golden.length ? r.golden.join(', ') : 'nenhum cenário'}`)
  linhas.push(`Fora do mapa: ${r.fora.length ? r.fora.map(f => `task-tree/${f}`).join(', ') : 'nenhum'}`)
  linhas.push('O impacto orienta o que ler, citar e validar no app; o check roda todos os testes.')
  return linhas.join('\n')
}

if (process.argv[1] && barra(fileURLToPath(import.meta.url)) === barra(process.argv[1])) {
  try {
    const args = process.argv.slice(2)
    const valor = nome => {
      const i = args.indexOf(nome)
      return i >= 0 ? args[i + 1] : undefined
    }
    const raiz = valor('--raiz') ?? join(dirname(fileURLToPath(import.meta.url)), '..')
    const base = valor('--base')
    const soltos = args.filter((a, i) => !a.startsWith('--') && !['--raiz', '--base'].includes(args[i - 1] ?? ''))
    const git = (...a) => spawnSync('git', ['-C', raiz, ...a], { encoding: 'utf8' }).stdout ?? ''
    const lista = soltos.length
      ? soltos
      : base
        ? git('diff', '--name-only', `${base}...HEAD`).split('\n')
        : [...git('diff', '--name-only', 'HEAD').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')]
    console.log(texto(impacto(raiz, doMod(lista.filter(Boolean)))))
  } catch (err) {
    console.log(`impacto: não foi possível calcular (${err.message})`)
  }
  process.exit(0)
}
