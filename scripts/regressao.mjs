// Testes antigos, código novo: roda os testes de HEAD contra o código do mod que está sendo
// verificado, numa pasta temporária (sem tocar no clone: nada de worktree, stash ou checkout). Um
// teste de HEAD que falha só é aceito quando o teste foi selado hoje como decisão do usuário.
//
// Uso:
//   node scripts/regressao.mjs                 a pasta de trabalho; pula sem diferença em task-tree/
//   node scripts/regressao.mjs --indice --raiz <cópia do índice>   o que vai no commit (hook)
//   node scripts/regressao.mjs --raiz <pasta>  o código de outra pasta, sempre (fumaça)
//   node scripts/regressao.mjs --base <ref>    a CI: os testes da base do PR contra o código dele; uma
//                                             falha passa só com o selo de decisão ou golden trazido no PR
//   --tmp <pasta>                              a pasta do check (scripts/testes.mjs), com os resultados da
//                                             passada principal: só repete os arquivos de teste que mudaram
// Só do que mudou (decisão do usuário, 2026-11-15: "Autorizo"): com --tmp, o arquivo de teste igual ao de
// <ref>, com o kit, os apoios e o golden iguais, não é repetido (a execução seria a da passada principal);
// os testes selados dele têm de constar aprovados nela ("NÃO CONFERIDO NA PASSADA PRINCIPAL", sem
// liberação por selo). Sem --tmp, ou com o kit, um apoio ou o golden mudado, repete todos (scripts/mudou.mjs).
// Um --base que não é commit deste repositório é erro, antes de tudo. Um teste selado no commit de
// comparação que não aparece na saída do plugin test (arquivo que caiu, tempo estourado) conta como
// falha ("TESTE DE <ref> NÃO RODOU"), com as mesmas liberações de uma falha.
// Segunda passada, só com selo de refatoração novo (hash diferente do de <ref>): o teste, como ficou,
// roda contra o código do mod de <ref> e tem de passar ("REFATORAÇÃO NÃO PROVADA"); decisão do
// usuário, 2026-11-15: "Sim, provar (Recomendado)".
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acharBinario } from './binario.mjs'
import { alteradosEmTestes, arquivosDaRegressao, ehArquivoDeTeste } from './mudou.mjs'
import { ehCommit, hoje, lerResultados, lerResultadosGravados, liberaGolden, liberaRemovido, liberaTeste, naoConferidos, naoRodaram, refatoracoesDoCommit, selosDaBase } from './selos.mjs'

const args = process.argv.slice(2)
const valor = nome => {
  const i = args.indexOf(nome)
  return i >= 0 ? args[i + 1] : undefined
}
const repo = valor('--repo') ?? join(dirname(fileURLToPath(import.meta.url)), '..')
const raiz = valor('--raiz') ?? repo
const indice = args.includes('--indice')
// Com que commit se compara: HEAD (local e hook) ou a base do PR (CI). Na CI não há "hoje": vale o selo
// que o PR traz (o hash difere do da base).
const base = valor('--base')
const ref = base ?? 'HEAD'
const dia = base ? undefined : hoje()
const git = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
if (args.includes('--base') && (!base || base.startsWith('--') || !ehCommit(repo, base))) {
  console.error(!base || base.startsWith('--') ? '- --base sem valor: diga a ref (ex.: o merge-base com o main)' : `- a base ${base} não existe neste repositório`)
  process.exit(1)
}

// Sem diferença no mod entre HEAD e o que se verifica, não há o que comparar.
if (!valor('--raiz') || indice) {
  const mudou = indice
    ? git('diff', '--cached', '--quiet', 'HEAD', '--', 'task-tree').status !== 0
    : base
      ? git('diff', '--quiet', base, '--', 'task-tree').status !== 0
      : git('status', '--porcelain', '--', 'task-tree').stdout.toString().trim() !== ''
  if (!mudou) {
    console.log(`regressão: sem diferença em task-tree/ desde ${ref}; nada a comparar`)
    process.exit(0)
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'task-tree-regressao-'))
let codigo = 0
try {
  // O código novo, sem os testes; os testes (e o kit) de HEAD.
  const fora = ['tests', join('.claude-plugin', 'types'), 'node_modules'].map(p => join(raiz, 'task-tree', p))
  cpSync(join(raiz, 'task-tree'), join(tmp, 'task-tree'), { recursive: true, filter: src => !fora.some(f => src === f || src.startsWith(f + sep)) })
  const lista = git('ls-tree', '-r', '--name-only', ref, 'task-tree/tests').stdout.toString().split('\n').filter(Boolean)
  // Os arquivos de teste que repetem; os iguais valem pela passada principal do mesmo check.
  const pastaDoCheck = valor('--tmp')
  const principal = pastaDoCheck ? lerResultadosGravados(pastaDoCheck) : null
  const alterados = valor('--raiz') && !indice ? null : alteradosEmTestes(repo, ref, indice)
  const { repete, iguais, motivo } = arquivosDaRegressao(lista.filter(ehArquivoDeTeste), alterados, principal !== null)
  if (pastaDoCheck && motivo) console.log(`- repete todos os arquivos de teste: ${motivo}`)
  const fica = new Set(iguais)
  for (const p of lista) {
    if (fica.has(p)) continue
    const destino = join(tmp, ...p.split('/'))
    mkdirSync(dirname(destino), { recursive: true })
    writeFileSync(destino, git('show', `${ref}:${p}`).stdout)
  }

  const claude = acharBinario()
  // Sem arquivo a repetir (lote que só muda código), nada roda: só a conferência na passada principal.
  const r = repete.length ? spawnSync(claude, ['plugin', 'test', join(tmp, 'task-tree')], { cwd: tmp, encoding: 'utf8', shell: claude === 'claude', maxBuffer: 64 * 1024 * 1024 }) : { status: 0, stdout: '', stderr: '' }
  const saida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`

  const resultados = lerResultados(saida)
  const falhas = resultados.filter(x => !x.ok)
  if (repete.length && (resultados.length === 0 || (r.status !== 0 && falhas.length === 0))) {
    console.error(`- saída irreconhecível do plugin test (exit ${r.status}); a regressão não pode ser conferida:\n${saida.slice(0, 2000)}`)
    codigo = 1
  } else {
    const agora = existsSync(join(raiz, 'regras', 'selos.json')) ? JSON.parse(readFileSync(join(raiz, 'regras', 'selos.json'), 'utf8')) : { testes: {}, removidos: {} }
    // A base selada por outro algoritmo do hash é recalculada pelo de agora (selos.mjs, selosDaBase).
    const head = selosDaBase(repo, ref, agora.algoritmo ?? 1)
    // O selado na base que não apareceu na saída conta como falha.
    const doArquivo = chave => chave.slice(0, chave.indexOf('::'))
    const seladosIguais = Object.keys(head.testes).filter(c => fica.has(doArquivo(c)))
    const sumidos = naoRodaram(Object.keys(head.testes).filter(c => !fica.has(doArquivo(c))), resultados)
    for (const chave of sumidos) console.error(`- TESTE DE ${ref} NÃO RODOU: ${chave}`)
    // O selado de um arquivo não repetido tem de constar aprovado na passada principal, sem liberação.
    if (iguais.length) {
      const faltam = naoConferidos(seladosIguais, principal)
      for (const chave of faltam) console.error(`- TESTE DE ${ref} NÃO CONFERIDO NA PASSADA PRINCIPAL: ${chave}`)
      if (faltam.length) codigo = 1
      console.log(`- não repetidos (iguais aos de ${ref}, com kit, apoios e golden iguais): ${iguais.length} arquivos, ${seladosIguais.length - faltam.length} testes selados conferidos na passada principal`)
    }
    for (const chave of [...falhas.map(f => f.chave), ...sumidos]) {
      const s = agora.testes[chave]
      const h = head.testes[chave]
      const regras = (h ?? s)?.regras?.join(', ') ?? 'sem regra'
      // O teste de golden de HEAD falha quando o desenho muda: só passa com o desenho aprovado hoje.
      const cenario = /golden\.test\.ts::golden: (\S+)$/.exec(chave)?.[1]
      if (cenario && liberaGolden(agora, head, cenario, dia)) {
        console.log(`- desenho aprovado: ${chave} (${agora.golden[cenario].motivo})`)
      } else if (liberaRemovido(agora, head, chave, dia)) {
        const r = agora.removidos[chave]
        console.log(r.para ? `- renomeado por decisão: ${chave} → ${r.para} (${r.motivo})` : `- removido por decisão: ${chave} (${r.motivo})`)
      } else if (liberaTeste(s, h, dia)) {
        console.log(`- decisão: ${chave} — regras ${regras} (${s.motivo})`)
      } else {
        console.error(`- REGRESSÃO OU DECISÃO NÃO REGISTRADA: ${chave} — regras ${regras}`)
        codigo = 1
      }
    }
    const n = falhas.length + sumidos.length
    console.log(`regressão: ${resultados.length} testes de ${ref} contra o código novo, de ${repete.length} arquivos repetidos (${iguais.length} não repetidos) (${Object.keys(head.testes).length - seladosIguais.length} selados, ${sumidos.length} não rodaram), ${falhas.length} falharam${codigo ? '' : n ? ', todas por decisão registrada' : ''}`)

    // Segunda passada (decisão do usuário, 2026-11-15: "Sim, provar (Recomendado)"): cada teste selado
    // como refatoração neste commit roda, como ficou, contra o código do mod de ref.
    const refatorados = refatoracoesDoCommit(agora, head)
    if (refatorados.length > 0 && provarRefatoracoes(refatorados) !== 0) codigo = 1
  }
} finally {
  try {
    rmSync(tmp, { recursive: true, force: true })
  } catch {}
}
process.exit(codigo)

// O código do mod de ref (do git) com os testes de agora: só os arquivos de teste que têm um teste
// refatorado, mais o kit e os arquivos de apoio de agora. Os outros testes desses arquivos podem
// falhar aqui sem contar; cada refatorado tem de aparecer aprovado.
function provarRefatoracoes(refatorados) {
  const pasta = mkdtempSync(join(tmpdir(), 'task-tree-refatoracao-'))
  try {
    const codigoDeRef = git('ls-tree', '-r', '--name-only', ref, 'task-tree').stdout.toString().split('\n').filter(p => p && !p.startsWith('task-tree/tests/'))
    for (const p of codigoDeRef) {
      const destino = join(pasta, ...p.split('/'))
      mkdirSync(dirname(destino), { recursive: true })
      writeFileSync(destino, git('show', `${ref}:${p}`).stdout)
    }
    const arquivos = new Set(refatorados.map(c => c.slice(0, c.indexOf('::'))))
    const testes = join(raiz, 'task-tree', 'tests')
    cpSync(testes, join(pasta, 'task-tree', 'tests'), {
      recursive: true,
      filter: src => {
        const rel = `task-tree/tests/${src.slice(testes.length + 1).split(sep).join('/')}`
        return !/\.test\.tsx?$/.test(rel) || arquivos.has(rel)
      },
    })
    const claude = acharBinario()
    const r = spawnSync(claude, ['plugin', 'test', join(pasta, 'task-tree')], { cwd: pasta, encoding: 'utf8', shell: claude === 'claude', maxBuffer: 64 * 1024 * 1024 })
    const aprovados = new Set(lerResultados(`${r.stdout ?? ''}\n${r.stderr ?? ''}`).filter(x => x.ok).map(x => x.chave))
    let falhou = 0
    for (const chave of refatorados) {
      if (aprovados.has(chave)) continue
      console.error(`- REFATORAÇÃO NÃO PROVADA: ${chave} falha no código anterior: o teste novo afirma outra coisa; se a regra mudou, é decisão (cenário com Reescrito: e selo de decisão)`)
      falhou++
    }
    console.log(`refatorações provadas contra ${ref}: ${refatorados.length - falhou}${falhou ? ` (${falhou} não provadas)` : ''}`)
    return falhou ? 1 : 0
  } finally {
    try {
      rmSync(pasta, { recursive: true, force: true })
    } catch {}
  }
}
