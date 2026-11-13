import { expect, test } from 'claude-code/testing'
import { host, subagente } from './kit/ambiente'
import { fimDoSubagente } from './kit/cenario'
import { linha as umaLinha } from './kit/leitura'
import { fixar } from './kit/ambiente'
import { done, esc, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'
import { emTexto, esperarEstado, painel } from './kit/leitura'
import { aviso } from './kit/cenario'
import { cabecalho, type Linha } from './kit/leitura'

// Pai aberto no meio e no fim do turno. Origem: decisão do usuário de 2026-10-27 (◉ só no caminho
// da última tarefa iniciada no turno atual) sobre a regra "Pai aguardando" de 2026-10-20.

const A: No[] = [
  { id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois', children: [{ id: '2.1', title: 'Dois.um' }, { id: '2.2', title: 'Dois.dois' }] }] },
]
const B: No[] = [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Bê um' }, { id: 'b2', title: 'Bê dois' }] }]

// Regra: arvore.sem-start-nada-acende
test('sem start, plano novo fica todo pendente', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  const p = await painel($)
  for (const t of ['Pedido um', 'Plano A', 'Um', 'Dois', 'Dois.um', 'Dois.dois']) esperarEstado(p, t, 'pendente')
})

// Regra: turnos.pai-e-pedido-aguardam-no-fim, turnos.pendentes-seguem-pendentes
test('no fim do turno o pai aberto e o pedido ficam aguardando', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await fimDoTurno($)
  const p = await painel($)
  esperarEstado(p, 'Pedido um', 'aguardando')
  esperarEstado(p, 'Plano A', 'aguardando')
  esperarEstado(p, 'Dois', 'pendente')
  esperarEstado(p, 'Dois.um', 'pendente')
  esperarEstado(p, 'Dois.dois', 'pendente')
  expect(emTexto(p)).toContain('1 de 3')
  expect(emTexto(p)).not.toContain('interrompida')
})

// Regra: turnos.iniciada-aguarda-no-fim
test('no fim do turno a tarefa iniciada e aberta fica aguardando, e o pai também', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2.1'])
  await fimDoTurno($)
  const p = await painel($)
  esperarEstado(p, 'Dois.um', 'aguardando')
  esperarEstado(p, 'Dois', 'aguardando')
  esperarEstado(p, 'Plano A', 'aguardando')
})

// Regra: turnos.pedido-anterior-parado-aguarda
test('pedido anterior parado segue aguardando enquanto o pedido novo está em andamento', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, B)
  await start($, ['b1'])
  const p = await painel($)
  esperarEstado(p, 'Pedido dois', 'andamento')
  esperarEstado(p, 'Plano B', 'andamento')
  esperarEstado(p, 'Plano A', 'aguardando')
  esperarEstado(p, 'Pedido um', 'aguardando')
})

// Regra: turnos.continuacao-sem-start-aguarda
test('prompt novo que continua o plano, antes do start, deixa o pai aguardando', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'continua')
  const p = await painel($)
  esperarEstado(p, 'Plano A', 'aguardando')
  esperarEstado(p, 'Pedido um', 'aguardando')
})

// Pendentes nunca ✕ no fim do turno. Origem: decisão do usuário de 2026-10-27, que desfaz
// "reaproveitar o interrompida" (2026-10-24).

// Regra: turnos.pendentes-seguem-pendentes
test('fim do turno sem nenhum start deixa tudo pendente, sem nada interrompido', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await fimDoTurno($)
  const p = await painel($)
  for (const t of ['Pedido um', 'Plano A', 'Um', 'Dois', 'Dois.um', 'Dois.dois']) esperarEstado(p, t, 'pendente')
})

// Regra: turnos.iniciada-aguarda-no-fim, turnos.pendentes-seguem-pendentes
test('fim do turno com uma tarefa iniciada: ela aguarda e as outras seguem pendentes', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await fimDoTurno($)
  const p = await painel($)
  esperarEstado(p, 'Um', 'aguardando')
  for (const t of ['Dois', 'Dois.um', 'Dois.dois']) esperarEstado(p, t, 'pendente')
  esperarEstado(p, 'Plano A', 'aguardando')
  esperarEstado(p, 'Pedido um', 'aguardando')
})

// Regra: turnos.esc-interrompe-so-a-iniciada
test('Esc interrompe só a tarefa iniciada; as pendentes seguem pendentes', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await esc($)
  const p = await painel($)
  esperarEstado(p, 'Um', 'interrompida')
  for (const t of ['Dois', 'Dois.um', 'Dois.dois']) esperarEstado(p, t, 'pendente')
  // Sem nada feito nem aguardando embaixo, o pai e o pedido ficam abertos (○).
  esperarEstado(p, 'Plano A', 'pendente')
  esperarEstado(p, 'Pedido um', 'pendente')
})

// Regra: turnos.prompt-seguinte-retoma
test('o prompt seguinte ao fim do turno volta ao trabalho e o start acende a tarefa', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await esc($)
  await relogio.advance(1000)
  await pedido($, 'segue')
  await start($, ['2.1'])
  let p = await painel($)
  esperarEstado(p, 'Dois.um', 'andamento')
  // A que o Esc parou segue ✕ até o start nela (decisão de 2026-11-12); com ele, nada fica ✕.
  esperarEstado(p, 'Um', 'interrompida')
  await start($, ['1'])
  p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
  expect(emTexto(p)).not.toContain('✕')
})

// A parada com Esc segue ✕ até o start nela. Origem: decisão do usuário de 2026-11-12 ("Segue ✕ até
// novo start (Recomendado)"), sobre o achado da auditoria de 2026-11-10: um aviso automático, ou o
// start em outra tarefa, reacendia a parada (◉, relógio correndo, ◷ no fim do turno).
const semNadaAceso = (p: Linha[]) => expect(p.filter(l => !l.cabecalho && l.estado === 'andamento').map(l => l.titulo), emTexto(p)).toEqual([])
const PROMPTS_SEM_PEDIDO: [string, ($: any) => Promise<unknown>][] = [
  ['aviso do app', $ => aviso($)],
  ['hand-back de subagente', $ => $.prompt.submit({ text: '<agent-message from="sub-1">[Subagent hand-back] pronto</agent-message>' })],
  ['notificação de tarefa em segundo plano', $ => $.prompt.submit({ text: 'tarefa em segundo plano terminou', origin: { kind: 'task-notification' } })],
]

// Regra: turnos.parada-segue-interrompida-ate-o-start
test('depois do Esc, um prompt que não abre pedido não reacende a tarefa parada, o relógio dela não corre e o fim desse turno não a deixa aguardando', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2.1'])
  await relogio.advance(3000)
  await esc($)
  const noEsc = await painel($)
  esperarEstado(noEsc, 'Dois.um', 'interrompida')
  for (const [nome, prompt] of PROMPTS_SEM_PEDIDO) {
    await relogio.advance(5000)
    await prompt($)
    await relogio.advance(5000)
    let p = await painel($)
    expect(umaLinha(p, 'Dois.um').estado, `${nome}, no turno:\n${emTexto(p)}`).toBe('interrompida')
    semNadaAceso(p)
    // O relógio da parada, o do pai e o do pedido ficam onde o Esc os deixou.
    for (const t of ['Dois.um', 'Dois', 'Plano A', 'Pedido um']) expect(umaLinha(p, t).texto, `${nome}, no turno:\n${emTexto(p)}`).toBe(umaLinha(noEsc, t).texto)
    await fimDoTurno($)
    p = await painel($)
    expect(umaLinha(p, 'Dois.um').estado, `${nome}, no fim do turno:\n${emTexto(p)}`).toBe('interrompida')
    expect(emTexto(p), nome).not.toContain('◷')
    const c = cabecalho(p)
    // Fora da contagem, como interrompida: no cabeçalho e na sessão inteira (sem a nota do tooltip).
    expect([c.total, c.chips.interrompidas, c.chips.aguardando, c.chips.andamento, c.inteira], `${nome}:\n${emTexto(p)}`).toEqual([2, 1, 0, 0, undefined])
  }
})

// Regra: turnos.parada-segue-interrompida-ate-o-start
test('numa mensagem da pessoa em que o modelo dá start em outra tarefa, a parada com Esc segue interrompida, também no fim do turno', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2.1'])
  await esc($)
  await relogio.advance(1000)
  await pedido($, 'segue')
  await start($, ['1'])
  let p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
  esperarEstado(p, 'Dois.um', 'interrompida')
  // O pai da parada não acende com ela: só o caminho da tarefa iniciada agora.
  esperarEstado(p, 'Dois', 'pendente')
  esperarEstado(p, 'Plano A', 'andamento')
  await fimDoTurno($)
  p = await painel($)
  esperarEstado(p, 'Um', 'aguardando')
  esperarEstado(p, 'Dois.um', 'interrompida')
  expect(cabecalho(p).chips.interrompidas, emTexto(p)).toBe(1)
})

// Regra: turnos.parada-segue-interrompida-ate-o-start
test('o start na tarefa parada com Esc a reacende e ela volta a contar; no fim do turno aguarda como qualquer outra', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2.1'])
  await esc($)
  await relogio.advance(1000)
  await aviso($)
  await fimDoTurno($)
  await relogio.advance(1000)
  await aviso($)
  await start($, ['2.1'])
  let p = await painel($)
  esperarEstado(p, 'Dois.um', 'andamento')
  esperarEstado(p, 'Dois', 'andamento')
  expect(emTexto(p)).not.toContain('✕')
  expect([cabecalho(p).total, cabecalho(p).chips.andamento], emTexto(p)).toEqual([3, 1])
  await fimDoTurno($)
  p = await painel($)
  esperarEstado(p, 'Dois.um', 'aguardando')
  expect(emTexto(p)).not.toContain('✕')
})

// Regra: turnos.parada-segue-interrompida-ate-o-start
test('o done na tarefa parada com Esc, sem start, a conclui', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2.1'])
  await esc($)
  await relogio.advance(1000)
  await pedido($, 'segue')
  const r = await done($, ['2.1'])
  expect(r.erro, r.texto).toBe(false)
  const p = await painel($)
  esperarEstado(p, 'Dois.um', 'concluida')
  expect(emTexto(p)).not.toContain('✕')
  expect([cabecalho(p).feitas, cabecalho(p).total], emTexto(p)).toEqual([1, 3])
})

// Regra: turnos.parada-segue-interrompida-ate-o-start
test('o pai iniciado e parado com Esc não reacende no prompt seguinte; o start nele o reacende', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2'])
  esperarEstado(await painel($), 'Dois', 'andamento')
  await esc($)
  await relogio.advance(1000)
  await aviso($)
  let p = await painel($)
  semNadaAceso(p)
  for (const t of ['Dois', 'Dois.um', 'Dois.dois']) esperarEstado(p, t, 'pendente')
  await fimDoTurno($)
  await pedido($, 'segue')
  await start($, ['1'])
  p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
  esperarEstado(p, 'Dois', 'pendente')
  await start($, ['2'])
  p = await painel($)
  esperarEstado(p, 'Dois', 'andamento')
  esperarEstado(p, 'Dois.um', 'andamento')
})

// Regra: turnos.parada-segue-interrompida-ate-o-start
test('o replano no mesmo pedido que mantém a tarefa parada com Esc a mantém interrompida, com o relógio parado', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2.1'])
  await relogio.advance(3000)
  await esc($)
  const noEsc = await painel($)
  await relogio.advance(5000)
  // O aviso não abre pedido: o plano com o mesmo id replaneja no lugar.
  await aviso($)
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois', children: [{ id: '2.1', title: 'Dois.um' }, { id: '2.3', title: 'Dois.três' }] }] }])
  await relogio.advance(5000)
  const p = await painel($)
  esperarEstado(p, 'Dois.um', 'interrompida')
  esperarEstado(p, 'Dois.três', 'pendente')
  semNadaAceso(p)
  for (const t of ['Dois.um', 'Dois', 'Plano A']) expect(umaLinha(p, t).texto, emTexto(p)).toBe(umaLinha(noEsc, t).texto)
})

// Regra: turnos.parada-segue-interrompida-ate-o-start
test('a marca da parada com Esc vai no painel publicado até o start nela', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2.1'])
  await esc($)
  await relogio.advance(1000)
  await aviso($)
  await fimDoTurno($)
  const publicadas = (): any[] => {
    const andar = (l: any[]): any[] => l.flatMap(t => [t, ...andar(t.children ?? [])])
    return andar((h.proprio()?.groups ?? []).find((g: any) => g.agent === '')?.tasks ?? [])
  }
  // O último turno terminou normalmente: o que diz que a tarefa foi parada é a marca nela.
  expect(h.proprio()?.aborted, JSON.stringify(h.proprio())).toBe(undefined)
  expect(publicadas().filter(t => t.stopped === true).map(t => t.title), JSON.stringify(publicadas())).toEqual(['Dois.um'])
  await aviso($)
  await start($, ['2.1'])
  expect(publicadas().filter(t => t.stopped === true).map(t => t.title), JSON.stringify(publicadas())).toEqual([])
})

// Regra: turnos.subagente-que-termina-interrompe
test('o subagente que termina deixa interrompido o que ficou aberto, e o pai com filha concluída aguarda', async ($: any, on: any) => {
  fixar(on)
  subagente(on, 'sub-1')
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await plan($, [{ id: 'S', title: 'Plano do sub', children: [{ id: 's1', title: 'Sub um' }, { id: 's2', title: 'Sub dois' }, { id: 's3', title: 'Sub três' }] }], undefined, 'sub-1')
  await start($, ['s1'], 'sub-1')
  await done($, ['s1'], undefined, 'sub-1')
  await start($, ['s2'], 'sub-1')
  await fimDoSubagente($, 'sub-1')
  const p = await painel($)
  esperarEstado(p, 'Sub um', 'concluida')
  esperarEstado(p, 'Sub dois', 'interrompida')
  esperarEstado(p, 'Sub três', 'interrompida')
  esperarEstado(p, 'Plano do sub', 'concluida')
  esperarEstado(p, 'Um', 'andamento')
})

// Regra: turnos.subagente-que-termina-interrompe
test('o subagente lançado sem tarefa de origem que termina segue desenhado', async ($: any, on: any) => {
  fixar(on)
  subagente(on, 'sub-1')
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await plan($, [{ id: 'S', title: 'Plano do sub', children: [{ id: 's1', title: 'Sub um' }] }], undefined, 'sub-1')
  await start($, ['s1'], 'sub-1')
  await done($, ['s1'], undefined, 'sub-1')
  await fimDoSubagente($, 'sub-1')
  const p = await painel($)
  expect(p.some(l => l.texto.includes('sub-1') || l.titulo === 'Plano do sub'), emTexto(p)).toBe(true)
})

// Regra: turnos.prompt-sem-turno
test('o hand-back de um subagente não abre pedido: o plano seguinte entra no pedido atual', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await $.prompt.submit({ text: '<agent-message from="sub-1">[Subagent hand-back] pronto</agent-message>' })
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'b1' }] }])
  const p = await painel($)
  expect(p.filter(l => l.nivel === 0 && l.estado !== undefined).map(l => l.titulo), emTexto(p)).toEqual(['Pedido um'])
  expect(umaLinha(p, 'Plano B').nivel, emTexto(p)).toBe(umaLinha(p, 'Plano A').nivel)
})

// Regra: turnos.notificacao-de-tarefa-sem-turno
test('a notificação de uma tarefa em segundo plano não abre pedido', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await $.prompt.submit({ text: 'tarefa em segundo plano terminou', origin: { kind: 'task-notification' } })
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'b1' }] }])
  const p = await painel($)
  expect(p.filter(l => l.nivel === 0 && l.estado !== undefined).map(l => l.titulo), emTexto(p)).toEqual(['Pedido um'])
})

// Regra: turnos.resumo-sem-resposta-final
test('o ↩ aparece mesmo quando o turno termina sem texto final', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await done($, ['1'], 'Resumo X')
  await fimDoTurno($)
  const p = await painel($)
  expect(p.some(l => l.texto.includes('↩') && l.texto.includes('Resumo X')), emTexto(p)).toBe(true)
  const publicado = (h.proprio()?.groups ?? []).find((g: any) => g.agent === '')?.turns ?? []
  expect(publicado.some((u: any) => u.brief === 'Resumo X'), JSON.stringify(publicado)).toBe(true)
})


// Regra: turnos.resumo-sem-seta-duplicada
test('o ↩ que o summary já traz não se repete na linha da resposta', async ($: any, on: any) => {
  fixar(on)
  host(on, [])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await done($, ['1'], '↩ Resumo Y')
  await fimDoTurno($)
  const p = await painel($)
  const linha = p.find(l => l.texto.includes('Resumo Y'))
  expect(linha?.texto.includes('↩ ↩'), emTexto(p)).toBe(false)
  expect(linha?.texto.includes('↩'), emTexto(p)).toBe(true)
})
