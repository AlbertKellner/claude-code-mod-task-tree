# Só a visão resumida: remover os botões ≡ e ▤ do cabeçalho

Só leitura; nada implementado nem commitado. Base lida: a pasta de trabalho do clone em
`feat/filha-completa-na-orquestradora` (PR #29, ponta 7b00b94) **com a linha de envio ✉ ainda sem
commit**. Pedido do usuário (2026-11-04): "remova os icones de reesumo e tarefas completas, deixe
somente a visão resumida".

## Essencial

- **Recomendação: tirar a visão completa inteira** (botões, `/task-tree resumida|completa`, a chave
  `view` do state e do store, o ramo da completa no `layout`), não só o acesso. Código morto aqui vira
  dívida (o kit, o golden e o catálogo falariam de uma visão que ninguém abre). A resumida é a
  "completa cortada ao trabalho atual" (`trimToWork`), então o que fica é o mesmo desenho, as mesmas
  dobras, o "+N pedidos anteriores" clicável e o cartão vivo solto; o `work` (os níveis 1 do trabalho)
  continua, porque é a definição da resumida e é publicado para a mãe cortar o cartão da filha.
- **O que o usuário deixa de ver** (e contradiz em parte "preciso saber pela sessão principal tudo que
  as filhas planejaram, executaram, estao executando", 2026-11-03): os pedidos finalizados de turnos
  anteriores somem quando um pedido novo começa sem nada aberto à vista, com os cartões das filhas
  deles; os cartões antigos sem tarefa de origem somem sem linha de contagem; "sessão inteira: a de b"
  fica só no `alt` do desktop (invisível na prática). **Dúvida de produto 1** (abaixo): a resumida pura,
  ou a resumida com "+N pedidos anteriores" (fechado) guardando o que saiu do trabalho.
- **Golden: os 3 cenários mudam**, só pelo cabeçalho: o `alt` perde "Visão: … (≡ resumida, ▤ completa)"
  e, sem os 72 px reservados aos botões (`ICONS_W`), o bloco de números e o corte do título mudam de
  posição. Os botões não entram no SVG (são `Button` do app por cima). Validação dele no app antes do
  commit, depois `golden:aprovar --todos`. Não tocar na linha do terminal além de tirar `[≡] ▤`.
- **Testes de hoje (confirmado numa cópia no scratchpad com a visão forçada em resumida): 103
  passam, 16 falham.** (a) 8 pela troca de visão ou pela completa, esperados (mudam de forma ou de
  cenário; o golden ×3 entre eles); (b) 4 porque **o plano antigo interrompido por um replano com o
  mesmo id some da resumida na hora** (é a dúvida 1 em forma de teste: decidir antes de implementar);
  (c) 3 **defeitos da própria resumida** que a suíte não via: a retomada deixa o painel vazio (`work`
  não é restaurado no resume), o cartão de uma filha sem `work`/`turns` publicados guarda uma tarefa
  só, e o grupo de um subagente sem tarefa de origem some ao terminar. Os três vão no brief como
  correção (CLAUDE.md: bug achado é corrigido e relatado). Todos com selo `decisao`, regras com
  `Reescrito: 2026-11-04, "remova os icones de reesumo e tarefas completas, deixe somente a visão
  resumida"`; um cenário aposentado (`cabecalho.limite-de-cartoes-antigos`) sai do catálogo e do selo
  (`--remover`).
- **Ordem:** depois do commit da linha de envio (ela toca `render.tsx`, `layout.ts`, `types`,
  `rules.ts`, `leitura.ts`, `cabecalho.test`, `sessoes.test`, `selos.json`, os mesmos arquivos). Branch
  nova `feat/so-visao-resumida` a partir da ponta de #29 com esse commit; um commit (código + catálogo
  + kit + testes + golden aprovado).

## 1. O que existe hoje

**Os botões.** `hooks/render.tsx`, `VIEWS = [['summary','≡'],['full','▤']]`. Desktop: dois `Button`
(o escolhido `variant="primary"`, o outro `plain dimColor`) num `Box` absoluto no canto direito do
cabeçalho (`chrome.views`), chaves `view:summary` / `view:full` registradas por `act` e respondidas
em `press`. Terminal: `[≡] ▤` no fim da linha de título, inclusive na linha "Nenhuma tarefa
planejada.". O clique chama `setView` (`hooks/panel.ts`): grava a chave `view` no state e, só aí, no
store (`saveStore($, 'view', …)`).

**O comando.** `hooks/command.ts`: `/task-tree resumida|summary|completa|full` chama `setView` antes
de abrir o pane; sem argumento só abre e diagnostica. Descrição em `text/rules.ts` (`COMMAND`: "…
com resumida ou completa, troca a visão"). A mensagem de emergência do desenho grande
(`render.tsx`, acima de `DRAW_LIMIT`) diz "Use ≡ (/task-tree resumida) para a visão resumida".

**A chave `view`.** `types/index.d.ts` (`view: 'full' | 'summary'`), `state/durability.ts` (linha da
tabela: state+store, `store: 'view'`, `restoredAt: start, first-use`), `hooks/panel.ts`
(`ensureView` no primeiro uso sem `session.start`; `restoreView` no `session.start`: o guardado, senão
`'summary'`, **o padrão de sessão nova**), `hooks/session-start.ts` (chama `restoreView`), `render.tsx`
(lê `view` com `heldView ?? viewBrought ?? 'full'`: **sem nada no state o desenho cai na completa**,
o que vale para o harness sem `iniciarSessao` e para um respawn sem store; é o motivo de quase toda a
suíte rodar hoje na completa sem dizer). `DESENVOLVIMENTO.md` (tabela de durabilidade, comando,
botões, `press` por chave, "Cabeçalho por visão", a divergência 1 corrigida, item 6 "a visão vai ao
store só no clique").

**Painéis salvos como completa.** Cada sessão que clicou ▤ tem `view: 'full'` no store. Nada migra: a
entrada deixa de ser lida e fica morta no store (sem custo). Sessões que nunca clicaram não têm
entrada.

**O `work` (o trabalho atual).** Chave `work` (state+store), os ids dos níveis 1 do trabalho:
`startsWork`/`joinWork`/`setWork` (`panel.ts`), `openInSight` (`layout.ts`: com algo aberto à vista o
trabalho anterior fica inteiro, senão só o pedido novo), `tools.ts` (plan/start), `session-start.ts`
(`/clear` zera). Publicado no arquivo da sessão (`Published.work`, `Panel.work`, `io/publish.ts`) e
usado pela mãe: `trimToWork` é recursivo e corta o painel de cada filha pelo `work` que ela publicou.
**Fica tudo.**

**O desenho por visão.** `draw/layout.ts`, fim de `layout()`: `panel(summary ? cut() : all, …)`.
`cut()` = `split` das sessões + `trimToWork(…, 0)`: os pedidos do trabalho inteiros; os cartões sob
tarefa do trabalho, ou vivos (`alive`) soltos no fim (`loosen`, "· do pedido …"); os cartões parados sem
âncora ficam de fora, sem linha. O corpo (`body`) é o mesmo nas duas: o corte dos 3 últimos pedidos
(`SHOWN_TURNS`) vale pela lista recebida, logo **na resumida "+N pedidos anteriores" aparece quando o
trabalho abrange mais de 3 pedidos** (algo aberto num pedido antigo segurou os seguintes), e abre com
clique como na completa (decisão de 2026-11-03: o código não distingue visão); "+N cartões antigos de
sessões" só existe na completa (na resumida os cartões sem âncora já saíram em `trimToWork`);
`limitRows` (400 linhas) vale nas duas; `strays` (cartão vivo de pedido cortado) vale nas duas.

**O cabeçalho.** Conta o desenhado (`shown = lines.flatMap(r => r.nodes)`); "sessão inteira: a de b"
quando difere: terminal entre parênteses na linha de título (o kit lê daí), desktop só no `alt`. V4
(`draw/svg.ts`, `headerSvg`): `ICONS_W = 72` (`draw/geometry.ts`) reservado no canto: o título cabe em
`R − ICONS_W − L − block`, o bloco de números em `bx = R − ICONS_W − 6`; a camada de hover do título
em `render.tsx` tem `W − ICONS_W` de largura; o `alt` termina com ", estado geral: …; sessão inteira ….
Visão: resumida|completa, selecionada (≡ resumida, ▤ completa)"; a chave da animação do cabeçalho é
`head@<view>` (cada visão com a sua barra e as suas pílulas, `draw/motion.ts` comenta "a change of
view"). O terminal desenha a mesma linha mais os botões.

**O kit e os testes.** `tests/kit/cenario.ts`: `visao($, 'resumida'|'completa')` =
`$.command.run({ command: 'task-tree', args })`. `tests/kit/leitura.ts`: tira ` [≡] ▤` do texto da
linha. Testes que trocam de visão: `cabecalho.test.ts` (8: números somam o desenhado, nas duas; o
finalizado sai da resumida e a completa o mantém; algo aberto mantém o anterior; interrompida fora do
total; só 3 pedidos na completa; cartões antigos; os dois do limite de 400 linhas; histórico abre com
clique), `durabilidade.test.ts` (respawn 1/2 e 2/2), `sessoes.test.ts` (turno próprio depois de 3
pedidos; cartão vivo nas duas visões). O golden (`golden.test.ts`) não troca de visão: desenha na
completa por omissão do render; o cenário "principal" tem dois pedidos, o primeiro com ✕ e ○ (algo
aberto), logo a resumida o mantém: **as linhas do golden não mudam, só o cabeçalho**. A prop `view: {}`
de `PROPS`/`PANE_PROPS` é do pane do app, não a nossa.

## 2. O que sai e o que fica

| | Sai | Fica |
|---|---|---|
| `hooks/render.tsx` | `VIEWS`, `views`, o `Box` do canto e os botões no terminal (as duas linhas de título); `viewState`, `ensureView`, `heldView`/`view`/`summary`; `chrome.view`, `headKey` vira `head`; o trecho "Visão: …" do `alt`; "Use ≡ (/task-tree resumida)…" da emergência; a camada de hover com `W − ICONS_W` passa a cobrir só o título (até o bloco) | o resto; "sessão inteira" no `alt` |
| `hooks/command.ts` | o argumento e `setView` | `/task-tree` abre e diagnostica |
| `hooks/panel.ts` | `viewState`, `setView`, `restoreView`, `ensureView` (e a chamada em `change`) | `work` inteiro |
| `hooks/session-start.ts` | `restoreView` | |
| `state/durability.ts` | a linha `view`; `'view'` de `store?` | a linha `work` |
| `types/index.d.ts` | `view` de `PluginState` | `Panel.work`, `Published.work` |
| `draw/layout.ts` | `Model.view`, `summary`, o ramo `all`: `layout` sempre desenha `cut()`; comentários "the summary view"/"the full view" viram "o painel" | `trimToWork`, `openInSight`, `alive`, `loosen`, `SHOWN_TURNS`, histórico clicável, `strays`, `limitRows` |
| `draw/geometry.ts` | `ICONS_W` | `HEADER_H` 125 etc. |
| `draw/svg.ts` | `ICONS_W` do `fit` do título e de `bx` (recomendo `bx = R`, o bloco alinhado à borda interna do cartão, como o texto à direita das linhas) | o resto do V4 |
| `draw/motion.ts` | só comentários (opcional; não muda desenho) | |
| `text/rules.ts` | "; com resumida ou completa, troca a visão" de `COMMAND` | `RULES` (não fala de visão) |
| `tests/kit/cenario.ts` | `visao` | |
| `tests/kit/leitura.ts` | o `replace` de `[≡] ▤` | |
| `DESENVOLVIMENTO.md` | atualizar "Como é hoje" (tabela de durabilidade, comando, terminal, `press`, desenho) e registrar a decisão no histórico | |

Perguntas da orquestradora:
- **`/task-tree`:** fica, sem argumento (ainda é o jeito de abrir o pane e ler o diagnóstico).
- **"sessão inteira: a de b":** fica (conta a sessão inteira contra o desenhado); ver a dúvida 2 sobre
  torná-la visível no desktop.
- **"+N pedidos anteriores" com clique (2026-11-03):** hoje existe nas duas visões pelo mesmo código;
  na resumida só quando o trabalho tem mais de 3 pedidos. Continua assim na resumida pura. A dúvida 1
  propõe estendê-lo ao que saiu do trabalho.
- **Cartão vivo solto:** fica igual (é regra das duas visões; `sessoes.cartao-vivo-nunca-some` só perde
  "nas duas visões" no texto).
- **O que a resumida esconde:** (a) pedidos finalizados de turnos anteriores, com os cartões das filhas
  deles, assim que um pedido novo começa sem nada aberto à vista (`openInSight` falso): sem clique que
  os traga de volta; (b) cartões parados/concluídos sem tarefa de origem (sessões de antes das
  âncoras, ou cuja tarefa foi replanejada fora): sem linha "+N cartões antigos"; (c) o total da sessão
  só no `alt`. Na completa, (a) ficava em "+N pedidos anteriores" (clicável) e (b) em "+N cartões
  antigos" (não clicável).

## 3. Catálogo, testes e impacto

**Regras a reescrever** (todas com `Reescrito: 2026-11-04, decisão do usuário ("remova os icones de
reesumo e tarefas completas, deixe somente a visão resumida")`, citando o que desfaz):
- `cabecalho.numeros-somam-o-desenhado`: "o que a visão desenha" → "o que o painel desenha".
- `cabecalho.resumida-exclui-pedido-finalizado`: tirar "a completa o mantém e o conta"; o finalizado
  sai do painel e dos números, e a sessão inteira segue no tooltip ("sessão inteira: a de b").
- `cabecalho.resumida-limpa-so-com-tudo-concluido`: "a resumida" → "o painel".
- `cabecalho.limites-de-linhas`: Dado passa a ser "mais de três pedidos no trabalho atual (um pedido
  antigo com algo aberto segurou os seguintes), os do meio sem nada aberto"; Quando "o painel é
  desenhado".
- `cabecalho.historico-abre-com-clique`: idem (sem "completa"); o cenário do teste muda do mesmo jeito.
- `cabecalho.limite-de-linhas-do-desenho`: Quando "é desenhado" (já está); só o teste perde a troca.
- `cabecalho.interrompida-fora-do-total`: sem mudança de texto; o teste perde a troca.
- `pedidos.resumida-mantem-anteriores-com-algo-aberto`: "a visão resumida mantém" → "o painel mantém";
  título "O painel mantém os pedidos anteriores enquanto há algo aberto".
- `sessoes.cartao-vivo-nunca-some`: tirar "cortado na completa (…) ou fora do trabalho na resumida" →
  "cortado ('+N pedidos anteriores') ou fora do trabalho atual".
- `durabilidade.respawn-sem-session-start`: "a visão escolhida e o trabalho atual voltam" → "o trabalho
  atual volta"; o pedido anterior continua no store (conferido pela sessão inteira do cabeçalho).
- `visual.cabecalho-em-cartao`, `visual.cabecalho-barra-e-chips-desenhados` (checklist): sem os botões
  de visão no canto; `visual.desenho-*` ×3: "Reescrito: 2026-11-04 … O golden é regravado com a
  validação dele no app" (como no V4).
- **Aposentar** `cabecalho.limite-de-cartoes-antigos` (só existia na completa): remover o cenário do
  `regras/cabecalho.md` (o histórico fica no git; o commit diz por quê) e o teste, com
  `node scripts/selos.mjs --remover "task-tree/tests/cabecalho.test.ts::o cartão parado, sem tarefa de origem e de antes dos três últimos pedidos vira \"+1 cartões antigos de sessões\"" --tipo decisao --motivo "…"`.
  Alternativa se o usuário quiser manter a linha: ver a dúvida 1 (com o histórico na resumida, "+N
  cartões antigos" poderia voltar dentro dele).

**Testes que mudam** (selo `decisao`, motivo com as palavras dele; nenhum outro pode mudar):

Confirmado numa cópia da pasta de trabalho no scratchpad
(`<scratchpad>\so-resumida`,
`render.tsx` com a visão forçada em `summary`, binário 2.1.317): **103 passam, 16 falham**; `validate
--strict` passa. As 16, por causa:

*a) A troca de visão ou a completa (esperadas; o teste muda de forma ou de cenário):*
1. `cabecalho.test` "o pedido finalizado sai da resumida…; a completa o mantém": tirar a metade da
   completa; manter `c.inteira = {3, 5}` (o tooltip ainda conta a sessão). Asserções 6 → ~4: só com
   selo `decisao`.
2. `cabecalho.test` "só os três últimos pedidos aparecem na completa…": na resumida cada pedido
   concluído limpa o anterior, logo só "Pedido 5" fica, sem "+N". Cenário novo: o pedido 1 deixa uma
   folha pendente (segura o trabalho), os pedidos 2–5 concluídos → "+1 pedidos anteriores" (o 2),
   os pedidos 1, 3, 4 e 5 à vista, números do desenhado e `inteira` à parte.
3. `cabecalho.test` "+N pedidos anteriores abre com um clique…": o mesmo cenário do item 2.
4. `cabecalho.test` "o cartão parado… vira +1 cartões antigos de sessões": aposentar (remover teste,
   cenário e selo).
5. `durabilidade.test` "respawn 2/2": trocar a verificação pela completa (`Um`, `Dois.dois`
   concluídas) por `cabecalho(p).inteira` = {4, 5} (o store não encolheu); o texto da regra perde "a
   visão".
6. `sessoes.test` "o cartão vivo… nas duas visões": tirar o laço (uma visão só); asserções estáticas
   iguais.
7. `cabecalho.test` "os números somam o que a visão desenha…" e "com algo aberto à vista, a resumida
   mantém…", `durabilidade.test` "respawn 1/2", `sessoes.test` "turno próprio… depois de três
   pedidos": **passaram** na cópia; só perdem a chamada `visao` (o kit deixa de tê-la) → selo
   `decisao` pela forma (ou `refatoracao`, que também vale: as asserções não diminuem).
8. `golden.test` ×3: esperado (cabeçalho); aprovação dele no app.

*b) O plano antigo interrompido por um replano com o mesmo id em pedido novo sai da resumida na
hora (consequência do `work`: o antigo deixa de estar aberto e não é "concluído" que o `kept` do
plan preserve):*
9. `pedidos.test` "plan com o mesmo id substitui no lugar… e interrompe o anterior em pedido novo":
   "Plano A revisto" ✕ some; só "Pedido dois" fica.
10. `cabecalho.test` "a interrompida sai do total e entra no chip": as 3 folhas ✕ somem (o chip
    "interrompidas" fica 0).
11. `cabecalho.test` "pedidos antigos saem inteiros do começo, contados em +N linhas anteriores": os
    dois planos grandes usam os mesmos ids (`0`..`7`), então o segundo interrompe o primeiro, que some;
    sem o corte não há "+N linhas anteriores". Com ids distintos por pedido o teste passa (os dois
    pedidos ficam, tudo pendente segura o trabalho).
12. `envios.test` "a mensagem de um plano interrompido fica cinza depois da entrega": o plano antigo
    some, a carta é rependurada no nível 1 novo e lê "entregue", não "interrompida"
    (`envios.cor-por-estado`).
    → Isto é a **dúvida 1** em forma de teste: na resumida pura, o histórico ✕ de um replano some no
    ato (os quatro testes mudam de cenário ou de expectativa, com `Reescrito:` em
    `pedidos.plano-anterior-vira-historico`, `cabecalho.interrompida-fora-do-total`,
    `cabecalho.limite-de-linhas-do-desenho` e `envios.cor-por-estado`); com o histórico na resumida
    (opção B), os quatro passam a ver o antigo em "+N pedidos anteriores" (aberto) e mudam só de forma.
    **Recomendação: decidir a dúvida 1 antes de implementar**, para não reescrever esses quatro duas vezes.

*c) Defeitos da própria resumida, hoje escondidos porque a suíte rodava na completa (corrigir no mesmo
commit, o teste existente já reproduz; cenário no catálogo onde indicado):*
13. `durabilidade.test` "retomada, 2/2": **a retomada deixa o painel vazio** ("Nenhuma tarefa
    planejada."): `restore` no resume traz os grupos do store da sessão retomada, mas não o `work`, que
    fica o da sessão anterior; `trimToWork` com ids que não existem nas tarefas não desenha nada.
    Reproduzível hoje no app: retomar uma sessão com o painel na resumida. Correção: no resume,
    restaurar `work` do store da sessão retomada (como `restoreTurn($, id, true)`) **e** em `trimToWork`
    tratar `work` sem nenhum id presente como vazio (cai no último pedido com tarefas). Cenário:
    acrescentar ao Então de `durabilidade.reinicio-restaura-do-store` "inclusive o trabalho atual (o
    painel não volta vazio)", com `Reescrito:` nas palavras dele.
14. `sessoes.test` "filha parada: a iniciada aguarda e as pendentes seguem pendentes" e
    `durabilidade.test` "os 8 formatos do arquivo publicado": **o corte do cartão de uma filha sem
    `work` nem `turns` publicados guarda uma tarefa só** (`trimToWork`: "sem turnos, o último nível 1
    aberto, senão o último"): "Começada" (◷) some e só "Nunca" fica; nos formatos antigos, cada cartão
    mostra um nível 1. Atinge filhas em versão antiga do mod e qualquer painel publicado sem `turns`.
    Correção: sem `work`, os níveis 1 do último turno com tarefas; **sem turnos, todos os níveis 1**
    (o painel antigo é pequeno). Cenário: `durabilidade.formatos-antigos-do-publicado` já diz "com as
    tarefas que o formato traz"; acrescentar à `sessoes.filha-parada-pendentes-seguem-pendentes`
    "todas as tarefas do cartão continuam à vista".
15. `turnos.test` "o subagente que termina deixa interrompido o que ficou aberto…": **o grupo de um
    subagente sem tarefa de origem some da resumida ao terminar** (`trimToWork` só mantém grupos sob o
    trabalho ou com algo aberto); a completa o desenhava solto no fim. No app, um `Agent` lançado sem
    tarefa em andamento. Correção: manter os grupos sem âncora (`g.anchor === undefined`), como a
    completa fazia; são poucos. Cenário: `turnos.subagente-que-termina-interrompe` ganha "o grupo segue
    desenhado".
    Os três são bugs do plugin (CLAUDE.md: corrigir e relatar); nenhum contradiz decisão anterior do
    usuário, por isso vão no brief sem pergunta.

**Kit:** `cenario.ts` (sem `visao`) e `leitura.ts` (sem o `replace`) ganham selo `refatoracao`
(`node scripts/selos.mjs --kit <arquivo> --tipo refatoracao --motivo "…"`).

**Matriz de impacto** (`npm run impacto -- hooks/render.tsx hooks/command.ts hooks/panel.ts
draw/layout.ts draw/geometry.ts draw/svg.ts state/durability.ts text/rules.ts types/index.d.ts`):
`render.tsx` e `types/index.d.ts` são núcleo → **todos os cenários**, 12 do checklist do app, os 3 do
golden; "Fora do mapa: nenhum". A Implementação roda `npm run impacto` sobre o diff real.

## 4. Golden

- Os botões são `Button` do app num `Box` por cima do cabeçalho: **não entram no SVG**. Mesmo assim os
  3 cenários mudam, pelo cabeçalho: (1) o `alt` (gravado no golden) perde "Visão: completa,
  selecionada (≡ resumida, ▤ completa)"; (2) sem `ICONS_W`, `bx` e o `fit` do título mudam no `source`.
  As linhas da árvore não mudam (o "principal" mantém os dois pedidos na resumida, porque o primeiro
  ficou com ✕ e ○).
- Fluxo: implementação → `npm run check` acusa "o desenho de <cenário> mudou" nos 3 → o usuário valida
  no app (largo e 60 colunas, dois temas; com o pane estreito o título agora ganha 72 px) →
  `npm run golden:aprovar -- --todos --motivo "\"<palavras dele>\", 2026-11-04"` → commit com código,
  `svg.ts` do golden e `selos.json`.
- Atenção: a linha de envio sem commit também muda o golden ("envios") e espera a validação dele.
  São duas aprovações do golden em sequência, uma por commit; não juntar as duas num commit (decisões
  distintas, selos distintos).

## 5. Ordem em relação à linha de envio

1. O usuário valida a linha de envio no app; a Implementação aprova o golden dela e faz o commit em
   `feat/filha-completa-na-orquestradora` (PR #29).
2. Só então esta mudança: branch `feat/so-visao-resumida` a partir dessa ponta (traz a linha de
   envio), um commit; PR com base em `feat/filha-completa-na-orquestradora` até o #29 ser mesclado (ou
   esperar o merge e abrir contra `main`). Motivo: os arquivos coincidem (`render.tsx`, `layout.ts`,
   `types/index.d.ts`, `rules.ts`, `leitura.ts`, `cabecalho.test.ts`, `sessoes.test.ts`, `selos.json`);
   mexer antes do commit da linha de envio misturaria dois golden e dois conjuntos de selos num diff só.
3. Se o usuário preferir tudo no #29, vale o mesmo (commit separado, depois do da linha de envio).

## 6. Riscos e dúvidas de produto

**Riscos**
- A suíte passa a rodar na resumida sem ninguém pedir (hoje roda na completa por omissão do render).
  Testes que não trocam de visão podem mudar de resultado onde um pedido finalizado some; a cópia no
  scratchpad (§3) mostra quais. A etapa `regressao` ("testes antigos, código novo") vai acusar cada um:
  só passam com selo `decisao` e `Reescrito:` na regra.
- `cabecalho.interrompida-fora-do-total` e o teste do turno próprio depois de 3 pedidos dependem de
  `openInSight` segurar o pedido antigo (tarefa ◷/✕ ou filha viva): confirmado na cópia (§3).
- O `ensureView` sai de `change()`; nada mais lê a chave `view`: um store antigo com `view: 'full'`
  é ignorado. Não há migração a fazer.
- Recarga a quente: `render.tsx`, `panel.ts`, `command.ts`, `session-start.ts`, `layout.ts`,
  `svg.ts`, `geometry.ts`, `durability.ts`, `types` mudam juntos; escrever numa cópia e copiar de uma
  vez (CLAUDE.md), `npm run check` antes do passo seguinte.
- `DRAW_LIMIT`: a resumida é menor que a completa (29 KB contra 101 KB no caso real), então a
  emergência fica ainda mais rara; a mensagem perde a sugestão do ≡.

**Dúvida 1 (produto): o que acontece com o histórico que saía da resumida.**
- A) Resumida pura, como hoje: os pedidos finalizados somem ao começar trabalho novo sem nada aberto;
  o total só em "sessão inteira". É o pedido literal; custo menor.
- B) Resumida + "+N pedidos anteriores" (fechado por padrão) com o que saiu do trabalho: o painel
  desenha o trabalho atual como hoje e, acima dele, a linha "+N pedidos anteriores" cobrindo os
  pedidos finalizados fora do trabalho (e, abertos, os cartões deles); os cartões antigos sem âncora
  podem voltar como "+N cartões antigos" dentro do histórico aberto. Reconcilia com 2026-11-03
  ("preciso saber pela sessão principal tudo que as filhas planejaram…"; "Sim, fechado por padrão").
  Custo: em `layout`, o corte do trabalho passa a separar "desenhado" de "histórico" em vez de
  descartar; `limitRows` segue valendo; um cenário novo no catálogo; o golden não muda além do
  cabeçalho (os cenários não têm pedido fora do trabalho).
- **Recomendação: B**, porque mantém a leitura limpa (só o trabalho à vista) sem perder o histórico que
  ele pediu no dia anterior, e porque resolve os 4 testes do grupo (b) de §3 sem reescrever a regra do
  replano (o plano antigo ✕ continua a um clique). Se A, esses 4 cenários são reescritos para "o
  antigo sai de vista" e nada mais muda. Decidir antes de implementar. Se B, dois commits: 1) tirar
  a completa (este brief, com os 4 testes na forma de B já); 2) o histórico na resumida (brief curto
  à parte).

**Dúvida 2 (produto): "sessão inteira: a de b" no desktop.**
- A) Como hoje: só no `alt` (na prática invisível no app).
- B) Visível e discreto: uma linha fina sob o bloco de números ("sessão: 12 de 19"), só quando difere.
  Muda o golden (já muda) e `visual.cabecalho-em-cartao`.
- Recomendação: B se ele escolher A na dúvida 1 (é o único rastro do que saiu); se escolher B na
  dúvida 1, A basta (o histórico está a um clique).

**Dúvida 3 (menor): o lugar do bloco de números sem os botões.** `bx = R` (alinhado à borda interna do
cartão, como o texto à direita das linhas) é a recomendação; o usuário vê no app antes de aprovar o
golden.

## 7. Brief para a Implementação

### Brief para a Implementação
- Pedido e decisão do usuário: "remova os icones de reesumo e tarefas completas, deixe somente a visão
  resumida" (2026-11-04). Pendentes: dúvidas 1 e 2 acima (não bloqueiam este commit; B da dúvida 1 é
  um segundo commit).
- Cenários: reescritos (com `Reescrito:`): `cabecalho.numeros-somam-o-desenhado`,
  `cabecalho.resumida-exclui-pedido-finalizado`, `cabecalho.resumida-limpa-so-com-tudo-concluido`,
  `cabecalho.limites-de-linhas`, `cabecalho.historico-abre-com-clique`,
  `pedidos.resumida-mantem-anteriores-com-algo-aberto`, `sessoes.cartao-vivo-nunca-some`,
  `durabilidade.respawn-sem-session-start`, `visual.cabecalho-em-cartao`,
  `visual.cabecalho-barra-e-chips-desenhados`, `visual.desenho-principal`, `visual.desenho-cartao-filha`,
  `visual.desenho-envios`; conforme a dúvida 1: `pedidos.plano-anterior-vira-historico`,
  `cabecalho.interrompida-fora-do-total`, `cabecalho.limite-de-linhas-do-desenho`,
  `envios.cor-por-estado`; pelas correções (§3 c): `durabilidade.reinicio-restaura-do-store`,
  `sessoes.filha-parada-pendentes-seguem-pendentes`, `turnos.subagente-que-termina-interrompe`;
  aposentado: `cabecalho.limite-de-cartoes-antigos` (cenário e teste removidos, selo removido com
  `--remover`); sem mudança que protegem a área: os demais de `cabecalho.md`, `pedidos.md`,
  `sessoes.md`, `visual.faixa-de-estado-geral`.
- Correções no mesmo commit (§3 c): `work` restaurado no resume e `trimToWork` tolerante a `work`
  sem id presente; cartão sem `work`/`turns` guarda todos os níveis 1; grupos de subagente sem âncora
  ficam. Os testes existentes reproduzem as três (passam a rodar na resumida).
- Matriz de impacto: núcleo (`render.tsx`, `types`) → todos os cenários; checklist (12) e golden (3).
- Testes existentes que vão mudar: a lista de §3 (selo `decisao`, motivo com as palavras dele, data
  2026-11-04). Nenhum outro pode mudar; se a suíte acusar outro, parar e relatar (não ajustar).
- Arquivos a escrever, de uma vez: `hooks/render.tsx`, `hooks/command.ts`, `hooks/panel.ts`,
  `hooks/session-start.ts`, `state/durability.ts`, `types/index.d.ts`, `draw/layout.ts`,
  `draw/geometry.ts`, `draw/svg.ts`, `text/rules.ts`, `tests/kit/cenario.ts`, `tests/kit/leitura.ts`,
  `tests/cabecalho.test.ts`, `tests/durabilidade.test.ts`, `tests/sessoes.test.ts`, `regras/*.md`,
  `regras/selos.json`, `DESENVOLVIMENTO.md`; golden após a validação dele. Commit sugerido:
  `feat(task-tree)!: só a visão resumida, sem os botões ≡ e ▤` (o `!` porque `/task-tree completa`
  deixa de existir; se preferirem minor, sem o `!`).
- O que o usuário valida no app: o cabeçalho sem os botões nos dois temas, largo e a 60 colunas
  (título com mais espaço, bloco de números na borda); o painel mostrando só o trabalho atual;
  "+N pedidos anteriores" quando o trabalho tem mais de 3 pedidos; o cartão vivo solto; `/task-tree`
  ainda abre o pane.
