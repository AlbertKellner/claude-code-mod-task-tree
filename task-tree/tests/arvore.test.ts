import { expect, test } from 'claude-code/testing'
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
