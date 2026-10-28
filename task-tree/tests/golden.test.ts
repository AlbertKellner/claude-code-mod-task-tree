import { expect, test } from 'claude-code/testing'
import { GOLDEN } from './golden/svg'
import { AGORA, fixar, host, responderEnvio } from './kit/ambiente'
import { abrirSessao, aviso, done, envio, esc, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'
import { svgs, type DesenhoSvg } from './kit/leitura'

// O desenho do app desktop em 3 cenários, a 60 colunas. Com o cenário em GOLDEN (aprovado pelo usuário
// no app), o desenho tem de ser igual; sem ele, o teste só confere que há desenho. Em ambos os casos,
// imprime GOLDEN-NEW com o desenho atual (npm run golden:aprovar o recolhe). Ver o CLAUDE.md.

const K1 = 'local_11111111-1111-1111-1111-111111111111'

// O primeiro trecho diferente entre o aprovado e o atual, para a mensagem da falha.
function trecho(antes: string, depois: string): string {
  let i = 0
  while (i < antes.length && antes[i] === depois[i]) i++
  return `na posição ${i}:\n  aprovado: …${antes.slice(Math.max(0, i - 80), i + 120)}\n  atual:    …${depois.slice(Math.max(0, i - 80), i + 120)}`
}

function conferir(cenario: string, desenho: DesenhoSvg[]) {
  expect(desenho.filter(s => s.source.startsWith('<svg')).length, `${cenario}: sem desenho`).toBeGreaterThan(0)
  const atual = JSON.stringify(desenho)
  // O console do teste vai à saída do plugin test (os tipos do kit não o declaram).
  ;(globalThis as any).console.log(`GOLDEN-NEW ${cenario} ${atual}`)
  const aprovado = (GOLDEN as Record<string, unknown>)[cenario]
  if (aprovado === undefined) return
  const antes = JSON.stringify(aprovado)
  if (antes !== atual) throw new Error(`o desenho de ${cenario} mudou (valide no app antes de aprovar) ${trecho(antes, atual)}`)
}

// Regra: visual.golden-gera-desenho
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
  conferir('principal', await svgs($))
})

// Regra: visual.golden-gera-desenho
test('golden: filha', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [
    {
      id: K1,
      nome: 'filha-um',
      git: { repo: 'meu-repo', branch: 'minha-branch' },
      rate: { toks: 42, live: true },
      painel: { tasks: [{ id: '1', short: '1', title: 'Tarefa da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }] },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await relogio.advance(1000)
  conferir('filha', await svgs($))
})

// Regra: visual.golden-gera-desenho
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
  conferir('envios', await svgs($))
})
