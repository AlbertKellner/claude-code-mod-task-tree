import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host, lancaveis, responderEnvio } from './kit/ambiente'
import { abrirSessao, aviso, chamadaDoSubagente, done, envio, fimDoSubagente, fimDoSubagenteCom, fimDoTurno, lancar, pedido, plan, start, type No } from './kit/cenario'
import { cabecalho, emTexto, linha, painel } from './kit/leitura'

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
