import { expect, test } from 'claude-code/testing'
import { AGORA, armazem, estado, fixar, host, lancaveis, responderEnvio } from './kit/ambiente'
import { abrirSessao, aviso, chamadaDoSubagente, done, envio, esc, fimDoSubagente, fimDoSubagenteCom, fimDoTurno, iniciarSessao, lancar, pedido, plan, start, type No } from './kit/cenario'
import { cabecalho, emTexto, linha, montar, painel } from './kit/leitura'

// O cartão de subagente (na raiz e dentro de uma filha), lido pela superfície terminal como as outras linhas.

const UM: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }, { id: '2', title: 'Outra' }] }]
// As linhas logo abaixo de uma (mais fundas que ela), até a próxima do mesmo nível.
const abaixo = (p: any[], titulo: string) => {
  const l = linha(p, titulo)
  const out: any[] = []
  for (const x of p.slice(p.indexOf(l) + 1)) {
    if (x.nivel <= l.nivel) break
    out.push(x)
  }
  return out
}

// Regra: subagentes.cartao-desde-o-lancamento, subagentes.cartao-mostra-modelo-e-estado
test('lançado um subagente, o cartão aparece sob a tarefa em andamento, com o modelo e "trabalhando"', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'buscar usos de hover' })
  const p = await painel($)
  const cartao = abaixo(p, 'Investigar').find(l => l.titulo === 'Explore: buscar usos de hover')
  expect(cartao, emTexto(p)).toBeDefined()
  expect(cartao.texto).toContain('Haiku 5.5')
  expect(cartao.texto).toContain('trabalhando')
})

// Regra: subagentes.corpo-e-as-tarefas-ou-a-ferramenta
test('sem usar o painel, o cartão mostra a ferramenta em uso e quantas chamadas fez', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok' }))
  on('tool.call', { tool: 'Grep' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await chamadaDoSubagente($, 'sub-1', 'Read', { file_path: 'C:/x/kit/leitura.ts' })
  await relogio.advance(1500)
  await chamadaDoSubagente($, 'sub-1', 'Grep', { pattern: 'hover' })
  const p = await painel($)
  const corpo = abaixo(p, 'Explore: ler o kit').map(l => l.texto).join('\n')
  expect(corpo, emTexto(p)).toContain('Grep "hover" · 2 chamadas')
})

// Regra: subagentes.corpo-e-as-tarefas-ou-a-ferramenta
test('o subagente que usa o painel mostra as tarefas dele no cartão', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes' })
  await plan($, [{ id: 'X', title: 'Ler os testes' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  const p = await painel($)
  expect(abaixo(p, 'general-purpose: revisar testes').map(l => l.titulo), emTexto(p)).toContain('Ler os testes')
})

// Regra: subagentes.terminado-segue-cartao, subagentes.cartao-mostra-modelo-e-estado
test('terminado, o cartão segue com "concluído"; com erro, "falhou"; parado, "interrompido"', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'sub-2', 'sub-3'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'um' })
  await lancar($, { descricao: 'dois' })
  await lancar($, { descricao: 'tres' })
  await fimDoSubagente($, 'sub-1')
  await fimDoSubagenteCom($, 'sub-2', { erro: true })
  await fimDoSubagenteCom($, 'sub-3', { parado: true })
  const p = await painel($)
  expect(linha(p, 'Explore: um').texto, emTexto(p)).toContain('concluído')
  expect(linha(p, 'Explore: um').estado).toBe('concluida')
  expect(linha(p, 'Explore: dois').texto).toContain('falhou')
  expect(linha(p, 'Explore: tres').texto).toContain('interrompido')
  // Sem linha de resultado: o cartão terminado não tem nada abaixo dele.
  expect(abaixo(p, 'Explore: um').length).toBe(0)
})

// Regra: subagentes.varios-juntos-num-cartao-de-grupo
test('mais de três lançados juntos ficam num cartão de grupo, uma linha por agente; três, cada um no seu', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['s1', 's2', 's3', 's4'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  for (const d of ['a', 'b', 'c']) await lancar($, { descricao: d })
  let p = await painel($)
  expect(p.some(l => l.titulo === 'Explore: a'), emTexto(p)).toBe(true)
  expect(p.some(l => /subagentes$/.test(l.titulo))).toBe(false)
  await lancar($, { descricao: 'd' })
  p = await painel($)
  expect(linha(p, '4 subagentes').texto, emTexto(p)).toContain('4 trabalhando')
  expect(abaixo(p, '4 subagentes').map(l => l.titulo)).toEqual(['Explore: a', 'Explore: b', 'Explore: c', 'Explore: d'])
})

// Regra: subagentes.varios-juntos-num-cartao-de-grupo
test('os agentes de um workflow ficam num cartão "Workflow · N agentes"', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['w1', 'w2'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o diff', run: 'wf_1' })
  await lancar($, { descricao: 'ler os testes', run: 'wf_1' })
  const p = await painel($)
  expect(abaixo(p, 'Workflow · 2 agentes').map(l => l.titulo), emTexto(p)).toEqual(['Explore: ler o diff', 'Explore: ler os testes'])
})

// Regra: subagentes.fora-da-contagem
test('o subagente não entra no "d de n" e ganha a pílula de subagentes', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'sub-2'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  const antes = cabecalho(await painel($))
  await lancar($, { descricao: 'um' })
  await lancar($, { descricao: 'dois' })
  const p = await painel($)
  const depois = cabecalho(p)
  expect([depois.feitas, depois.total], emTexto(p)).toEqual([antes.feitas, antes.total])
  expect(p.filter(l => l.cabecalho).map(l => l.texto).join('\n')).toContain('▸ 2')
})

// Regra: subagentes.na-filha
test('o subagente de uma filha aparece dentro do cartão dela', async ($: any, on: any) => {
  fixar(on)
  host(on, [
    {
      id: 'local_11111111-1111-1111-1111-111111111111',
      nome: 'filha',
      painel: {
        tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }],
        agentes: [{ agent: 'fs-1', label: 'Explore: achar o teste', parent: '', anchor: '1', tasks: [], sub: { at: AGORA - 500, state: 'running', calls: 3, tool: 'Grep "x"', batch: AGORA - 500, engine: 'Haiku 5.5' } }],
      },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(abaixo(p, 'Da filha').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o teste')
})

// Regra: subagentes.cartao-desde-o-lancamento
test('com duas em andamento, o subagente vai à primeira e a carta seguinte à segunda', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Primeira' }, { id: '2', title: 'Segunda' }] }])
  await start($, ['1', '2'])
  await lancar($, { descricao: 'achar o teste' })
  await envio($, 'local_x', 'oi')
  const p = await painel($)
  expect(abaixo(p, 'Primeira').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o teste')
  expect(abaixo(p, 'Segunda').some(l => l.titulo.startsWith('Para ')), emTexto(p)).toBe(true)
  expect(abaixo(p, 'Primeira').some(l => l.titulo.startsWith('Para '))).toBe(false)
})

// Regra: subagentes.cartao-desde-o-lancamento
test('sem nada em andamento, o cartão vai à pendente do pedido atual', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await lancar($, { descricao: 'ler o kit' })
  const p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: ler o kit')
})

// Regra: subagentes.pai-conclui-no-fim-do-turno
test('o subagente concluído fecha a tarefa de onde saiu no fim do turno; o pai e a contagem seguem', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  let p = await painel($)
  // Dentro do turno, nada fecha.
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('andamento')
  await fimDoTurno($)
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Plano A').estado).toBe('concluida')
  expect([cabecalho(p).feitas, cabecalho(p).total]).toEqual([1, 1])
  // Um done do modelo depois só acrescenta o resumo.
  const r = await done($, ['1'], 'Resumo do subagente')
  expect(r.erro).toBe(false)
})

// Regra: subagentes.pai-conclui-no-fim-do-turno
test('lançado de uma pendente (sem start), o subagente concluído fecha a pendente também', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Outra').estado).toBe('pendente')
})

// Regra: subagentes.um-rodando-mantem-o-pai, subagentes.pai-conclui-no-fim-do-turno
test('com um ainda rodando, a tarefa não fecha; o último, terminando depois do turno, a fecha', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'sub-2'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'um' })
  await lancar($, { descricao: 'dois', segundoPlano: true })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).not.toBe('concluida')
  expect(cabecalho(p).feitas).toBe(0)
  await fimDoSubagente($, 'sub-2')
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
})

// Regra: subagentes.um-rodando-mantem-o-pai
test('com uma carta na fila na mesma tarefa, o subagente concluído não a fecha', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'um' })
  await envio($, 'local_x', 'oi')
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).not.toBe('concluida')
})

// Regra: subagentes.pai-reflete-falha-ou-interrupcao
test('o subagente que falhou deixa a tarefa ✕ "falhou"; o interrompido, ✕ "interrompida"; misto, o pior', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['f1', 'i1', 'm1', 'm2'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Falha' }, { id: '2', title: 'Parada' }, { id: '3', title: 'Mista' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'f' })
  await start($, ['2'])
  await lancar($, { descricao: 'i' })
  await start($, ['3'])
  await lancar($, { descricao: 'm1' })
  await lancar($, { descricao: 'm2' })
  await fimDoSubagenteCom($, 'f1', { erro: true })
  await fimDoSubagenteCom($, 'i1', { parado: true })
  await fimDoSubagente($, 'm1')
  await fimDoSubagenteCom($, 'm2', { erro: true })
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Falha').estado, emTexto(p)).toBe('interrompida')
  expect(linha(p, 'Falha').texto).toContain('falhou')
  expect(linha(p, 'Parada').estado).toBe('interrompida')
  expect(linha(p, 'Parada').texto).toContain('interrompida')
  expect(linha(p, 'Mista').texto).toContain('falhou')
})

// Regra: subagentes.id-reusado-nao-herda-cartao
test('plan de um pedido novo que reusa o id não herda o cartão do subagente antigo, e o fim do turno não fecha a tarefa nova', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'A', title: 'Plano B', children: [{ id: '1', title: 'Corrigir' }, { id: '2', title: 'Revisar' }] }])
  p = await painel($)
  expect(abaixo(p, 'Corrigir').map(l => l.titulo), emTexto(p)).not.toContain('Explore: ler o kit')
  await fimDoTurno($)
  p = await painel($)
  expect(linha(p, 'Corrigir').estado, emTexto(p)).toBe('pendente')
  expect(linha(p, 'Plano B').estado).not.toBe('concluida')
  expect(abaixo(p, 'Corrigir').map(l => l.titulo)).not.toContain('Explore: ler o kit')
})

// Regra: subagentes.id-reusado-nao-herda-cartao
test('o replano de um subagente que reusa o id não deixa o subagente que ele lançou fechar a tarefa nova', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'neto-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes', segundoPlano: true })
  await plan($, [{ id: 'X', title: 'Ler os testes' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  await lancar($, { descricao: 'achar o kit', pai: 'sub-1' })
  await fimDoSubagente($, 'neto-1')
  await done($, ['X'], undefined, 'sub-1')
  await plan($, [{ id: 'X', title: 'Corrigir os testes' }], undefined, 'sub-1')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Ler os testes').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Corrigir os testes').estado, emTexto(p)).toBe('pendente')
})

// Regra: subagentes.cartao-fica-com-a-origem-fechada
test('a tarefa que fecha sozinha no fim do turno, ou pelo done do modelo, segue com o cartão "concluído" embaixo', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'sub-2'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: ler o kit')
  expect(linha(p, 'Explore: ler o kit').texto).toContain('concluído')
  expect([cabecalho(p).feitas, cabecalho(p).total]).toEqual([1, 2])
  await pedido($, 'Pedido dois')
  await start($, ['2'])
  await lancar($, { descricao: 'achar o teste' })
  await fimDoSubagente($, 'sub-2')
  await done($, ['2'], 'Resumo')
  p = await painel($)
  expect(linha(p, 'Outra').estado, emTexto(p)).toBe('concluida')
  expect(abaixo(p, 'Outra').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o teste')
})

// Regra: subagentes.cartao-fica-com-a-origem-fechada
test('com a tarefa fechada pelo done, o subagente em segundo plano segue no cartão e na pílula até terminar', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await done($, ['1'], 'Lançado em segundo plano')
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: varrer o repo')
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('em segundo plano')
  expect(p.filter(l => l.cabecalho).map(l => l.texto).join('\n')).toContain('▸ 1')
  await fimDoSubagente($, 'sub-1')
  p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: varrer o repo')
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('concluído')
})

// Regra: subagentes.cartao-fica-com-a-origem-fechada
test('lançado num pedido sem plano depois de um pedido todo concluído, o cartão aparece sob a última tarefa iniciada', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await done($, ['1'], 'Feito')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await lancar($, { descricao: 'conferir o diff' })
  const p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: conferir o diff')
  expect(linha(p, 'Explore: conferir o diff').texto).toContain('trabalhando')
})

// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo
test('reaberta com start depois de fechar pelo subagente, a tarefa aguarda no fim do turno seguinte; o subagente antigo não a fecha de novo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await start($, ['1'])
  await fimDoTurno($)
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('aguardando')
  expect(cabecalho(p).feitas).toBe(0)
})

// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo
test('fechada pelo done e reaberta com start no mesmo pedido, mesmo replanejada, a tarefa não fecha pelo subagente que terminou antes', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await done($, ['1'], 'Lido')
  await relogio.advance(1000)
  await start($, ['1'])
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }, { id: '2', title: 'Outra' }, { id: '3', title: 'Revisar' }] }])
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('aguardando')
  expect(linha(p, 'Revisar').estado).toBe('pendente')
})

// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo, subagentes.pai-reflete-falha-ou-interrupcao
test('a tarefa ✕ "falhou" reaberta com start e refeita por outro subagente que conclui fica ✓', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['f1', 's2'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'tentar' })
  await fimDoSubagenteCom($, 'f1', { erro: true })
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('interrompida')
  expect(linha(p, 'Investigar').texto).toContain('falhou')
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await start($, ['1'])
  await lancar($, { descricao: 'tentar de novo' })
  await fimDoSubagente($, 's2')
  await fimDoTurno($)
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Investigar').texto).not.toContain('falhou')
})

// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo, turnos.esc-interrompe-so-a-iniciada
test('reaberta com start, a tarefa que tinha falhado e é parada com Esc diz "interrompida", não "falhou"', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['f1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'tentar' })
  await fimDoSubagenteCom($, 'f1', { erro: true })
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await start($, ['1'])
  await esc($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('interrompida')
  expect(linha(p, 'Investigar').texto).toContain('interrompida')
  expect(linha(p, 'Investigar').texto).not.toContain('falhou')
})

// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo, subagentes.pai-conclui-no-fim-do-turno
test('lançado da pendente, o subagente que termina antes do primeiro start ainda fecha a tarefa no fim do turno', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await relogio.advance(1000)
  await start($, ['1'])
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Outra').estado).toBe('pendente')
})

// O state de uma versão anterior à âncora renomeada com a tarefa (o par abaixo).
const ANTIGO: Record<string, unknown> = {}

// Regra: subagentes.lancado-antes-da-tarefa-nao-conta
test('âncora gravada por versão anterior, 1/2: o pedido dois reusa o id da tarefa de onde saiu o subagente do pedido um', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  estado(on, ANTIGO, 'captura')
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'A', title: 'Plano B', children: [{ id: '1', title: 'Corrigir' }, { id: '2', title: 'Revisar' }] }])
  const p = await painel($)
  expect(linha(p, 'Corrigir').estado, emTexto(p)).toBe('pendente')
  // Como uma versão anterior deixava o grupo: a âncora no id reusado, não na cópia antiga.
  const sub = ((ANTIGO.groups ?? []) as any[]).find(g => g.agent === 'sub-1')
  expect(sub?.anchor).not.toBe('A/1')
  sub.anchor = 'A/1'
})

// Regra: subagentes.lancado-antes-da-tarefa-nao-conta
test('âncora gravada por versão anterior, 2/2: o fim do turno não fecha a tarefa nova pelo subagente lançado antes dela', async ($: any, on: any) => {
  fixar(on, { agora: AGORA + 1000 })
  estado(on, ANTIGO, 'semear')
  if (((ANTIGO.groups ?? []) as any[]).every(g => g.anchor !== 'A/1')) throw new Error('rode o par inteiro: o 1/2 não gravou')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Corrigir').estado, emTexto(p)).toBe('pendente')
  expect(linha(p, 'Plano B').estado).not.toBe('concluida')
})

// Lançamentos que correm juntos, como os de uma mensagem com várias chamadas a Agent: o host devolve
// cada id alguns ms depois do anterior (o relógio anda 10 ms a cada um), e as primeiras leituras dos
// grupos depois dos lançamentos ficam presas até chegarem tantas quantos os lançamentos (cada um lê o
// painel antes de outro gravar, como no app). `presas()`: quantas leituras ficaram presas juntas.
// Chamar antes da primeira chamada a $.
const tique = (ms: number) => new Promise(r => (globalThis as any).setTimeout(r, ms))
function juntos(on: any, relogio: any, ids: string[]) {
  let i = 0
  let lancando = false
  let fila: (() => void)[] | undefined = []
  let presas = 0
  on('agent.spawn', async () => {
    const n = i++
    lancando = true
    await tique(n * 5)
    await relogio.advance(10)
    return { model: 'claude-haiku-5-5', agentId: ids[n] }
  })
  on('agent.list', () => ({ value: ids.map(id => ({ id, type: 'general-purpose', description: `subagente ${id}` })) }))
  on('state.get', async (_$: any, e: any, next: any) => {
    const f = fila
    if (e.key === 'groups' && lancando && f) {
      await new Promise<void>(solta => {
        f.push(solta)
        if (f.length === ids.length) {
          fila = undefined
          presas = f.length
          for (const s of f) s()
        }
      })
    }
    return next(e)
  })
  return { presas: () => presas }
}

// Regra: subagentes.lancados-juntos-se-veem, subagentes.varios-juntos-num-cartao-de-grupo
test('quatro lançados juntos da mesma tarefa, com o relógio andando, ficam num cartão de grupo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const corrida = juntos(on, relogio, ['s1', 's2', 's3', 's4'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await Promise.all(['a', 'b', 'c', 'd'].map(d => lancar($, { descricao: d })))
  // Os quatro leram o painel antes de qualquer um gravar.
  expect(corrida.presas()).toBe(4)
  const p = await painel($)
  expect(linha(p, '4 subagentes').texto, emTexto(p)).toContain('4 trabalhando')
  expect(abaixo(p, 'Investigar')[0].titulo).toBe('4 subagentes')
  expect(abaixo(p, '4 subagentes').map(l => l.titulo).sort()).toEqual(['Explore: a', 'Explore: b', 'Explore: c', 'Explore: d'])
})

// Regra: subagentes.lancados-juntos-se-veem, subagentes.cartao-desde-o-lancamento
test('com duas em andamento, dois lançados juntos vão um a cada tarefa, como em série', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const corrida = juntos(on, relogio, ['s1', 's2'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Primeira' }, { id: '2', title: 'Segunda' }] }])
  await start($, ['1', '2'])
  await Promise.all(['achar o teste', 'ler o kit'].map(d => lancar($, { descricao: d })))
  expect(corrida.presas()).toBe(2)
  const p = await painel($)
  const cartoes = (titulo: string) => abaixo(p, titulo).filter(l => l.titulo.startsWith('Explore: '))
  expect(cartoes('Primeira').length, emTexto(p)).toBe(1)
  expect(cartoes('Segunda').length).toBe(1)
})

// Regra: subagentes.lancados-juntos-se-veem, subagentes.na-filha
test('o cartão de uma filha publicado com um lote por lançamento junta os quatro lançados juntos num cartão de grupo', async ($: any, on: any) => {
  fixar(on)
  // Como uma versão anterior publicava: quatro lançamentos a 10 ms um do outro, cada um com o seu lote.
  const sub = (n: number) => ({
    agent: `fs-${n}`,
    label: `Explore: parte ${n}`,
    parent: '',
    anchor: '1',
    tasks: [],
    sub: { at: AGORA - 500 + n * 10, state: 'running', calls: 0, batch: AGORA - 500 + n * 10, engine: 'Haiku 5.5' },
  })
  host(on, [
    {
      id: 'local_11111111-1111-1111-1111-111111111111',
      nome: 'filha',
      painel: {
        tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }],
        agentes: [1, 2, 3, 4].map(sub),
      },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(abaixo(p, 'Da filha').map(l => l.titulo), emTexto(p)).toContain('4 subagentes')
  expect(abaixo(p, '4 subagentes').map(l => l.titulo)).toEqual(['Explore: parte 1', 'Explore: parte 2', 'Explore: parte 3', 'Explore: parte 4'])
})

// Regra: subagentes.neto-segue-o-cartao-de-quem-o-lancou
test('terminado, o subagente lançado por outro subagente segue com o cartão "concluído" sob a tarefa de quem o lançou', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'neto-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes' })
  await plan($, [{ id: 'X', title: 'Ler os testes' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  await lancar($, { descricao: 'achar o kit', pai: 'sub-1' })
  let p = await painel($)
  expect(abaixo(p, 'Ler os testes').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o kit')
  expect(linha(p, 'Explore: achar o kit').texto).toContain('trabalhando')
  await fimDoSubagente($, 'neto-1')
  p = await painel($)
  expect(abaixo(p, 'Ler os testes').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o kit')
  expect(linha(p, 'Explore: achar o kit').texto).toContain('concluído')
  expect(linha(p, 'Explore: achar o kit').estado).toBe('concluida')
  // O subagente que o lançou fecha a tarefa e termina, e o turno acaba: os dois cartões seguem.
  await done($, ['X'], undefined, 'sub-1')
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('general-purpose: revisar testes')
  expect(abaixo(p, 'Ler os testes').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o kit')
  expect(linha(p, 'Explore: achar o kit').texto).toContain('concluído')
})

// Regra: subagentes.neto-segue-o-cartao-de-quem-o-lancou, subagentes.na-filha
test('numa filha, o subagente terminado que outro subagente lançou segue no cartão dele', async ($: any, on: any) => {
  fixar(on)
  const fim = { at: AGORA - 500, state: 'done', calls: 2, batch: AGORA - 500, engine: 'Haiku 5.5', end: AGORA - 100 }
  host(on, [
    {
      id: 'local_11111111-1111-1111-1111-111111111111',
      nome: 'filha',
      painel: {
        tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }],
        agentes: [
          {
            agent: 'fs-1',
            label: 'general-purpose: revisar testes',
            parent: '',
            anchor: '1',
            tasks: [{ id: 'X', short: 'X', title: 'Ler os testes', status: 'done', startedAt: AGORA - 400, endedAt: AGORA - 200, children: [] }],
            sub: { ...fim, state: 'running', end: undefined },
          },
          { agent: 'fs-2', label: 'Explore: achar o kit', parent: 'fs-1', anchor: 'X', tasks: [], sub: fim },
        ],
      },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(abaixo(p, 'Da filha').map(l => l.titulo), emTexto(p)).toContain('general-purpose: revisar testes')
  expect(abaixo(p, 'Ler os testes').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o kit')
  expect(linha(p, 'Explore: achar o kit').texto).toContain('concluído')
})

// Regra: subagentes.neto-segue-o-cartao-de-quem-o-lancou
test('lançado por um subagente sem tarefas, o cartão fica no fim do cartão dele e sai com ele, sem ficar solto no fim do painel', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'neto-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes' })
  await lancar($, { descricao: 'achar o kit', pai: 'sub-1' })
  await fimDoSubagente($, 'neto-1')
  await fimDoSubagente($, 'sub-1')
  await done($, ['1', '2'], 'Feito')
  await fimDoTurno($)
  let p = await painel($)
  expect(abaixo(p, 'general-purpose: revisar testes').map(l => l.titulo), emTexto(p)).toEqual(['Explore: achar o kit'])
  expect(linha(p, 'Explore: achar o kit').texto).toContain('concluído')
  // O pedido sai do trabalho: o cartão do subagente sai com ele, e o do que ele lançou também.
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: '1', title: 'Corrigir' }] }])
  await start($, ['B/1'])
  p = await painel($)
  expect(p.map(l => l.titulo), emTexto(p)).not.toContain('general-purpose: revisar testes')
  expect(p.map(l => l.titulo), emTexto(p)).not.toContain('Explore: achar o kit')
})

// Regra: subagentes.neto-segue-o-cartao-de-quem-o-lancou
test('o cartão do subagente lançado por outro não vai para uma tarefa da sessão que tem o mesmo id da tarefa de quem o lançou', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'neto-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes' })
  await plan($, [{ id: 'B', title: 'Ler os testes' }], undefined, 'sub-1')
  await start($, ['B'], 'sub-1')
  await lancar($, { descricao: 'achar o kit', pai: 'sub-1' })
  await fimDoSubagente($, 'neto-1')
  await done($, ['B'], undefined, 'sub-1')
  await fimDoSubagente($, 'sub-1')
  await done($, ['1', '2'], 'Feito')
  await fimDoTurno($)
  let p = await painel($)
  expect(abaixo(p, 'Ler os testes').map(l => l.titulo), emTexto(p)).toEqual(['Explore: achar o kit'])
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'B', title: 'Plano B' }])
  await start($, ['B'])
  p = await painel($)
  expect(abaixo(p, 'Plano B').length, emTexto(p)).toBe(0)
  expect(p.map(l => l.titulo), emTexto(p)).not.toContain('Explore: achar o kit')
})

// O cartão vivo conferido com a lista de agentes do app (agent.list), a cada releitura de 3 s.
// `app.lista`: o que o app lista, com o estado de cada um; o teste a muda (o app deixa de listar um
// subagente, ou passa a dizê-lo terminado) e pode fazê-la falhar (`app.falha`). Os lançamentos
// devolvem os ids na ordem. Chamar antes da primeira chamada a $.
type DoApp = { lista: { id: string; type: string; description: string; status?: string }[]; falha: boolean }
function listaDoApp(on: any, ids: string[] = []): DoApp {
  const app: DoApp = { lista: [], falha: false }
  let i = 0
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: ids[i++] }))
  on('agent.list', () => {
    if (app.falha) throw new Error('lista indisponível')
    return { value: app.lista }
  })
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok' }))
  return app
}
const listado = (id: string, status?: string) => ({ id, type: 'Explore', description: `subagente ${id}`, ...(status !== undefined ? { status } : {}) })
const pilula = (p: any[]) => p.filter(l => l.cabecalho).map(l => l.texto).join('\n')
// O trio "1/3, 2/3, 3/3" depende de o kit rodar os testes deste arquivo em ordem, no mesmo processo:
// o 1/3 grava no store abaixo e os seguintes (módulo novo, state vazio: outro processo) leem dele.
const SEM_FIM: Record<string, unknown> = {}
const gravou = (store: Record<string, unknown>) => Object.keys(store).some(k => k.startsWith('session:'))

// Regra: subagentes.sem-fim-vira-interrompido
test('subagente em segundo plano e o processo novo, 1/3: o cartão vivo vai ao store', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  armazem(on, SEM_FIM)
  const app = listaDoApp(on, ['sub-1'])
  app.lista = [listado('sub-1', 'running')]
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await relogio.advance(2000)
  await chamadaDoSubagente($, 'sub-1', 'Read', { file_path: 'C:/x/kit/leitura.ts' })
  await done($, ['1'], 'Lançado em segundo plano')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('em segundo plano')
  expect(gravou(SEM_FIM), JSON.stringify(Object.keys(SEM_FIM))).toBe(true)
})

// Regra: subagentes.vivo-de-verdade-segue-vivo
test('subagente em segundo plano e o processo novo, 2/3: o worker de hooks volta com ele ainda listado como rodando, e o cartão segue vivo', async ($: any, on: any) => {
  const { relogio } = fixar(on, { agora: AGORA + 60_000 })
  armazem(on, SEM_FIM)
  host(on, [])
  const app = listaDoApp(on)
  app.lista = [listado('sub-1', 'running')]
  if (!gravou(SEM_FIM)) throw new Error('rode o trio inteiro: o 1/3 não gravou')
  // Sem session.start: o painel volta do store no primeiro uso, e a releitura recomeça com o desenho.
  let p = await painel($)
  expect(linha(p, 'Explore: varrer o repo').texto, emTexto(p)).toContain('em segundo plano')
  for (let i = 0; i < 3; i++) await relogio.advance(3000)
  p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: varrer o repo')
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('em segundo plano')
  expect(pilula(p)).toContain('▸ 1')
})

// Regra: subagentes.sem-fim-vira-interrompido
test('subagente em segundo plano e o processo novo, 3/3: o app reiniciado não o lista mais, e o cartão fica "interrompido", com o tempo parado e fora da pílula', async ($: any, on: any) => {
  const { relogio } = fixar(on, { agora: AGORA + 3_600_000 })
  armazem(on, SEM_FIM)
  host(on, [])
  listaDoApp(on)
  if (!gravou(SEM_FIM)) throw new Error('rode o trio inteiro: o 1/3 não gravou')
  await iniciarSessao($)
  await relogio.advance(3000)
  let p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: varrer o repo')
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('interrompido')
  expect(linha(p, 'Explore: varrer o repo').texto).not.toContain('em segundo plano')
  expect(linha(p, 'Explore: varrer o repo').estado).toBe('interrompida')
  // O tempo para no último sinal dele (a chamada, 2 s depois do lançamento), não na hora do reinício.
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('0:02')
  expect(pilula(p)).not.toContain('▸')
  expect(linha(p, 'Investigar').estado).toBe('concluida')
  await relogio.advance(5000)
  p = await painel($)
  expect(linha(p, 'Explore: varrer o repo').texto, emTexto(p)).toContain('0:02')
})

// Regra: subagentes.sem-fim-vira-interrompido, subagentes.pai-reflete-falha-ou-interrupcao, subagentes.pai-conclui-no-fim-do-turno
test('com o turno terminado, o subagente que o app passa a listar como parado ou concluído encerra o cartão, e a tarefa de origem reflete o fim', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  const app = listaDoApp(on, ['s1', 's2'])
  app.lista = [listado('s1', 'running'), listado('s2', 'running')]
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1', '2'])
  await lancar($, { descricao: 'um', segundoPlano: true })
  await lancar($, { descricao: 'dois', segundoPlano: true })
  await fimDoTurno($)
  let p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: um')
  expect(abaixo(p, 'Outra').map(l => l.titulo), emTexto(p)).toContain('Explore: dois')
  // O fim de nenhum dos dois chega ao painel; o app passa a listá-los como parado e como concluído.
  app.lista = [listado('s1', 'killed'), listado('s2', 'completed')]
  await relogio.advance(3000)
  await relogio.advance(3000)
  p = await painel($)
  expect(linha(p, 'Explore: um').texto, emTexto(p)).toContain('interrompido')
  expect(linha(p, 'Explore: dois').texto).toContain('concluído')
  expect(linha(p, 'Investigar').estado).toBe('interrompida')
  expect(linha(p, 'Investigar').texto).toContain('interrompida')
  expect(linha(p, 'Outra').estado).toBe('concluida')
  expect(pilula(p)).not.toContain('▸')
})

// Regra: subagentes.vivo-de-verdade-segue-vivo
test('o cartão vivo não é encerrado quando a lista do app falha, vem sem o estado, ou uma só releitura deu pela falta dele', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  const app = listaDoApp(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo' })
  const vivo = async (caso: string) => {
    const p = await painel($)
    expect(linha(p, 'Explore: varrer o repo').texto, `${caso}\n${emTexto(p)}`).toContain('trabalhando')
    expect(pilula(p), caso).toContain('▸ 1')
  }
  // A lista falha: nada é encerrado, por mais releituras que passem.
  app.falha = true
  for (let i = 0; i < 3; i++) await relogio.advance(3000)
  await vivo('a lista falha')
  // A lista não diz o estado (um app anterior): listado é vivo.
  app.falha = false
  app.lista = [listado('sub-1')]
  for (let i = 0; i < 3; i++) await relogio.advance(3000)
  await vivo('lista sem estado')
  // Uma só releitura sem ele (recém-lançado, lista lida na hora errada), e ele volta a ser listado.
  app.lista = []
  await relogio.advance(3000)
  await vivo('uma releitura sem ele')
  app.lista = [listado('sub-1', 'running')]
  await relogio.advance(3000)
  app.lista = []
  await relogio.advance(3000)
  await vivo('a falta não foi seguida')
  // Só a falta vista em duas releituras seguidas encerra.
  await relogio.advance(3000)
  const p = await painel($)
  expect(linha(p, 'Explore: varrer o repo').texto, emTexto(p)).toContain('interrompido')
})

// Regra: subagentes.vivo-de-verdade-segue-vivo
test('os agentes de um workflow e o que um deles lança, que o app não lista, não são encerrados pela lista', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  listaDoApp(on, ['w1', 'w2', 'n1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o diff', run: 'wf_1' })
  await lancar($, { descricao: 'ler os testes', run: 'wf_1' })
  await lancar($, { descricao: 'achar o kit', pai: 'w1' })
  for (let i = 0; i < 4; i++) await relogio.advance(3000)
  // A linha do agente que lançou outro, aberta: o cartão dele, com o do que ele lançou.
  const m = await montar($)
  await m.recolher('Explore: ler o diff')
  const p = await m.linhas()
  await m.fim()
  expect(linha(p, 'Workflow · 2 agentes').texto, emTexto(p)).toContain('2 trabalhando')
  expect(linha(p, 'Explore: achar o kit').texto, emTexto(p)).toContain('trabalhando')
})

// O trio do workflow: como o de cima, com o store abaixo.
const WF_SEM_SINAL: Record<string, unknown> = {}

// Regra: subagentes.workflow-sem-sinal-vira-interrompido
test('agentes de workflow e o processo novo, 1/3: os cartões vivos vão ao store', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  armazem(on, WF_SEM_SINAL)
  listaDoApp(on, ['w1', 'w2'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o diff', run: 'wf_1' })
  await lancar($, { descricao: 'ler os testes', run: 'wf_1' })
  await relogio.advance(2000)
  await chamadaDoSubagente($, 'w1', 'Read', { file_path: 'C:/x/kit/leitura.ts' })
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Workflow · 2 agentes').texto, emTexto(p)).toContain('2 trabalhando')
  expect(gravou(WF_SEM_SINAL), JSON.stringify(Object.keys(WF_SEM_SINAL))).toBe(true)
})

// Regra: subagentes.workflow-sem-sinal-vira-interrompido, subagentes.vivo-de-verdade-segue-vivo
test('agentes de workflow e o processo novo, 2/3: com sinal há 20 minutos, os cartões seguem vivos', async ($: any, on: any) => {
  const { relogio } = fixar(on, { agora: AGORA + 20 * 60_000 })
  armazem(on, WF_SEM_SINAL)
  host(on, [])
  listaDoApp(on)
  if (!gravou(WF_SEM_SINAL)) throw new Error('rode o trio inteiro: o 1/3 não gravou')
  await iniciarSessao($)
  await relogio.advance(3000)
  await relogio.advance(3000)
  const p = await painel($)
  expect(linha(p, 'Workflow · 2 agentes').texto, emTexto(p)).toContain('2 trabalhando')
  expect(pilula(p)).toContain('▸ 2')
})

// Regra: subagentes.workflow-sem-sinal-vira-interrompido
test('agentes de workflow e o processo novo, 3/3: sem sinal há mais de 30 minutos, os cartões ficam "interrompido" e a tarefa de origem reflete o fim', async ($: any, on: any) => {
  const { relogio } = fixar(on, { agora: AGORA + 31 * 60_000 })
  armazem(on, WF_SEM_SINAL)
  host(on, [])
  listaDoApp(on)
  if (!gravou(WF_SEM_SINAL)) throw new Error('rode o trio inteiro: o 1/3 não gravou')
  await iniciarSessao($)
  await relogio.advance(3000)
  const p = await painel($)
  expect(linha(p, 'Workflow · 2 agentes').texto, emTexto(p)).toContain('interrompido')
  expect(linha(p, 'Workflow · 2 agentes').texto).not.toContain('trabalhando')
  expect(pilula(p)).not.toContain('▸')
  expect(linha(p, 'Investigar').estado).toBe('interrompida')
})
