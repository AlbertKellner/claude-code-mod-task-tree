import { expect, test } from 'claude-code/testing'
import { cabecalho, emTexto as noTexto, painel as desenho } from './kit/leitura'
import { subagente } from './kit/ambiente'
import { fixar, lancaveis } from './kit/ambiente'
import { cancelar, done, fimDoSubagenteCom, fimDoTurno, lancar, pedido, plan, start, type No } from './kit/cenario'
import { esperarEstado, linha, painel } from './kit/leitura'

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

// Regra: arvore.id-curto-nao-alcanca-o-historico
test('o id curto não alcança as tarefas de histórico: start numa concluída não é ambíguo e o id que só existe no histórico não existe', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Antigo', children: [{ id: '1.1', title: 'Antiga um' }, { id: '1.3', title: 'Só no antigo' }] }])
  await start($, ['1.1'])
  await done($, ['1.1'])
  await start($, ['1.3'])
  await done($, ['1.3'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: '1', title: 'Novo', children: [{ id: '1.1', title: 'Nova um' }] }])
  await start($, ['1.1'])
  await done($, ['1.1'])
  const r = (await start($, ['1.1'])).texto
  expect(r).not.toContain('ambíguo')
  expect(r).toContain('Em andamento: Nova um')
  esperarEstado(await painel($), 'Nova um', 'andamento')
  const r2 = (await start($, ['1.3'])).texto
  expect(r2).toContain('"1.3" não existe')
  expect(r2).toContain('Nada marcado')
  const p = await painel($)
  expect(p.some(l => l.titulo === 'Só no antigo' || l.titulo === 'Antigo'), noTexto(p)).toBe(false)
})

// Regra: arvore.id-curto-nao-alcanca-o-historico
test('com a tarefa atual interrompida e a de histórico concluída, o start pelo id curto reabre a atual', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Antiga' }])
  await start($, ['1'])
  await done($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: '1', title: 'Nova' }])
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagenteCom($, 'sub-1', { erro: true })
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido três')
  const r = (await start($, ['1'])).texto
  expect(r).toContain('Em andamento: Nova')
  esperarEstado(await painel($), 'Nova', 'andamento')
})

// Regra: arvore.start-no-pai-inicia-a-primeira-subtarefa
test('start numa tarefa aberta com subtarefas inicia a primeira subtarefa aberta, de verdade', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido de teste')
  await plan($, ARVORE)
  await relogio.advance(5000)
  const r = await start($, ['1.2'])
  await relogio.advance(3000)
  expect(r.texto).toContain('Em andamento: Editar')
  let p = await painel($)
  esperarEstado(p, 'Editar', 'andamento')
  esperarEstado(p, 'Validar', 'pendente')
  esperarEstado(p, 'Corrigir', 'andamento')
  esperarEstado(p, 'Pedido', 'andamento')
  expect(cabecalho(p).chips.andamento, noTexto(p)).toBe(1)
  expect(linha(p, 'Editar').texto, noTexto(p)).toContain('0:03')
  await done($, ['1.2.1'])
  p = await painel($)
  esperarEstado(p, 'Validar', 'pendente')
  await start($, ['1.2'])
  await fimDoTurno($)
  p = await painel($)
  esperarEstado(p, 'Validar', 'aguardando')
})

// Regra: arvore.cancelar-tarefa-abandonada
test('done com cancel deixa a tarefa abandonada interrompida, fora do x/y, e o pai fecha com o que sobrou', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido de teste')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }, { id: '3', title: 'Três' }] }])
  await start($, ['1'])
  await done($, ['1'])
  const r = await cancelar($, ['2', '3'])
  expect(r.texto).toContain('Canceladas: 2')
  expect(r.texto).not.toContain('fecharam juntas sem start')
  expect(r.texto).not.toContain('falta o summary')
  const p = await painel($)
  esperarEstado(p, 'Dois', 'interrompida')
  esperarEstado(p, 'Três', 'interrompida')
  esperarEstado(p, 'Plano A', 'concluida')
  const c = cabecalho(p)
  expect([c.feitas, c.total, c.chips.interrompidas, c.chips.pendentes], noTexto(p)).toEqual([1, 1, 2, 0])
})

// Regra: arvore.cancelar-tarefa-abandonada
test('cancelar um pai interrompe só o que estava aberto embaixo, e avisa o id já fechado ou inexistente', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido de teste')
  await plan($, ARVORE)
  await start($, ['1.2.1'])
  await done($, ['1.2.1'])
  const r = await cancelar($, ['1.2', '1.2.1', 'zz'])
  let p = await painel($)
  esperarEstado(p, 'Editar', 'concluida')
  esperarEstado(p, 'Validar', 'interrompida')
  esperarEstado(p, 'Corrigir', 'concluida')
  esperarEstado(p, 'Analisar', 'pendente')
  expect(r.texto).toContain('"1.2.1" já está fechada')
  expect(r.texto).toContain('"zz" não existe')
  await start($, ['1.2.2'])
  p = await painel($)
  esperarEstado(p, 'Validar', 'andamento')
})
