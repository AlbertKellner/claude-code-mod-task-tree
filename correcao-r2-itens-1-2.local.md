# Id de nível 1 reusado num pedido novo com sessão trabalhando ou carta na fila: plano e diff

Plano de 2026-11-12. Repositório só lido (branch `fix/achados-altos-auditoria`, HEAD `b02a9a9`, árvore
limpa antes e depois). Ensaio numa cópia no scratchpad (clone local, sem worktree).

**Resultado:** diff pronto, sem bloqueio. `npm run check` na cópia: as 8 etapas ok, 196 testes passam,
golden intacto; regressão: 192 testes de HEAD contra o código novo, 1 falha, por decisão registrada (o
teste selado de envios previsto).

- Diff principal: `correcao-r2-itens-1-2.diff` (nesta pasta). `git apply --check` no repositório real: ok.
- **Um ponto para confirmar com o usuário** (seção 7): a opção que ele escolheu descrevia a carta
  "azul na fila, depois cinza". No código, a carta da tarefa cortada pelo plano novo já fica cinza
  "interrompida" na hora do plan, mesmo ainda na fila (regra de 2026-10-24). O diff principal **não muda
  a cor**. Se ele quiser azul até a entrega, há um diff opcional pronto e ensaiado, que se aplica por cima:
  `correcao-r2-itens-1-2-carta-azul.diff`.
- **Duas coisas além do previsto**, as duas sem mexer em teste selado, cenário decidido ou golden
  (seção 4): o cenário `pedidos.id-reusado-segura-pedido-com-cartao-aberto` (origem: auditoria) perde a
  frase que a decisão desfez; e um teste novo trava um efeito da tradução no caso sem sessão nem carta.

## 1. Decisão do usuário

2026-11-12, palavras dele: "Sim, fica à vista (Recomendado)" (`orq-decisoes-altos.local.md`). O pedido
anterior fica à vista enquanto a sessão trabalha ou a carta está na fila; o cartão fica sob a tarefa de
origem, não solto; a carta sob ela; a linha "+N pedidos anteriores" só depois que a sessão parar e a
carta for entregue, a mesma regra de quando o id não é reusado.

## 2. Causa, confirmada em `b02a9a9`

- `task-tree/hooks/tools.ts:67`: o nível 1 aberto de um pedido anterior cujo id o plan reusa entra em
  `renamed`; `tools.ts:81-85` o interrompe e renomeia (`tag:id`); `renameAnchors` (`tools.ts:110`) leva
  para a cópia antiga as ligações das sessões e as cartas.
- O trabalho atual (os níveis 1 que o painel desenha) não acompanha a renomeação. `tools.ts:115-121`
  manda a `joinWork` a cópia antiga à parte (`moved`), e `task-tree/hooks/panel.ts:632-639` só a mantém
  quando há um cartão **com tarefa própria aberta** sob ela (filtro `cards`, sem as cartas). Esse
  filtro entrou no `07e602e` só para não tocar no teste selado de envios enquanto não havia decisão.
- Daí, com a sessão trabalhando sem tarefa própria aberta, ou só com a carta na fila, o pedido antigo
  sai do trabalho: vai para "+N pedidos anteriores" com a carta, e o cartão vivo é desenhado solto no
  fim, "· do pedido '<título>'" (`draw/layout.ts`, `trimToWork`, `alive`, `loosen`).
- Os itens 3 a 13 commitados depois não mexeram nesse trecho: a tradução ainda se encaixa. O
  `4fdc25c` (âncora dos grupos de subagente) e o `e4f1dfa` (cartão de subagente sob a origem fechada)
  renomeiam no mesmo `change` do plan e não dependem do trabalho.

Reproduzido no harness com o código de HEAD e os testes novos: os 4 falham (painéis na seção 6).

## 3. A correção: o trabalho segue a tarefa renomeada (a "tradução")

Arquivos do mod: `task-tree/hooks/panel.ts` e `task-tree/hooks/tools.ts`. **Copiar os dois de uma vez**
(a assinatura de `joinWork` muda; um arquivo só deixa o mod sem compilar e o app mostra "reload failed").
`git apply` do diff faz isso.

`panel.ts`, `joinWork` (o comentário novo está no diff):

```ts
export async function joinWork($: any, ids: string[], fresh: boolean, old: (id: string) => string = id => id) {
  if (ids.length === 0) return
  const { value = [] } = await $.state.get(workState)
  const cur = (value as string[]).map(old)
  if (!fresh) return setWork($, [...new Set([...cur, ...ids])])
  ...
  const kept = openInSight({ groups: withMain(groups as Group[]), waits: [], children }, cur, sends as Send[], knownId()) ? cur : []
  await setWork($, [...new Set([...kept, ...ids])])
}
```

`tools.ts`, no `planTool`:

```ts
await joinWork($, ids, fresh0, id => (renamed.includes(id) ? `${tag}:${id}` : id))
```

- O trabalho anterior é traduzido (`id` renomeado vira `tag:id`) e avaliado **inteiro**, com todos os
  critérios de `openInSight`: tarefa aberta, carta ainda na fila, sessão trabalhando ou com tarefa aberta.
- Saem: os parâmetros `renamed` e `moved` de `joinWork`, o filtro `cards`, os imports `hasOpen`,
  `allTasks` e `panelOf` em `panel.ts`, e `workState` em `tools.ts` (ficariam sem uso; o `tsc` bloqueia).
- `startTool` (`tools.ts`) segue chamando `joinWork($, roots, fresh0)`.
- `draw/layout.ts` não muda.

### O filtro `cards` sai: por quê

- Ele só existia para separar "cartão com tarefa aberta" de "sessão trabalhando sem tarefa" e "carta na
  fila". A decisão manda os três segurarem o pedido: a separação acabou, e o filtro ficaria igual a
  avaliar tudo.
- Avaliar a cópia antiga à parte (como no `07e602e`) daria outra regra para o id reusado: o resto do
  trabalho anterior sairia mesmo com a cópia segurando, e a cópia sairia mesmo com outro pedido aberto.
  A decisão pede "a mesma regra de quando o id não é reusado", que é a do trabalho inteiro
  (`pedidos.resumida-mantem-anteriores-com-algo-aberto`: com algo aberto à vista, o trabalho anterior
  fica inteiro). Com a tradução há um caminho só.
- O caso inverso do `90680aa` (pedido anterior todo concluído, id reusado, sai de vista) continua
  certo sem o filtro de `renamed`: a cópia antiga, fechada, é avaliada por ela mesma e não segura nada.
  O teste dele passa.
- Sem trabalho novo (replano no mesmo pedido), o resultado é o mesmo conjunto de antes: o id cru entra
  por `ids` e a cópia `tag:id` pela tradução.

## 4. Catálogo e testes

### Previstos

- `regras/envios.md`, `envios.cor-por-estado`: ganha
  `Reescrito: 2026-11-12, decisão do usuário ("Sim, fica à vista (Recomendado)"); …`. O Dado/Quando/Então
  não muda (a cor não muda).
- `task-tree/tests/envios.test.ts`, "a mensagem de um plano interrompido fica cinza depois da entrega":
  `comHistorico($, 1)` vira `painel($)`; sai `comHistorico` do import (era o único uso; o `tsc`
  bloquearia). Selo `decisao`. Asserções 2 → 2.
- `regras/pedidos.md`, cenário novo `pedidos.id-reusado-segura-pedido-com-sessao-viva`, com 3 testes
  novos em `task-tree/tests/sessoes.test.ts` (selo `novo`):
  1. "plan que reusa o id do nível 1 num pedido novo deixa sob a tarefa de origem o cartão da sessão
     trabalhando sem tarefa própria, com o pedido antigo à vista";
  2. "só a carta na fila, com a sessão parada: o id reusado num pedido novo deixa o pedido antigo à
     vista, com a carta sob a tarefa de origem" (afirma que a carta está sob a tarefa, não a cor);
  3. "depois que a sessão para e a carta é entregue, o pedido seguinte leva o pedido de id reusado para
     "+N pedidos anteriores"".

### Além do previsto (o orquestrador decide se ficam)

- `regras/pedidos.md`, `pedidos.id-reusado-segura-pedido-com-cartao-aberto` (origem: auditoria
  2026-11-10, sem palavras do usuário): o "Então" dizia "Sessão trabalhando sem tarefa própria aberta, ou
  só carta na fila, não segura". A decisão desfez isso. A frase sai, a origem deixa de citar
  `envios.cor-por-estado`, e entra `Reescrito: 2026-11-12, …`. Os 2 testes dele não mudam e passam.
  Sem isso o catálogo ficaria com uma frase falsa.
- Teste novo em `task-tree/tests/pedidos.test.ts`, citando a regra já decidida
  `pedidos.resumida-mantem-anteriores-com-algo-aberto` (o texto dela não muda): "o pedido concluído
  cujo id o pedido novo reusa segue à vista enquanto outro pedido do trabalho tem algo aberto". É um
  efeito da tradução fora do caso da decisão: trabalho com dois pedidos, o primeiro aberto e o segundo
  concluído; o terceiro reusa o id do segundo. Em HEAD o segundo ia para "+1 pedidos anteriores" (linha
  desenhada acima do primeiro, fora de ordem); com a tradução fica à vista, como quando o id não é
  reusado. Segue a regra de 2026-10-23 ("somente limpe os itens quando todos estiverem concluidos e
  quando iniciarem novas tarefas"). Se o orquestrador preferir não travar isso agora, basta tirar o
  teste e o selo; o comportamento muda do mesmo jeito, porque vem da tradução.

### Não mudam

Nenhum outro teste selado, nenhum cenário decidido, o kit e o golden.
`pedidos.plano-anterior-vira-historico`, `sessoes.cartao-vivo-nunca-some` e
`pedidos.id-reusado-nao-segura-pedido-concluido` seguem como estão, e os testes deles passam.

## 5. Selos (já no diff; comandos para refazer)

```
npm run regras:selar -- "task-tree/tests/envios.test.ts::a mensagem de um plano interrompido fica cinza depois da entrega" --tipo decisao --motivo "decisão do usuário, 2026-11-12: \"Sim, fica à vista (Recomendado)\"; o pedido de id reusado segue à vista, o teste deixa de abrir \"+1 pedidos anteriores\""
npm run regras:selar -- "task-tree/tests/sessoes.test.ts::plan que reusa o id do nível 1 num pedido novo deixa sob a tarefa de origem o cartão da sessão trabalhando sem tarefa própria, com o pedido antigo à vista" --tipo novo --motivo "decisão do usuário, 2026-11-12: \"Sim, fica à vista (Recomendado)\""
npm run regras:selar -- "task-tree/tests/sessoes.test.ts::só a carta na fila, com a sessão parada: o id reusado num pedido novo deixa o pedido antigo à vista, com a carta sob a tarefa de origem" --tipo novo --motivo "decisão do usuário, 2026-11-12: \"Sim, fica à vista (Recomendado)\""
npm run regras:selar -- "task-tree/tests/sessoes.test.ts::depois que a sessão para e a carta é entregue, o pedido seguinte leva o pedido de id reusado para \"+N pedidos anteriores\"" --tipo novo --motivo "decisão do usuário, 2026-11-12: \"Sim, fica à vista (Recomendado)\""
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::o pedido concluído cujo id o pedido novo reusa segue à vista enquanto outro pedido do trabalho tem algo aberto" --tipo novo --motivo "auditoria 2026-11-10: o trabalho atual segue a renomeação do nível 1"
```

**Data do selo:** os selos do diff têm a data 2026-11-12. A etapa `regressao` só aceita a falha do teste
de envios de HEAD com o selo `decisao` **do dia**. Se o commit for feito em outro dia, rodar de novo o
primeiro comando antes do `npm run check` (só a data muda em `regras/selos.json`).

## 6. Ensaio

Cópia: clone local em
`<scratchpad>\r2-12\repo`
(HEAD `b02a9a9` mais o diff; `node_modules` e `task-tree/.claude-plugin/types` copiados do repositório).
Binário: `%APPDATA%\Claude\claude-code\2.1.321\…\claude.exe`. Não foi usado `git worktree`.

| O que rodou | Resultado |
|---|---|
| `npm run check` em HEAD puro (linha de base) | 8 etapas ok, 192 testes |
| Código de HEAD + testes novos e o de envios trocado | 191 passam, 5 falham: os 4 novos e o de envios (o bug reproduzido) |
| `npm run check` com o diff | 8 etapas ok (abaixo) |
| O diff aplicado com `git apply` num clone novo | arquivos iguais aos ensaiados (`selos.json` só difere no fim de linha) |
| `git apply --check` do diff no repositório real | ok; `git status` do repositório segue limpo |

Resumo do `npm run check` com o diff:

```
regras: 137 cobertas, 0 pendentes, 16 checklist (153 no total); mapa: 137 cobertos com código, 0 avisos
selos: 196 testes, 3 arquivos do kit, 4 desenhos
plugin test: 196 pass, 0 fail
regressão: 192 testes de HEAD contra o código novo, 1 falharam, todas por decisão registrada
  - decisão: task-tree/tests/envios.test.ts::a mensagem de um plano interrompido fica cinza depois da entrega — regras envios.cor-por-estado
ok regras | ok travas | ok selos | ok validate do marketplace | ok validate do mod | ok tsc | ok plugin test | ok regressao
```

`npm run testes:alterados` na cópia:

```
Testes existentes alterados desde HEAD: 1

## task-tree/tests/envios.test.ts::a mensagem de um plano interrompido fica cinza depois da entrega
regras: envios.cor-por-estado; selo: decisao, 2026-11-12, decisão do usuário, 2026-11-12: "Sim, fica à vista (Recomendado)"; o pedido de id reusado segue à vista, o teste deixa de abrir "+1 pedidos anteriores"; asserções 2 → 2
-     const p = await comHistorico($, 1);
+     const p = await painel($);

Novos: os 3 de sessoes.test.ts e o de pedidos.test.ts (nomes na seção 4)
```

`npm run impacto` na cópia (sobre o diff real): arquivos do mod tocados `hooks/panel.ts`,
`hooks/tools.ts`; 72 cenários afetados, todos `coberto`; **Checklist do app: nenhum. Golden: nenhum
cenário. Fora do mapa: nenhum.** Antes do diff, `npm run impacto -- task-tree/hooks/tools.ts
task-tree/hooks/panel.ts` no repositório dava 71: o 72º é o cenário novo.

### Painéis do ensaio

Sessão trabalhando sem tarefa própria, depois do plan do pedido novo. Em HEAD:

```
▸ +1 pedidos anteriores ⋯
○ Pedido dois  0/1
└─ ○ Plano A de novo  0/1
   └─ ○ Um de novo
◍ filha-um · do pedido "Pedido um"
```

Com o diff:

```
◉ Pedido um  0:00
└─ ✓ Plano A  0:00
   ├─ ✕ Um  ◍  interrompida  0:00
   │     ◍ filha-um
   └─ ✓ Dois  —
      └─ ✕ Dois.um  interrompida  —
○ Pedido dois  0/1
└─ ○ Plano A de novo  0/1
   └─ ○ Um de novo
```

Só a carta na fila, com a sessão parada, depois do plan do pedido novo, com o diff (em HEAD: só
"+1 pedidos anteriores" e o pedido novo):

```
✓ Pedido um  0:01
└─ ✓ Plano A  0:01
   ├─ ✕ Um  ◍  interrompida  0:01
   │  ├─ ✉ Para filha-um: oi  interrompida  —
   │     ◍ filha-um  concluída
   └─ ✓ Dois  —
      └─ ✕ Dois.um  interrompida  —
○ Pedido dois  0/1
└─ ○ Plano A de novo  0/1
   └─ ○ Um de novo
```

Contraprova: com a carta entregue e a sessão parada **antes** do plan do pedido novo, nada segura e o
pedido antigo vai para "+1 pedidos anteriores" (o critério é mesmo a carta na fila ou a sessão viva).

## 7. Ponto para confirmar com o usuário: a cor da carta na fila

- A opção escolhida dizia "a carta sob ela (azul na fila, depois cinza "interrompida")".
- O que o painel faz hoje (e o diff principal mantém): a carta de uma tarefa cortada por um pedido novo
  fica cinza "interrompida" **na hora do plan**, ainda na fila (`draw/layout.ts:1292` e o comentário de
  `layout.ts:1269-1272`: "gray when dropped before its delivery (its task cut by a new request)"; origem
  2026-10-24, "cinza quando interrompida ou descartada"). Azul ela só é antes do plan novo. Antes da
  decisão isso não se via, porque a carta ia para "+N pedidos anteriores"; agora fica à vista (painel
  acima: carta na fila, cinza).
- Nenhum teste nem o golden afirma a cor nesse intervalo (na fila, com a tarefa cortada).
- Diff opcional, por cima do principal: `correcao-r2-itens-1-2-carta-azul.diff`. Uma linha em
  `draw/layout.ts` (a carta na fila segue azul "na fila", com o tempo de espera, e fica cinza quando a
  sessão a toma), o "Então" de `envios.cor-por-estado` com mais um `Reescrito:`, o texto do cenário novo
  e 1 teste novo em `envios.test.ts`. Ensaiado sobre o principal: `npm run check` com as 8 etapas ok,
  197 testes, golden intacto, regressão com 0 falhas. Como toca `draw/layout.ts`, o `npm run impacto`
  lista 94 cenários, o golden inteiro e 4 itens do checklist do app (é orientação; nada mudou no desenho
  travado).
- O diff opcional traz marcadores a trocar pelas palavras do usuário e pela data: `<palavras dele>` e
  `<AAAA-MM-DD>` no comentário de `layout.ts`, no `Reescrito:` de `regras/envios.md` (a data está como
  2026-11-12) e no motivo do selo em `regras/selos.json`. Depois de trocar, selar de novo:
  `npm run regras:selar -- "task-tree/tests/envios.test.ts::a carta de um plano interrompido segue azul enquanto está na fila e fica cinza na entrega" --tipo novo --motivo "decisão do usuário, <data>: \"<palavras dele>\""`.
- Pergunta sugerida: "Num pedido novo que reusa o id, a carta ainda na fila sob a tarefa antiga aparece
  como? (a) Cinza "interrompida" desde o plan novo, como hoje. (b) Azul "na fila" até a sessão a tomar,
  e só então cinza."

## 8. Riscos e limites

- **Decidido na hora do plan.** O que segura o pedido antigo é avaliado quando o pedido novo planeja.
  Depois disso o pedido antigo fica à vista até um pedido seguinte que comece com tudo fechado, parado e
  entregue. É a regra de quando o id não é reusado.
- **Pedido antigo inteiro à vista.** Com a sessão ou a carta segurando, volta o pedido antigo todo (os
  outros níveis 1 dele também) e o resto do trabalho anterior.
- **Estado da tarefa antiga.** Ela aparece ✕ "interrompida" com a sessão trabalhando embaixo, e o pedido
  antigo ◉. Já era assim no caso do cartão com tarefa aberta (`07e602e`); nenhum teste afirma. Vale
  olhar no app.
- **Subagentes.** `openInSight` não olha subagente em segundo plano sob a cópia antiga, com ou sem id
  reusado. Fora deste item.
- **Leitura fora do `update`.** `renamed` continua calculado antes do `change` (achado médio da
  auditoria); a tradução herda essa janela, sem piorar.
- **Documentação.** `task-tree/DESENVOLVIMENTO.md` (linha do `plan` na tabela de hooks e "Trabalho
  atual") não cita a tradução; os commits `90680aa` e `07e602e` também não o atualizaram. Fora do diff.

## 9. Checklist do app (validação visual do usuário)

Nada de pintura muda. Numa sessão real:
- a orquestradora com uma filha trabalhando (sem tarefa aberta no painel dela) recebe uma mensagem nova
  e planeja de novo com o mesmo id do nível 1: o pedido anterior segue à vista, o cartão sob a tarefa de
  origem, sem "· do pedido";
- o mesmo com uma carta na fila: a carta sob a tarefa antiga (conferir a cor, seção 7);
- depois que a filha para e a carta é entregue, o pedido seguinte leva os anteriores para
  "+N pedidos anteriores".

## 10. Commit sugerido (um, local)

`fix(task-tree): id reusado num pedido novo deixa à vista o pedido com sessão trabalhando ou carta na fila`

Corpo: o trabalho atual segue a tarefa renomeada para a cópia antiga, que é avaliada como qualquer
tarefa do trabalho anterior; decisão do usuário, 2026-11-12 ("Sim, fica à vista (Recomendado)").

## 11. Arquivos do diff principal

- `task-tree/hooks/panel.ts`, `task-tree/hooks/tools.ts`
- `task-tree/tests/envios.test.ts` (1 linha e o import), `task-tree/tests/sessoes.test.ts` (3 testes e
  o import de `cartaSob`), `task-tree/tests/pedidos.test.ts` (1 teste)
- `regras/envios.md`, `regras/pedidos.md`, `regras/selos.json`
