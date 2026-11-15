import { expect } from 'claude-code/testing'
import { test } from './kit/teste'
import { GOLDEN } from './golden/desenho'
import { AGORA, fixar, host, lancaveis, passos, responderEnvio, type Filha } from './kit/ambiente'
import { abrirSessao, aviso, chamadaDoSubagente, done, envio, esc, fimDoSubagente, fimDoTurno, lancar, pedido, plan, start, type No } from './kit/cenario'
import { desenhoDoApp } from './kit/leitura'

// O desenho do app desktop em 6 cenários, a 60 colunas (o largo, a 100): a árvore de Box, Text e Button e as fontes
// dos Svg (desenhoDoApp, no kit). Com o cenário em GOLDEN (aprovado pelo usuário no app), o desenho
// tem de ser igual; sem ele, o teste só confere que há desenho. Em ambos os casos, imprime GOLDEN-NEW
// com o desenho atual (npm run golden:aprovar o recolhe). Ver o CLAUDE.md.

const K1 = 'local_11111111-1111-1111-1111-111111111111'

// O primeiro trecho diferente entre o aprovado e o atual, para a mensagem da falha.
function trecho(antes: string, depois: string): string {
  let i = 0
  while (i < antes.length && antes[i] === depois[i]) i++
  return `na posição ${i}:\n  aprovado: …${antes.slice(Math.max(0, i - 80), i + 120)}\n  atual:    …${depois.slice(Math.max(0, i - 80), i + 120)}`
}

function conferir(cenario: string, desenho: { arvore: unknown; svgs: string[] }) {
  expect(JSON.stringify(desenho.arvore).length, `${cenario}: sem desenho`).toBeGreaterThan(2)
  const atual = JSON.stringify(desenho)
  // O console do teste vai à saída do plugin test (os tipos do kit não o declaram).
  ;(globalThis as any).console.log(`GOLDEN-NEW ${cenario} ${atual}`)
  const aprovado = (GOLDEN as Record<string, unknown>)[cenario]
  if (aprovado === undefined) return
  const antes = JSON.stringify(aprovado)
  if (antes !== atual) throw new Error(`o desenho de ${cenario} mudou (valide no app antes de aprovar) ${trecho(antes, atual)}`)
}

// Regra: visual.golden-gera-desenho, visual.desenho-principal
test('golden: principal', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  const A: No[] = [
    { id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um', children: [{ id: '1.1', title: 'Um.um' }, { id: '1.2', title: 'Um.dois' }] }, { id: '2', title: 'Dois' }, { id: '3', title: 'Três' }] },
  ]
  await pedido($, 'Pedido um')
  await plan($, A, 'Pedido principal')
  await start($, ['1.1'])
  await done($, ['1.1'], 'Primeira parte feita')
  await start($, ['1.2'])
  await esc($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'b1' }, { id: 'b2', title: 'b2' }] }])
  await start($, ['b1'])
  await done($, ['b1'], 'b1 pronto')
  await start($, ['b2'])
  await fimDoTurno($)
  await relogio.advance(1000)
  conferir('principal', await desenhoDoApp($))
})

// Regra: visual.golden-gera-desenho, visual.desenho-cartao-filha
test('golden: filha', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [
    {
      id: K1,
      nome: 'filha-um',
      git: { repo: 'meu-repo', branch: 'minha-branch' },
      rate: { toks: 42, live: true },
      contexto: 42,
      painel: { tasks: [{ id: '1', short: '1', title: 'Tarefa da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }] },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await relogio.advance(1000)
  conferir('filha', await desenhoDoApp($))
})

// Regra: visual.golden-gera-desenho, visual.desenho-envios
test('golden: envios', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: 'local_x', nome: 'outra' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Na fila' }, { id: '2', title: 'Entregue' }, { id: '3', title: 'Cortada' }] }])
  await start($, ['1'])
  await envio($, 'local_x')
  await start($, ['2'])
  await envio($, 'local_x')
  h.recebeu('local_x', AGORA)
  await aviso($)
  await start($, ['3'])
  await envio($, 'local_x')
  await esc($)
  await relogio.advance(1000)
  conferir('envios', await desenhoDoApp($))
})

// Regra: visual.golden-gera-desenho, visual.desenho-subagente
test('golden: subagente', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  lancaveis(on, ['s1', 's2', 's3', 's4', 's5', 's6'])
  on('tool.call', { tool: 'Grep' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }, { id: '2', title: 'Revisar' }] }])
  await start($, ['1'])
  // Um cartão rodando, com a ferramenta em uso, e um já concluído.
  await lancar($, { descricao: 'buscar usos de hover' })
  await chamadaDoSubagente($, 's1', 'Grep', { pattern: 'hover' })
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 's2')
  await relogio.advance(5000)
  // Quatro lançados juntos de outra tarefa: o cartão de grupo.
  await start($, ['2'])
  for (const d of ['ler o diff', 'ler os testes', 'segurança', 'correção']) await lancar($, { descricao: d })
  await fimDoSubagente($, 's3')
  await relogio.advance(1000)
  conferir('subagente', await desenhoDoApp($))
})

// Regra: visual.golden-gera-desenho, visual.desenho-cabecalho-largo
test('golden: largo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [], { git: { raiz: 'C:/Users/pessoa/meu-repo', head: 'ref: refs/heads/minha-branch\n' } })
  const passo = passos(on, relogio)
  // O que está abaixo do mod devolve o texto do attachment como veio.
  on('prompt.attachment', (_$: any, e: any) => ({ text: e.text }))
  // Um pedido concluído, fora do trabalho atual: a linha "+1 pedidos anteriores".
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await done($, ['1'], 'Um pronto')
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'b1' }, { id: 'b2', title: 'b2' }] }])
  await $.prompt.attachment({ type: 'ultra_effort_enter', text: 'x', origin: { kind: 'engine' } })
  await start($, ['b1'])
  await passo($, { geracao: 2000, tokens: 200 })
  await relogio.advance(1000)
  conferir('largo', await desenhoDoApp($, 100))
})

// Regra: visual.golden-gera-desenho, visual.desenho-filha-modelo-e-carta
test('golden: filha-modelo-e-carta', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const arquivada: Filha = { id: 'local_y', nome: 'arquivada', rodando: false }
  const h = host(on, [
    {
      id: K1,
      nome: 'filha-um',
      modelo: 'Opus 5.5 · xhigh',
      git: { repo: 'meu-repo', branch: 'minha-branch' },
      rate: { toks: 42, live: true },
      contexto: 42,
      painel: { tasks: [{ id: '1', short: '1', title: 'Tarefa da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }] },
    },
    { id: 'local_x', nome: 'outra' },
    arquivada,
  ])
  responderEnvio(on)
  // A carta de um plano interrompido (o pedido seguinte reusa o id da tarefa dela): cinza, interrompida.
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Mensagem' }] }])
  await start($, ['1'])
  await envio($, 'local_x')
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'A', title: 'Plano A novo', children: [{ id: '1', title: 'Mensagem' }, { id: '2', title: 'Filha' }, { id: '3', title: 'Para a arquivada' }] }])
  h.recebeu('local_x', AGORA)
  await aviso($)
  // A filha trabalhando, com o modelo e o esforço publicados.
  await start($, ['2'])
  await abrirSessao($)
  await aviso($)
  // A carta na fila de um destino que é arquivado: cinza, não entregue.
  await start($, ['3'])
  await envio($, 'local_y')
  arquivada.arquivada = true
  await aviso($)
  await relogio.advance(1000)
  conferir('filha-modelo-e-carta', await desenhoDoApp($))
})
