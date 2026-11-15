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
// Um --base que não é commit deste repositório é erro, antes de tudo. Um teste selado no commit de
// comparação que não aparece na saída do plugin test (arquivo que caiu, tempo estourado) conta como
// falha ("TESTE DE <ref> NÃO RODOU"), com as mesmas liberações de uma falha.
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acharBinario } from './binario.mjs'
import { ehCommit, hoje, lerResultados, liberaGolden, liberaRemovido, liberaTeste, naoRodaram, selosDaBase } from './selos.mjs'

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
  for (const p of lista) {
    const destino = join(tmp, ...p.split('/'))
    mkdirSync(dirname(destino), { recursive: true })
    writeFileSync(destino, git('show', `${ref}:${p}`).stdout)
  }

  const claude = acharBinario()
  const r = spawnSync(claude, ['plugin', 'test', join(tmp, 'task-tree')], { cwd: tmp, encoding: 'utf8', shell: claude === 'claude', maxBuffer: 64 * 1024 * 1024 })
  const saida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`

  const resultados = lerResultados(saida)
  const falhas = resultados.filter(x => !x.ok)
  if (resultados.length === 0 || (r.status !== 0 && falhas.length === 0)) {
    console.error(`- saída irreconhecível do plugin test (exit ${r.status}); a regressão não pode ser conferida:\n${saida.slice(0, 2000)}`)
    codigo = 1
  } else {
    const agora = existsSync(join(raiz, 'regras', 'selos.json')) ? JSON.parse(readFileSync(join(raiz, 'regras', 'selos.json'), 'utf8')) : { testes: {}, removidos: {} }
    // A base selada por outro algoritmo do hash é recalculada pelo de agora (selos.mjs, selosDaBase).
    const head = selosDaBase(repo, ref, agora.algoritmo ?? 1)
    // O selado na base que não apareceu na saída conta como falha.
    const sumidos = naoRodaram(Object.keys(head.testes), resultados)
    for (const chave of sumidos) console.error(`- TESTE DE ${ref} NÃO RODOU: ${chave}`)
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
    console.log(`regressão: ${resultados.length} testes de ${ref} contra o código novo (${Object.keys(head.testes).length} selados, ${sumidos.length} não rodaram), ${falhas.length} falharam${codigo ? '' : n ? ', todas por decisão registrada' : ''}`)
  }
} finally {
  try {
    rmSync(tmp, { recursive: true, force: true })
  } catch {}
}
process.exit(codigo)
