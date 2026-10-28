import { expect, test } from 'claude-code/testing'
import { cabecalho, emTexto as noTexto, painel as desenho } from './kit/leitura'
import { subagente } from './kit/ambiente'
import { fixar } from './kit/ambiente'
import { done, pedido, plan, start, type No } from './kit/cenario'
import { esperarEstado, painel } from './kit/leitura'

const ARVORE: No[] = [
  {
    id: '1',
    title: 'Pedido',
    children: [
      { id: '1.1', title: 'Analisar' },
      { id: '1.2', title: 'Corrigir', children: [{ id: '1.2.1', title: 'Editar' }, { id: '1.2.2', title: 'Validar' }] },
    ],
  },
]

// Regra: arvore.pai-fecha-com-os-filhos, arvore.pai-em-andamento-no-caminho-da-ultima-iniciada
test('pai fecha sozinho quando todos os filhos fecham', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido de teste')
  expect((await plan($, ARVORE, 'Pedido de teste')).texto).toContain('Plano exibido')

  await start($, ['1.1'])
  await done($, ['1.1'])
  let p = await painel($)
  esperarEstado(p, 'Analisar', 'concluida')
  esperarEstado(p, 'Pedido', 'andamento')

  await start($, ['1.2.1'])
  await done($, ['1.2.1'])
  p = await painel($)
  esperarEstado(p, 'Editar', 'concluida')
  esperarEstado(p, 'Corrigir', 'andamento')
  esperarEstado(p, 'Pedido', 'andamento')

  await start($, ['1.2.2'])
  const fim = await done($, ['1.2.2'], 'Resumo do teste')
  expect(fim.texto).toContain('Concluídas:')
  expect(fim.texto).not.toContain('Avisos')
  p = await painel($)
  esperarEstado(p, 'Validar', 'concluida')
  esperarEstado(p, 'Corrigir', 'concluida')
  esperarEstado(p, 'Pedido', 'concluida')
})

// Regra: arvore.start-reabre-pais, arvore.start-recusa-pai-concluido
test('start reabre os pais de uma tarefa concluída e recusa tarefa concluída com subtarefas', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido de teste')
  await plan($, ARVORE)
  for (const id of ['1.1', '1.2.1', '1.2.2']) {
    await start($, [id])
    await done($, [id])
  }

  const recusa = await start($, ['1.2'])
  expect(recusa.texto).toContain('já foi concluída e tem subtarefas')
  expect(recusa.texto).toContain('Nada marcado')
  let p = await painel($)
  esperarEstado(p, 'Corrigir', 'concluida')
  esperarEstado(p, 'Pedido', 'concluida')

  expect((await start($, ['1.2.1'])).texto).toContain('Em andamento: Editar')
  p = await painel($)
  esperarEstado(p, 'Editar', 'andamento')
  esperarEstado(p, 'Corrigir', 'andamento')
  esperarEstado(p, 'Pedido', 'andamento')
  esperarEstado(p, 'Validar', 'concluida')
  esperarEstado(p, 'Analisar', 'concluida')
})

// Regra: arvore.ids-curtos-e-avisos
test('id curto ambíguo, inexistente ou de outro agente é avisado; o id completo resolve', async ($: any, on: any) => {
  fixar(on)
  subagente(on, 'sub-1')
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um de A' }] }, { id: 'B', title: 'Plano B', children: [{ id: '1', title: 'Um de B' }] }])
  expect((await start($, ['1'])).texto).toContain('"1" é ambíguo')
  expect((await start($, ['zz'])).texto).toContain('"zz" não existe')
  // Um subagente com o seu plano chama start com o id do loop principal.
  await plan($, [{ id: 'S', title: 'Plano do sub', children: [{ id: 's1', title: 'Passo do sub' }] }], undefined, 'sub-1')
  expect((await start($, ['A/1'], 'sub-1')).texto).toContain('"A/1" é de outro agente')
  await start($, ['A/1'])
  const p = await desenho($)
  esperarEstado(p, 'Um de A', 'andamento')
  esperarEstado(p, 'Um de B', 'pendente')
})

// Regra: arvore.done-sem-summary-e-varias-sem-start
test('o done avisa a falta do summary no fim e as etapas fechadas juntas sem start', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  const r = await done($, ['1', '2'])
  expect(r.texto).toContain('2 etapas fecharam juntas sem start')
  expect(r.texto).toContain('falta o summary')
  expect((await done($, [], 'Resumo')).texto).not.toContain('falta o summary')
})

// Regra: arvore.plan-recusa-ids-repetidos
test('plan com ids repetidos é recusado e nada muda no painel', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  const r = await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '1', title: 'Outro um' }] }])
  expect(r.erro).toBe(true)
  expect(r.texto).toContain('ids repetidos')
  const p = await desenho($)
  expect(cabecalho(p).vazio, noTexto(p)).toBe(true)
})