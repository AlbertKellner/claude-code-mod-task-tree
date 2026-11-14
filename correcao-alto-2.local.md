# Correção do achado alto nº 2: o trabalho atual não segue a renomeação do nível 1 (cartão solto)

Plano de 2026-11-10. Só leitura no repositório (branch `fix/achados-altos-auditoria`, HEAD `90680aa`,
com o achado 1 já commitado). Auditoria: `auditoria-mod-task-tree.local.md`, item 2 dos 13 de
severidade alta e o achado detalhado "O trabalho atual (work) não acompanha a renomeação do nível 1"
(seção "Sessões filhas e cartões"). Plano irmão: `correcao-alto-1.local.md` (passo 7 bloqueado).

**Resumo:** o achado tem duas metades.
- **Sentido inverso** (pedido antigo todo concluído que fica à vista): já corrigido no `90680aa`
  (`joinWork` tira os ids renomeados da avaliação; teste `pedidos.id-reusado-nao-segura-pedido-concluido`).
- **Cartão solto** (pedido antigo com cartão vivo sai de vista): há uma correção **parcial sem
  decisão**, que não muda teste selado, cenário decidido nem golden: a cópia renomeada segura o
  pedido antigo à vista **só por um cartão de sessão com tarefa aberta**. Cobre o caso do print
  (filha que usa o painel, com tarefa aberta, sob a tarefa abandonada). Ensaiada: 169 de 169 testes
  passam, golden inclusive; `tsc` e os dois `validate` passam. Os dois testes novos falham em HEAD.
- **Resto, que continua dependendo da decisão do passo 7 do achado 1:** sessão trabalhando sem tarefa
  própria aberta, ou só carta na fila, sob a cópia abandonada. É exatamente o teste selado
  `envios.test.ts` "a mensagem de um plano interrompido fica cinza depois da entrega": ali o pedido
  antigo vai para "+1 pedidos anteriores" e o cartão fica solto. Ver a seção 6 (pergunta).

## 1. Causa (estado em HEAD 90680aa)

- `task-tree/hooks/tools.ts:106-114`: em trabalho novo (`fresh0`), `kept` é vazio e `joinWork` recebe
  `renamed`. `task-tree/hooks/panel.ts:610-625`: `joinWork` avalia `openInSight` só com os ids **não**
  renomeados (`before`). A cópia antiga (`tag:id`) nunca é avaliada nem entra no trabalho.
- Logo, quando o pedido antigo só tinha o nível 1 reusado, ele sai do trabalho mesmo com cartão vivo
  sob a cópia antiga (`renameAnchors`, `panel.ts:643-657`, já levou a âncora para `tag:…`).
  `trimToWork` (`draw/layout.ts:723-760`) corta o pedido e `alive`/`loosen` (`layout.ts:716-722`)
  desenham o cartão solto no fim, "· do pedido '<título>'".
- Antes do `90680aa` era igual: `openInSight` com o id cru via a tarefa nova aberta, mas o trabalho
  guardava o id cru (a nova), e a cópia antiga também ficava de fora.
- Se o pedido antigo tem outro nível 1 ainda aberto (não reusado), `before` já o segura e o turno
  inteiro fica à vista, com o cartão sob a cópia antiga. Esse caso já funciona.

## 2. Por que a tradução inteira (passo 7) não serve sem decisão, e o que separa os casos

- Traduzir o trabalho (`cur.map(id => renamed.includes(id) ? tag:id : id)`) faz `openInSight` avaliar a
  cópia com **todos** os critérios: tarefa aberta, ✉ na fila (`!taken`) e sessão `live`
  (rodando/aguardando) ou com rodada de tarefa aberta (`holds`).
- Ensaio nesta rodada (cópia `scratchpad\alto2\repo`, HEAD + tradução + teste do cartão): 167 de 168,
  falha só `envios.test.ts::a mensagem de um plano interrompido fica cinza depois da entrega` (selado
  `decisao`, 2026-11-04, `envios.cor-por-estado`): `comHistorico($, 1)` não acha "+1 pedidos anteriores".
- O que segura a vista nesse teste: a sessão `local_x` está rodando (o `host` do kit devolve
  `isRunning: true`) e a carta ainda está na fila na hora do `plan`. A sessão **não publica painel**
  (sem tarefa própria).
- No caso do print, a filha usa o painel e tem tarefa própria aberta.
- Critério que separa os dois sem tocar no teste selado: **só um cartão com tarefa aberta segura a
  cópia renomeada**; sessão trabalhando sem tarefa e carta na fila não seguram. Para ids não
  renomeados, nada muda (`openInSight` com todos os critérios, como hoje).

### Isso contradiz alguma decisão registrada?

Conferido contra o catálogo:
- `pedidos.resumida-mantem-anteriores-com-algo-aberto` ("pedido anterior com algo aberto à vista… o
  painel mantém os dois"): a correção aplica a regra a mais um caso. Não desfaz nada.
- `sessoes.cartao-vivo-nunca-some` e o comentário de `trimToWork` ("uma sessão ainda trabalhando sob
  um pedido **fora do trabalho** não traz o pedido de volta"): falam do pedido que já saiu. Aqui o
  pedido nunca sai, porque a decisão é tomada no `joinWork`, na hora do plan. O cartão solto continua
  valendo para o pedido que sai.
- `pedidos.plano-anterior-vira-historico`: segue igual. O antigo é interrompido e renomeado, e o
  "Então" diz "(em '+N pedidos anteriores')". O teste selado dele não tem cartão e continua passando.
  Com cartão aberto, o histórico fica à vista em vez de ir para a linha "+N". É a mesma combinação que
  já existe quando o pedido antigo tem outro nível 1 aberto (seção 1, último item). Não é decisão nova.
- `envios.cor-por-estado` (teste selado): passa, e o caso dele continua como hoje.

A distinção "com tarefa própria aberta" contra "só trabalhando" não tem palavras do usuário. Ela só
existe porque o teste selado fixa o outro caso. Por isso fica registrada como limite na seção 7, e o
resto vai na pergunta da seção 6, junto com o passo 7 do achado 1.

## 3. Correção passo a passo

Tudo de uma vez (recarga a quente): escrever numa cópia no scratchpad, copiar os arquivos juntos e
rodar `npm run check` antes do commit. A cópia ensaiada é
`<scratchpad>\alto2\repo2`,
com o diff do código em `...\scratchpad\alto2\alto2.diff`. Ela tem os testes com o prefixo "ENSAIO"
no nome e a regra provisória: no repositório, usar os nomes e a regra abaixo.

### Passo 1: `task-tree/hooks/tools.ts:113`

```ts
      const kept = fresh0 ? [] : renamed.filter(id => (cur as string[]).includes(id)).map(id => `${tag}:${id}`)
      const moved = fresh0 ? renamed.filter(id => (cur as string[]).includes(id)).map(id => `${tag}:${id}`) : []
      await joinWork($, [...ids, ...kept], fresh0, renamed, moved)
```

Comentário acima (substitui o de `tools.ts:110-111`): "A closed level-1 task of the current work
renamed by this plan stays in it. In new work, the renamed ids leave the check of what holds the view,
and their old copies (`moved`) are checked apart (joinWork)."

### Passo 2: `task-tree/hooks/panel.ts`, `joinWork` (linhas 610-625) e import (linha 12)

```ts
import { MAIN, flat, withMain, interrupt, total, activeLeaves, current, openInSight, startedLast, hasOpen, allTasks, panelOf } from '../draw/layout'
...
export async function joinWork($: any, ids: string[], fresh: boolean, renamed: string[] = [], moved: string[] = []) {
  ...
  const before = (cur as string[]).filter(id => !renamed.includes(id))
  const kept = openInSight({ groups: withMain(groups as Group[]), waits: [], children }, before, sends as Send[], knownId()) ? before : []
  // The old copy of a renamed level-1 task (`moved`) holds its request only through a card with an
  // open task of its own; a session at work with no task, or a queued letter, does not (a queued
  // letter of an abandoned plan goes to "+N pedidos anteriores", envios.cor-por-estado).
  const cards = (children as Child[]).filter(c => hasOpen(allTasks(panelOf(c), 1)))
  const held = moved.length > 0 && openInSight({ groups: withMain(groups as Group[]), waits: [], children: cards }, moved, [], knownId())
  await setWork($, [...new Set([...kept, ...(held ? moved : []), ...ids])])
}
```

- `sends` vazio tira a carta da avaliação. `cards` deixa só as sessões com tarefa aberta (o
  `panelOf` já lê como interrompidas as iniciadas de uma sessão parada). O `holds` de `openInSight`
  continua descartando a rodada descartada e a assentada.
- `draw/layout.ts` não muda: o impacto fica em `hooks/` (66 cenários, golden nenhum; com `layout.ts`
  seriam mais de 100, golden inteiro).
- `startTool` (`tools.ts:223`) segue sem os parâmetros novos.

### Passo 3: cenário novo em `regras/pedidos.md`, depois de `pedidos.id-reusado-nao-segura-pedido-concluido`

```markdown
### pedidos.id-reusado-segura-pedido-com-cartao-aberto
O pedido anterior cujo nível 1 foi reusado segue à vista enquanto um cartão com tarefa aberta pende da cópia antiga.

- Dado um nível 1 aberto de um pedido anterior, com uma sessão filha aberta de uma tarefa dele (ou que recebeu mensagem dela) e com tarefa própria aberta
- Quando um pedido novo traz plan com o mesmo id
- Então o antigo vira histórico como em pedidos.plano-anterior-vira-historico, mas o pedido anterior segue à vista, acima do novo, com o cartão e a carta sob a tarefa de origem, nunca soltos; o nível 1 novo nasce ○ sob o pedido novo. Sessão trabalhando sem tarefa própria aberta, ou só carta na fila, não segura (envios.cor-por-estado)

Origem: auditoria 2026-11-10 (o trabalho atual não acompanha a renomeação do nível 1, cartão solto); aplica pedidos.resumida-mantem-anteriores-com-algo-aberto à cópia renomeada, sem mudar pedidos.plano-anterior-vira-historico nem envios.cor-por-estado.
Código: hooks/panel.ts, hooks/tools.ts
Estado: coberto
```

Nenhum cenário existente é reescrito.

### Passo 4: testes novos em `task-tree/tests/sessoes.test.ts`, no fim

Usam só o que o arquivo já importa e define (`abrir`, `tarefa`, `A`, `K1`, `fixar`, `host`,
`responderEnvio`, `envio`, `abrirSessao`, `fimDoTurno`, `cartoes`, `linha`, `esperarEstado`, `AGORA`).
Os dois falham em HEAD (cartão solto e "+1 pedidos anteriores") e passam com os passos 1 e 2.

```ts
// Regra: pedidos.id-reusado-segura-pedido-com-cartao-aberto
test('plan que reusa o id do nível 1 num pedido novo deixa o cartão com tarefa aberta sob a tarefa de origem, com o pedido antigo à vista', async ($: any, on: any) => {
  await abrir($, on, { painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } })
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, [
    { id: 'A', title: 'Plano A de novo', children: [{ id: '1', title: 'Um de novo' }, { id: '2', title: 'Dois de novo', children: [{ id: '2.1', title: 'Dois.um de novo' }] }] },
    { id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Bê um' }] },
  ])
  await aviso($)
  const p = await painel($)
  expect(p.some(l => l.titulo.startsWith('filha-um · do pedido')), emTexto(p)).toBe(false)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  expect(p.some(l => l.titulo === 'Pedido um'), emTexto(p)).toBe(true)
  expect(p.some(l => / pedidos anteriores$/.test(l.titulo)), emTexto(p)).toBe(false)
  expect(p.indexOf(linha(p, 'Pedido um')), emTexto(p)).toBeLessThan(p.indexOf(linha(p, 'Pedido dois')))
  esperarEstado(p, 'Um de novo', 'pendente')
  esperarEstado(p, 'Plano A de novo', 'pendente')
})

// Regra: pedidos.id-reusado-segura-pedido-com-cartao-aberto
test('com carta: o id reusado num pedido novo deixa cartão e carta sob a tarefa de origem, e a carta fica cinza depois da entrega', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await envio($, K1)
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ ...A[0]!, title: 'Plano A novo' }])
  h.recebeu(K1, AGORA + 1500)
  await aviso($)
  const p = await painel($)
  expect(p.some(l => l.titulo.startsWith('filha-um · do pedido')), emTexto(p)).toBe(false)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  expect(p.some(l => / pedidos anteriores$/.test(l.titulo)), emTexto(p)).toBe(false)
  const cartas = p.filter(l => l.titulo.startsWith('Para ') && l.carta !== undefined)
  expect(cartas.map(l => l.carta), emTexto(p)).toEqual(['interrompida'])
})
```

O segundo espelha o teste selado de `envios` com uma filha que tem tarefa aberta. A carta continua
cinza ("interrompida", `envios.cor-por-estado`), agora à vista, sob a cópia antiga.

### Passo 5: selos

```
npm run regras:selar -- "task-tree/tests/sessoes.test.ts::plan que reusa o id do nível 1 num pedido novo deixa o cartão com tarefa aberta sob a tarefa de origem, com o pedido antigo à vista" --tipo novo --motivo "auditoria 2026-11-10, achado alto 2"
npm run regras:selar -- "task-tree/tests/sessoes.test.ts::com carta: o id reusado num pedido novo deixa cartão e carta sob a tarefa de origem, e a carta fica cinza depois da entrega" --tipo novo --motivo "auditoria 2026-11-10, achado alto 2"
```

Nenhum teste existente muda, e o kit também não (nenhum selo de kit).

### Passo 6: `npm run check`, um commit local e o relato

Commit sugerido: `fix(task-tree): id reusado num pedido novo não solta o cartão com tarefa aberta`.
Corpo: a cópia renomeada do nível 1 segura o pedido antigo à vista quando um cartão com tarefa aberta
pende dela; sessão sem tarefa ou só carta na fila seguem como hoje (decisão pendente). O relato traz
`npm run testes:alterados` (esperado: nenhum) e `npm run impacto` sobre o diff real.

## 4. `npm run impacto -- task-tree/hooks/tools.ts task-tree/hooks/panel.ts`

Rodado no repositório (só leitura): 66 cenários afetados, todos `coberto`. São os mesmos 72 do plano
do achado 1 menos os 7 de `lembretes.*` (o `rules.ts` fica fora), mais
`pedidos.id-reusado-nao-segura-pedido-concluido`. **Checklist do app: nenhum. Golden: nenhum
cenário. Fora do mapa: nenhum.** O check roda todos os testes. A saída completa sai do mesmo comando.

## 5. Ensaio (scratchpad `alto2`)

| Cópia | Conteúdo | `plugin test` |
|---|---|---|
| `head` | HEAD 90680aa + os 2 testes novos | 167 de 169: falham os 2 novos (o bug reproduzido) |
| `repo` | HEAD + tradução inteira (passo 7 do achado 1) + teste 1 | 167 de 168: falha o selado `envios.test.ts::a mensagem de um plano interrompido fica cinza depois da entrega` |
| `repo2` | HEAD + passos 1 e 2 + os 2 testes novos | **169 de 169**, golden inclusive |

Em `repo2` também passaram os dois `claude plugin validate … --strict` e `npx tsc --noEmit -p task-tree`
(com os tipos gerados copiados do repositório). Não rodaram as etapas `regras`, `travas`, `selos` e
`regressao`, que precisam do git e do catálogo atualizado: elas ficam para o `npm run check` da
implementação. Binário: `%APPDATA%\Claude\claude-code\2.1.321\…\claude.exe`.

## 6. BLOQUEIO (só o resto do achado; o mesmo do passo 7 do achado 1)

O que fica igual a hoje sem decisão: **uma sessão trabalhando sem tarefa própria aberta (que não
publica painel, ou ainda não planejou), ou só uma carta na fila, sob a cópia antiga de um nível 1
reusado num pedido novo.** O pedido antigo vai para "+N pedidos anteriores", a carta vai junto, e o
cartão vivo sai solto no fim (`sessoes.cartao-vivo-nunca-some`). É o caso fixado pelo teste selado
`task-tree/tests/envios.test.ts:33-52` (`envios.cor-por-estado`, decisões de 2026-10-24, 2026-10-30 e
2026-11-04).

Pergunta ao usuário (pode ir junto com a do achado 1, porque é a mesma decisão):

> **Num pedido novo, o modelo planeja de novo com o id de um nível 1 ainda aberto do pedido anterior.
> Sob a tarefa antiga há uma sessão filha trabalhando ou uma carta na fila, mas sem tarefa própria
> aberta no painel. O pedido anterior fica à vista?**
> - **Sim, fica à vista enquanto a sessão trabalha ou a carta está na fila (Recomendada).** No painel:
>   o pedido anterior aparece inteiro acima do novo, com o histórico renomeado (✕/✓), o cartão sob a
>   tarefa de origem, não solto, e a carta sob ela (azul na fila, depois cinza "interrompida"); não
>   aparece a linha "+N pedidos anteriores" até a sessão parar e a carta ser entregue. É a mesma regra
>   de quando o nível 1 não é reusado. Muda o teste selado de `envios` (`comHistorico($, 1)` vira
>   `painel($)`, selo `--tipo decisao`, `envios.cor-por-estado` ganha `Reescrito:`) e entra a tradução
>   do passo 7 do achado 1 no lugar do filtro `cards` deste plano.
> - **Não, como hoje.** No painel: o pedido anterior vai para "+N pedidos anteriores" com a carta, e o
>   cartão da sessão aparece solto no fim, "· do pedido '<título>'". Só o cartão com tarefa aberta (este
>   plano) segura o pedido.

## 7. Riscos e limites

- **Decidido no momento do plan.** Se a filha ainda não publicou tarefa aberta quando a mãe planeja
  (acabou de receber a mensagem e não planejou), o pedido antigo sai e não volta (`trimToWork`: o
  pedido fora do trabalho não volta); o cartão fica solto como hoje. A recomendação "Sim" da seção 6
  fecha esse caso.
- **Distinção sem palavras do usuário.** "Com tarefa própria aberta" contra "só trabalhando" só existe
  por causa do teste selado. Se o usuário responder "Sim", o filtro `cards` sai e fica a tradução
  inteira.
- **O que o pedido antigo mostra.** Com o cartão segurando, o pedido antigo fica inteiro à vista,
  inclusive os outros níveis 1 concluídos dele (o turno inteiro, `trimToWork`). É o mesmo que já
  acontece com algo aberto num nível 1 não reusado.
- **Estado do "Um" antigo.** Pode aparecer ◉ enquanto a filha trabalha
  (`sessoes.filha-trabalhando-mantem-pais-em-andamento`) em vez de ✕. Os testes não afirmam isso; vale
  olhar no app.
- **Leitura fora do `update`.** `moved` herda a janela de `renamed` (achado médio "plan decide o que
  renomear numa leitura feita fora do update"), sem piorar.
- **Checklist do app.** Nada de pintura muda. Vale ver numa sessão real: a orquestradora com filha
  trabalhando (com painel) reusa o id do nível 1 num relato novo, e o cartão fica sob a tarefa de
  origem, sem "· do pedido".
- **Não verificado:** `regras`, `travas`, `selos` e `regressao` do check, e o app.

## 8. Arquivos tocados

- `task-tree/hooks/tools.ts` (a chamada de `joinWork` e o comentário)
- `task-tree/hooks/panel.ts` (o import e `joinWork`)
- `task-tree/tests/sessoes.test.ts` (2 testes novos)
- `regras/pedidos.md` (1 cenário novo)
- `regras/selos.json` (2 selos `novo`)
- Fora: `draw/layout.ts`, o kit, o golden, os testes existentes e `text/rules.ts`.
