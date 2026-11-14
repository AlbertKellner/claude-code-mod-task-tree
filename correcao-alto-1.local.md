# Correção do achado alto nº 1: replanejar numa mensagem seguinte zera o estado

Plano de 2026-11-10, só leitura no repositório (branch `fix/achados-altos-auditoria`, igual ao `main`
v0.14.0). Auditoria: `auditoria-mod-task-tree.local.md`, item 1 dos 13 de severidade alta, a seção
"Prioridade: cartão solto…" e o achado irmão "O trabalho atual (work) não acompanha a renomeação do
nível 1" (item 2), cuja proposta é a tradução do trabalho pedida aqui.

**Resumo:** a tradução do trabalho pelos ids renomeados, como pedida, faz o cartão seguir a tarefa,
mas quebra um teste selado (ver BLOQUEIO). O plano abaixo traz a parte que não depende de decisão:
textos verdadeiros e o sentido inverso do achado (pedido antigo todo concluído que fica à vista).
O cartão solto do caso do print continua como hoje, desenhado solto pela regra
`sessoes.cartao-vivo-nunca-some`, até o usuário decidir. Tudo foi ensaiado numa cópia no scratchpad,
com os testes do harness: 166 de 166 passam, golden inclusive.

## 1. Causa confirmada

O replano entre pedidos (decisão registrada, não muda):
- `task-tree/hooks/tools.ts:61-63`: `sameRequest` só é verdadeiro para o turno atual, e `replanned`
  exige tarefa aberta, id repetido e `sameRequest`.
- `task-tree/hooks/tools.ts:67`: o nível 1 aberto de pedido anterior com id reusado entra em `renamed`.
- `task-tree/hooks/tools.ts:76-78`: `away` interrompe o que estava aberto (✕) e renomeia (`tag:id`).
  O novo entra todo pendente no turno novo (`tools.ts:95-99`).
- Cenário `pedidos.plano-anterior-vira-historico` (regras/pedidos.md:70-80), teste selado em
  `task-tree/tests/pedidos.test.ts:51-72`.

Os textos que prometem o contrário (o bug de texto):
- `task-tree/text/rules.ts:38-42` (RULES): "Um nível 1 aberto com o mesmo id é substituído no mesmo
  lugar… guardam o estado", sem a condição da mesma mensagem.
- `task-tree/text/rules.ts:68-71` (`TOOLS.plan`): a mesma promessa.
- `task-tree/text/rules.ts:124-129` (`PROMPT.interrupted`) e `137-144` (`PROMPT.interruptedByYou`):
  mandam replanejar o nível 1 inteiro "mantendo os ids das tarefas que continuam, que guardam o
  estado", na mensagem que já abriu o turno novo (`task-tree/hooks/prompt-submit.ts:88`, `openTurn`).
  É justamente o caminho que zera o estado.

O trabalho atual não acompanha a renomeação (o bug de código):
- `task-tree/hooks/tools.ts:110-113`: em trabalho novo (`fresh0`, de `startsWork` em
  `task-tree/hooks/panel.ts:593-603`), `kept` é vazio e `joinWork` recebe o trabalho com o id cru.
- `task-tree/hooks/panel.ts:610-621`: `joinWork` chama `openInSight` com esse id cru, que depois do
  plan nomeia a tarefa nova (aberta), e não a cópia antiga.
- `task-tree/draw/layout.ts:695-710`: `openInSight` acha a tarefa nova com aquele id, aberta, e
  responde "há algo aberto". Daí o pedido anterior todo concluído continua à vista quando ele tem
  outro nível 1 no trabalho (o turno inteiro dele é mantido por `trimToWork`, `layout.ts:742-745`).
- Reproduzido no harness com o código de HEAD: o teste novo do item 4 falha e mostra "✓ Pedido um,
  ✓ Primeira, ✓ Segunda" à vista junto do pedido novo.
- O cartão: `renameAnchors` (`task-tree/hooks/panel.ts:643-657`) já leva a âncora do cartão e da
  carta para a cópia antiga. O cartão fica solto porque o pedido antigo sai do trabalho
  (`layout.ts:716-722`, `alive` e `loosen`). Ver BLOQUEIO.

## 2. BLOQUEIO

**A tradução do trabalho que faz o cartão seguir a tarefa quebra um teste selado.**

- Teste: `task-tree/tests/envios.test.ts:33-52`, "a mensagem de um plano interrompido fica cinza
  depois da entrega", regra `envios.cor-por-estado` (decisões do usuário de 2026-10-24, 2026-10-30
  e 2026-11-04).
- Ensaio: a tradução (`cur.map(id => renamed.includes(id) ? tag:id : id)` gravada antes do
  `joinWork`) passou em 74 dos 75 testes de envios, pedidos, cabeçalho e sessões, e esse falhou. O
  teste chama `comHistorico($, 1)`, e a linha "+1 pedidos anteriores" não existe mais, porque o
  pedido antigo fica à vista.
- Por quê: o `SendMessage` a `local_x` registra a destinatária como sessão ligada à tarefa `A/1`, em
  execução (`task-tree/hooks/tool-call.ts:126-136`). Com o trabalho traduzido, `openInSight`
  (`layout.ts:707-709`) vê uma sessão viva sob a cópia antiga e segura o pedido. É a mesma situação
  do print (sessão viva sob a tarefa abandonada). Nenhum critério separa os dois casos sem
  contradizer a regra da visão resumida (`openInSight`: "sessão ainda trabalhando ou com tarefa
  aberta" segura o pedido).
- Decisão a pedir ao usuário: "Quando um pedido novo reusa o id de um nível 1 aberto e há sessão viva
  (ou carta na fila) sob a tarefa antiga, o pedido anterior fica à vista, com o cartão sob a tarefa
  de origem?"
  - Sim: `envios.cor-por-estado` ganha `Reescrito:`, e o teste troca `comHistorico($, 1)` por
    `painel($)`, com selo `--tipo decisao`. Depois entram a tradução, o cenário
    `pedidos.id-reusado-segura-pedido-com-sessao-viva` e o teste do cartão (passo 7). O teste já foi
    ensaiado e passa com a tradução.
  - Não: fica como hoje. O cartão vivo sai solto no fim (`sessoes.cartao-vivo-nunca-some`), e os
    textos corrigidos tiram o gatilho do uso comum.
- Alternativa que não exige mudar teste (é o plano abaixo, passos 1 a 6): não traduzir, só
  **tirar os ids renomeados da avaliação** do que segura a vista. Isso corrige o sentido inverso, e o
  caso do cartão fica igual a hoje. Ensaiado: 166 de 166 passam.

## 3. Correção passo a passo (sem decisão pendente)

Tudo de uma vez (recarga a quente): escrever numa cópia no scratchpad, copiar junto e rodar
`npm run check` antes de seguir. A cópia ensaiada está em
`<scratchpad>\final\task-tree`
(HEAD com os passos 1 a 4; diff em `...\scratchpad\correcao.diff`). Ela não tem o catálogo nem os
selos, e não passou por `tsc` nem `validate`.

### Passo 1: `task-tree/hooks/panel.ts`, `joinWork` (linhas 610-621)

Novo parâmetro com os ids que o plan renomeou. Em trabalho novo, eles saem da avaliação e do
trabalho mantido: o id cru passou a nomear a tarefa nova, que já está em `ids`.

```ts
export async function joinWork($: any, ids: string[], fresh: boolean, renamed: string[] = []) {
  ...
  const before = (cur as string[]).filter(id => !renamed.includes(id))
  const kept = openInSight({ groups: withMain(groups as Group[]), waits: [], children }, before, sends as Send[], knownId()) ? before : []
  await setWork($, [...new Set([...kept, ...ids])])
}
```

Comentário a acrescentar acima: "Um id do trabalho que este plan renomeou nomeia agora a tarefa nova
(aberta). Avaliado com ele, o pedido anterior todo concluído ficava à vista. Ele sai da avaliação: a
cópia antiga só fica à vista com o pedido dela, quando outra tarefa desse pedido ainda segura a vista."
O `startTool` (`tools.ts:223`) segue sem o parâmetro.

### Passo 2: `task-tree/hooks/tools.ts:113`

```ts
await joinWork($, [...ids, ...kept], fresh0, renamed)
```

O ramo `!fresh0` não muda (o `kept` de hoje). Atualizar o comentário de `tools.ts:110` para dizer que,
em trabalho novo, os renomeados saem da avaliação (`joinWork`).

### Passo 3: `task-tree/text/rules.ts`, os quatro textos

Os textos novos foram ensaiados contra os testes selados de `lembretes`, e eles exigem estas
substrings: "replaneje o painel", "mcp__task-tree__plan", "o usuário interrompeu" e "esta mensagem de
outra sessão"; o lembrete de depois do Esc não pode conter "deixe abertas só as que continuam".

- RULES, linhas 38-42:
  > - Para replanejar dentro da mesma mensagem do usuário, chame plan de novo com o nível 1 inteiro. Um
  > nível 1 aberto com o mesmo id é substituído no mesmo lugar da lista, e as tarefas que mantêm o id
  > guardam o estado (concluída segue concluída, em andamento segue em andamento); só as novas entram
  > pendentes. Isso vale só na mesma mensagem: numa mensagem seguinte (do usuário ou de outra sessão),
  > um plan com o id de um nível 1 ainda aberto não o replaneja, ele fica como histórico do pedido
  > anterior, com as tarefas abertas interrompidas, e a cópia nova entra toda pendente. Para seguir
  > numa mensagem seguinte com tarefas de uma anterior, use start e done nos ids delas e planeje só o
  > que é novo, com ids novos. Um nível 1 já concluído fica como histórico. start só reabre tarefas sem
  > subtarefas; para refazer um pai concluído, replaneje o nível 1 com ids novos para o que deve ser
  > refeito.
- `TOOLS.plan`, linhas 68-71 (o resto da descrição segue igual):
  > Adiciona um plano à árvore de tarefas do painel lateral do usuário. As tarefas de nível 1
  > anteriores são mantidas. Na mesma mensagem do usuário, uma aberta com o mesmo id é substituída no
  > mesmo lugar (replanejamento): as tarefas que mantêm o id guardam o estado, e só as novas entram
  > pendentes. Numa mensagem seguinte, uma aberta com o mesmo id fica como histórico do pedido
  > anterior, com as abertas interrompidas, e o plano novo entra todo pendente: para continuar tarefas
  > de uma mensagem anterior, use start e done nos ids delas.
- `PROMPT.interrupted`, linhas 124-129:
  > …seu turno anterior foi interrompido antes de terminar, e esta mensagem de outra sessão chegou em
  > seguida. Antes de seguir, replaneje o painel: esta mensagem abre um pedido novo. O que continua do
  > trabalho interrompido (tarefas abertas: ${list}) segue pelos ids que já tem: reabra com
  > mcp__task-tree__start o que retoma agora e feche com mcp__task-tree__done o que esta mensagem
  > conclui. O que ela pede de novo vai em mcp__task-tree__plan, com ids novos, na ordem em que vai
  > executar: um plan com o id de um nível 1 da lista o deixaria como histórico, com as abertas
  > interrompidas, e criaria uma cópia toda pendente. Depois siga etapa por etapa com start e done.
- `PROMPT.interruptedByYou`, linhas 137-144 (o prefixo `answered` e a primeira frase seguem iguais):
  > Antes de seguir, replaneje o painel; esta mensagem abre um pedido novo. Se ela continua o trabalho
  > interrompido (tarefas abertas: ${list}), siga essas tarefas pelos ids que já têm, com
  > mcp__task-tree__start e mcp__task-tree__done, e planeje só o que ela pede de novo, com
  > mcp__task-tree__plan e ids novos, na ordem em que vai executar: um plan com o id de um nível 1 da
  > lista o deixaria como histórico, com as abertas interrompidas, e criaria uma cópia toda pendente.
  > Se ela muda de rumo, feche com mcp__task-tree__done o que ela substitui e planeje só o pedido novo.
  > Depois siga etapa por etapa com start e done.

Os textos usam o que o código já faz: `start` reabre folha interrompida (`begin` em
`task-tree/state/tasks.ts:101-110`), e `done` em interrompida é recusado (`tools.ts:151`), por isso
"reabra com start" vem antes do done. `PROMPT.open` (o fim normal) não promete o estado e fica igual.

### Passo 4: testes novos (veja a seção 5)

### Passo 5: catálogo (veja a seção 4) e selos

```
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::plan que reusa o id de um nível 1 concluído num pedido novo não segura o pedido anterior todo concluído" --tipo novo --motivo "auditoria 2026-11-10, achado alto 1"
npm run regras:selar -- "task-tree/tests/lembretes.test.ts::as regras e o lembrete depois do Esc dizem que o estado só fica no replano da mesma mensagem" --tipo novo --motivo "auditoria 2026-11-10, achado alto 1"
npm run regras:selar -- "task-tree/tests/lembretes.test.ts::a descrição do plan diz que o estado só fica no replano da mesma mensagem" --tipo novo --motivo "auditoria 2026-11-10, achado alto 1"
```

Nenhum teste existente muda. O selo ignora os imports (`scripts/selos.mjs:53`), então acrescentar
`mock`, `AGORA` e `iniciarSessao` aos imports de `lembretes.test.ts` não mexe nos selos dos outros.

### Passo 6: `npm run check`, um commit local e o relato

Commit sugerido: `fix(task-tree): pedido anterior concluído sai de vista com id reusado; textos dizem
que o estado só fica no mesmo pedido`. O relato traz `npm run testes:alterados` ("nenhum") e
`npm run impacto` sobre o diff real.

### Passo 7 (só com o "sim" do BLOQUEIO)

- Tradução no `planTool` antes do `joinWork`:
  `const moved = cur.map(id => renamed.includes(id) ? \`${tag}:${id}\` : id)`, com `setWork` se mudou.
  O filtro do passo 1 fica no lugar, porque a cópia traduzida já é avaliada por ela mesma.
- `envios.test.ts:48`: `comHistorico($, 1)` vira `painel($)`, selo `--tipo decisao`, e
  `envios.cor-por-estado` ganha `Reescrito:` com as palavras do usuário.
- Cenário `pedidos.id-reusado-segura-pedido-com-sessao-viva` e o teste do cartão (ensaiado):

```ts
// Regra: pedidos.id-reusado-segura-pedido-com-sessao-viva
test('plan que reusa o id do nível 1 num pedido novo deixa o cartão vivo sob a tarefa de origem, com o pedido antigo à vista', async ($: any, on: any) => {
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
```

  Ele vai em `task-tree/tests/sessoes.test.ts`, com os auxiliares `abrir`, `tarefa`, `cartoes` e `A`
  de lá. Não verifica o estado do "Um" antigo, que fica ◉ enquanto a filha trabalha
  (`sessoes.filha-trabalhando-mantem-pais-em-andamento`). Com HEAD ele falha: o cartão sai solto.

## 4. Cenários do catálogo

Os cenários existentes não são reescritos, nem `pedidos.plano-anterior-vira-historico`, nem
`lembretes.replanejar-apos-esc-pessoa`, cujo "Então" continua valendo.

Em `regras/pedidos.md`, depois de `pedidos.resumida-mantem-anteriores-com-algo-aberto`:

```markdown
### pedidos.id-reusado-nao-segura-pedido-concluido
Um pedido anterior todo concluído sai de vista mesmo quando o pedido novo reusa o id de um nível 1 dele.

- Dado um pedido anterior com dois níveis 1, os dois ✓
- Quando um pedido novo traz plan reusando o id de um deles e começa a trabalhar
- Então o painel mostra só o pedido novo, com o plano novo ○, e o anterior fica em "+N pedidos anteriores", como com tudo fechado

Origem: auditoria 2026-11-10 (o trabalho atual não acompanha a renomeação do nível 1); aplica pedidos.resumida-mantem-anteriores-com-algo-aberto ("com tudo fechado, só o novo") ao id reusado, sem mudar pedidos.plano-anterior-vira-historico.
Código: draw/layout.ts
Estado: coberto
```

Em `regras/lembretes.md`, no fim:

```markdown
### lembretes.estado-guardado-so-no-mesmo-pedido
Os textos ao modelo dizem que o replano só guarda o estado dentro da mesma mensagem.

- Dado as regras do painel, a descrição do plan e os lembretes de depois do Esc
- Quando o modelo os lê
- Então eles dizem que o mesmo id guarda o estado só no replano da mesma mensagem; numa mensagem seguinte, o nível 1 aberto com o mesmo id fica como histórico, com as abertas ✕, e a cópia nasce ○; para continuar, start e done nos ids que já existem, e o que é novo vai com ids novos

Origem: auditoria 2026-11-10 (os textos prometiam o estado guardado sem a condição da mensagem, contra pedidos.plano-anterior-vira-historico).
Estado: coberto
```

Só com o "sim" do BLOQUEIO, também em `regras/pedidos.md`:

```markdown
### pedidos.id-reusado-segura-pedido-com-sessao-viva
O pedido anterior com sessão viva sob a tarefa abandonada fica à vista, com o cartão sob a tarefa de origem.

- Dado um nível 1 aberto de um pedido anterior, com uma sessão filha trabalhando aberta de uma tarefa dele
- Quando um pedido novo traz plan com o mesmo id
- Então o antigo vira histórico como em pedidos.plano-anterior-vira-historico, mas o pedido anterior segue à vista, acima do novo, e o cartão segue sob a tarefa de origem, nunca solto; o nível 1 novo nasce ○ sob o pedido novo

Origem: auditoria 2026-11-10; decisão do usuário, <data> ("<palavras dele>").
Código: draw/layout.ts, hooks/sessions.ts
Estado: coberto
```

## 5. Testes que reproduzem o bug

Ensaiados: os três falham com o código de HEAD e passam com os passos 1 a 3.

`task-tree/tests/pedidos.test.ts`, no fim (usa só o que o arquivo já importa):

```ts
// Regra: pedidos.id-reusado-nao-segura-pedido-concluido
test('plan que reusa o id de um nível 1 concluído num pedido novo não segura o pedido anterior todo concluído', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Primeira' }, { id: '2', title: 'Segunda' }])
  await start($, ['1'])
  await done($, ['1'])
  await start($, ['2'])
  await done($, ['2'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: '1', title: 'Primeira de novo' }, { id: '3', title: 'Terceira' }])
  await start($, ['3'])
  const p = await painel($)
  expect(p.some(l => ['Pedido um', 'Primeira', 'Segunda'].includes(l.titulo)), emTexto(p)).toBe(false)
  expect(p.some(l => l.titulo === '+1 pedidos anteriores'), emTexto(p)).toBe(true)
  esperarEstado(p, 'Primeira de novo', 'pendente')
  esperarEstado(p, 'Terceira', 'andamento')
})
```

`task-tree/tests/lembretes.test.ts`: imports
`import { expect, mock, test } from 'claude-code/testing'`, `import { AGORA, fixar } from './kit/ambiente'`
e `iniciarSessao` em `./kit/cenario`. No fim:

```ts
// Regra: lembretes.estado-guardado-so-no-mesmo-pedido
test('as regras e o lembrete depois do Esc dizem que o estado só fica no replano da mesma mensagem', async ($: any, on: any) => {
  on('prompt.compose', () => ({ sections: [] }))
  await iniciar($, on)
  await esc($)
  const ctx = contexto(await pedido($, 'Agora faça outra coisa'))
  expect(ctx).not.toContain('guardam o estado')
  expect(ctx).toContain('ids novos')
  expect(ctx).toContain('o deixaria como histórico')
  const outra = contexto(await pedido($, '<cross-session-message from="local_x" name="X">oi</cross-session-message>'))
  expect(outra).not.toContain('guardam o estado')
  const COMPOR = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], outputStyle: null, traits: [] }
  const com = await $.prompt.compose({ ...COMPOR, tools: ['mcp__task-tree__plan'] })
  const regras = String((com?.sections ?? []).find((s: any) => s.id === 'task-tree:regras')?.text ?? '')
  expect(regras).toContain('Isso vale só na mesma mensagem')
  expect(regras).toContain('use start e done nos ids delas')
})

// Regra: lembretes.estado-guardado-so-no-mesmo-pedido
test('a descrição do plan diz que o estado só fica no replano da mesma mensagem', async ($: any, on: any) => {
  // Como fixar, mas com o tool.register que guarda a descrição (fixar já o ocupa).
  mock.clock(on, { now: AGORA })
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '.' }))
  on('command.register', () => ({ value: {} }))
  const descricoes: Record<string, string> = {}
  on('tool.register', (_$: any, e: any) => {
    descricoes[String(e.name)] = String(e.description ?? '')
    return { value: {} }
  })
  await iniciarSessao($)
  expect(descricoes['plan'] ?? '').toContain('Na mesma mensagem do usuário')
  expect(descricoes['plan'] ?? '').toContain('Numa mensagem seguinte')
})
```

O segundo teste não usa `fixar`, porque `fixar` já registra `tool.register` e o harness recusa dois
(ensaiado: "registered twice"). Assim o kit não muda e não precisa de selo novo.

## 6. `npm run impacto -- task-tree/hooks/tools.ts task-tree/hooks/panel.ts task-tree/text/rules.ts`

```
Arquivos do mod tocados: hooks/tools.ts, hooks/panel.ts, text/rules.ts
Cenários afetados (72):
  arvore.pai-fecha-com-os-filhos                                 coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.start-reabre-pais                                       coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.start-recusa-pai-concluido                              coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.sem-start-nada-acende                                   coberto   task-tree/tests/turnos.test.ts: 1 teste
  arvore.pai-em-andamento-no-caminho-da-ultima-iniciada          coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.ids-curtos-e-avisos                                     coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.done-sem-summary-e-varias-sem-start                     coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.plan-recusa-ids-repetidos                               coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.pai-fecha-com-nada-aberto-embaixo                       coberto   task-tree/tests/pedidos.test.ts: 3 testes
  cabecalho.resumida-exclui-pedido-finalizado                    coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.resumida-limpa-so-com-tudo-concluido                 coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.titulo-e-a-ultima-iniciada                           coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.titulo-desempata-pela-ordem-do-start                 coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  durabilidade.reinicio-restaura-do-store                        coberto   task-tree/tests/durabilidade.test.ts: 4 testes
  durabilidade.respawn-sem-session-start                         coberto   task-tree/tests/durabilidade.test.ts: 2 testes
  durabilidade.fim-do-turno-sobrevive-ao-reinicio                coberto   task-tree/tests/durabilidade.test.ts: 6 testes
  durabilidade.clear-esvazia                                     coberto   task-tree/tests/durabilidade.test.ts: 1 teste
  durabilidade.formatos-antigos-do-publicado                     coberto   task-tree/tests/durabilidade.test.ts: 1 teste
  durabilidade.recarga-mantem-painel-ligacoes-e-resumo           coberto   task-tree/tests/durabilidade.test.ts: 6 testes
  durabilidade.ligacoes-com-lista-parcial-do-host                coberto   task-tree/tests/durabilidade.test.ts: 1 teste
  durabilidade.resumo-do-done-na-recarga                         coberto   task-tree/tests/durabilidade.test.ts: 2 testes
  envios.fica-ate-entrega                                        coberto   task-tree/tests/envios.test.ts: 2 testes
  envios.entrega-imediata-fica-verde                             coberto   task-tree/tests/envios.test.ts: 2 testes
  envios.esc-apos-entrega-imediata                               coberto   task-tree/tests/envios.test.ts: 1 teste
  envios.cor-por-estado                                          coberto   task-tree/tests/envios.test.ts: 2 testes
  envios.ancora-no-lote-recente                                  coberto   task-tree/tests/envios.test.ts: 3 testes
  envios.sem-andamento-vai-a-pendente-planejada-por-ultimo       coberto   task-tree/tests/envios.test.ts: 2 testes
  envios.carta-pelo-nome-da-sessao                               coberto   task-tree/tests/envios.test.ts: 3 testes
  envios.fila-nao-interrompe-no-fim-do-turno                     coberto   task-tree/tests/envios.test.ts: 1 teste
  envios.pedido-recebido-mostra-carta                            coberto   task-tree/tests/envios.test.ts: 3 testes
  envios.carta-sob-a-tarefa                                      coberto   task-tree/tests/envios.test.ts: 1 teste
  envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila   coberto   task-tree/tests/envios.test.ts: 1 teste
  fumaca.plan-mostra-tarefa                                      coberto   task-tree/tests/fumaca.test.ts: 1 teste
  lembretes.replanejar-apos-esc-pessoa                           coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.fim-normal-lista-abertas                             coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.outra-sessao-apos-esc                                coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.esc-sem-abertas                                      coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.replanejar-vale-uma-vez                              coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.primeira-chamada-sem-plano                           coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.regras-no-prompt-de-sistema                          coberto   task-tree/tests/lembretes.test.ts: 1 teste
  pedidos.titulo-vem-do-request                                  coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.uma-mensagem-um-pedido                                 coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.aviso-do-app-nao-abre-pedido                           coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.replano-no-lugar                                       coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.replano-preserva-estado                                coberto   task-tree/tests/pedidos.test.ts: 4 testes
  pedidos.replano-mantem-envio-ate-entrega                       coberto   task-tree/tests/envios.test.ts: 1 teste
  pedidos.plano-anterior-vira-historico                          coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.nivel1-concluido-e-historico                           coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.rodada-descartada-nao-segura-a-visao                   coberto   task-tree/tests/sessoes.test.ts: 1 teste
  pedidos.resumida-mantem-anteriores-com-algo-aberto             coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  perguntas.sem-tarefa-recusada                                  coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.espera-sob-a-tarefa                                  coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.resposta-por-opcao-tira-espera                       coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.resposta-pelo-chat-tira-espera                       coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.exitplanmode-espera                                  coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.escolha-do-wrapup-ate-proxima-mensagem               coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.permissao-espera                                     coberto   task-tree/tests/perguntas.test.ts: 1 teste
  sessoes.cartao-sob-a-tarefa-de-origem                          coberto   task-tree/tests/sessoes.test.ts: 2 testes
  turnos.iniciada-aguarda-no-fim                                 coberto   task-tree/tests/turnos.test.ts: 2 testes
  turnos.pendentes-seguem-pendentes                              coberto   task-tree/tests/turnos.test.ts: 3 testes
  turnos.pai-e-pedido-aguardam-no-fim                            coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.esc-interrompe-so-a-iniciada                            coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.prompt-seguinte-retoma                                  coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.pedido-anterior-parado-aguarda                          coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.continuacao-sem-start-aguarda                           coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.pai-com-filha-concluida-nunca-interrompido              coberto   task-tree/tests/pedidos.test.ts: 1 teste
  turnos.subagente-que-termina-interrompe                        coberto   task-tree/tests/turnos.test.ts: 2 testes
  turnos.prompt-sem-turno                                        coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.notificacao-de-tarefa-sem-turno                         coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.resumo-sem-resposta-final                               coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.resumo-sem-seta-duplicada                               coberto   task-tree/tests/turnos.test.ts: 1 teste
  ultracode.so-o-interruptor-real                                coberto   task-tree/tests/ultracode.test.ts: 2 testes
Checklist do app: nenhum
Golden: nenhum cenário
Fora do mapa: nenhum
```

Para comparar: com `draw/layout.ts` na lista (uma variante que mexesse em `openInSight`), o impacto
sobe para 106 cenários, com o golden inteiro. Por isso a correção fica em `hooks/panel.ts`.

## 7. Arquivos tocados

- `task-tree/hooks/panel.ts` (`joinWork`)
- `task-tree/hooks/tools.ts` (a chamada de `joinWork` e o comentário)
- `task-tree/text/rules.ts` (RULES, `TOOLS.plan`, `PROMPT.interrupted`, `PROMPT.interruptedByYou`)
- `task-tree/tests/pedidos.test.ts` (1 teste novo)
- `task-tree/tests/lembretes.test.ts` (2 testes novos, imports)
- `regras/pedidos.md` e `regras/lembretes.md` (1 cenário novo em cada)
- `regras/selos.json` (3 selos `novo`)
- Fora: o kit, o golden e os testes existentes. `task-tree/DESENVOLVIMENTO.md:100` (linha do `plan`
  na tabela) pode ganhar "os renomeados saem da avaliação do trabalho novo"; é opcional.

## 8. Riscos

- **O caso do print continua.** Com sessão viva sob a tarefa abandonada, o cartão continua solto no
  fim. É o comportamento decidido (`sessoes.cartao-vivo-nunca-some`), mas a auditoria o chama de bug.
  Os textos novos tiram o gatilho comum (o modelo replanejar o "64" que continua), mas um id genérico
  reusado por acaso ("1") ainda cai nele. Só o passo 7, com decisão, fecha o caso.
- **Mudança de comportamento só no sentido inverso.** Ela só aparece quando o pedido anterior tinha
  outro nível 1 no trabalho e um id reusado. Se outra tarefa desse pedido ainda segura a vista, ele
  fica inteiro, com a cópia antiga e o cartão dela sob a tarefa de origem (não solto). Os testes de
  hoje não cobrem esse meio-termo, e ele fica para o checklist do app.
- **O modelo pode seguir o texto novo de outro jeito.** "start e done nos ids delas" depende de o
  modelo usar o id que existe. O lembrete mostra o id completo ("A/1"), e o start o aceita
  (`resolve`). O achado médio do prefixo duplicado é no plan, não no start.
- **Leitura fora do `update`.** `renamed` é calculado antes do `change` (achado médio "plan decide o
  que renomear numa leitura feita fora do update"). O parâmetro novo herda essa janela, sem piorar.
- **Teste da descrição.** Ele copia os stubs de `fixar` menos `tool.register`. Se o `fixar` mudar, ele
  não acompanha. A alternativa é uma opção no kit, que pede selo do kit.
- **O que não foi verificado no ensaio:** `tsc --noEmit`, os dois `validate`, as etapas `regras`,
  `selos`, `travas` e `regressao` do check, e o app. O `plugin test` da cópia passou 166 de 166.
- **Recarga a quente.** São 3 arquivos do mod de uma vez: copiar juntos da cópia no scratchpad.
- **Checklist do app:** nada de pintura muda. Vale olhar uma sessão real em que a principal reusa um
  id num pedido novo, para ver que o pedido anterior concluído sai.

## 9. Situação

**BLOQUEIO:** a parte pedida "o cartão e a carta seguem a tarefa" (tradução do trabalho) exige mudar
o teste selado `task-tree/tests/envios.test.ts:33-52` (`envios.cor-por-estado`) e uma decisão do
usuário, a pergunta da seção 2. A alternativa sem bloqueio (passos 1 a 6) corrige os textos e o
sentido inverso, sem mudar teste selado, cenário decidido nem golden.
