# correcao-regressao · bug G: painel da orquestradora congelado — medição (antes de corrigir)

2026-10-22, 23:0x. Código medido: o working tree da branch fix/painel-serie-2 (commit 1 + item 2 sem commit),
que é o que o clone carrega.

## Sonda (cópia do mod no scratchpad; estado publicado real da orquestradora, 543 KB, 7 filhas)
O teste do orçamento virou medição: session.start com o painel dela no store, lista do host com as 7 filhas,
o arquivo de cada filha a partir do painel publicado; mount + drawn em cada superfície e visão (100 colunas).

| superfície/visão | bytes | nós | profundidade | maior Svg | Svg somados | ms | aviso/erro |
|---|---|---|---|---|---|---|---|
| terminal/resumida | 8.040 | 105 | 4 | — | — | 135 | não |
| terminal/completa | 8.379 | 108 | 4 | — | — | 135 | não |
| desktop/resumida | 33.405 | 84 | 5 | 1.706 | 22.411 | 132 | não |
| desktop/completa | 35.476 | 89 | 5 | 1.725 | 24.050 | 130 | não |

Limites do app: 100.000 caracteres serializados, 20.000 nós, 32 níveis, 131.072 por Svg → tudo muito abaixo.
Cabeçalho do desenho: "Corrigir a hipótese do congelamento na correção 1 de 13 · 8% (sessão inteira: 1086 de 1098)".

## Arquivo publicado da orquestradora (23:01:43, regravado agora)
renderError = null; drawSize = 19.965; rows = 10; panes = [{task-tree, isPlaced: true, isShown: true}];
work = ['g1']; um send pendente (g1 → correcao-regressao).
drawSize volta a 0 numa recarga do mod: 19.965 prova que o ui.render dela rodou depois da última recarga e
devolveu um desenho pequeno, sem erro, com o pane colocado e na frente.

## Conclusão parcial
Com o estado atual, o módulo desenha (pequeno, sem exceção, ~130 ms) e o app diz que o pane está à vista.
Descartados: limite de tamanho/nós/profundidade/Svg, exceção no render, render lento. O congelamento é do
lado de quem redesenha o pane (o app não pede redesenho, ou não mostra o que recebe), ou um estado que já
passou. Para separar, preciso de observação no app (só o usuário/orquestradora):
1. Rodar `/task-tree` na orquestradora: a resposta diz se o app pôs o painel, os panes e o tamanho do
   desenho atual ("Desenho: N KB de 600 KB").
2. Clicar ≡ ou ▤ (ou `/task-tree resumida` / `/task-tree completa`): se o painel muda, o render responde a
   eventos e o que parou é o redesenho automático (relógio de 1 s ou o redesenho após mudança de estado).
3. "Congelado" = conteúdo velho (tarefas novas não aparecem) ou pane em branco/sem resposta?
4. Hora aproximada em que parou (para cruzar com as recargas do clone, que acontecem a cada edição minha).
Hipótese a testar a seguir, se o item 2 indicar redesenho automático parado: o relógio (`keepTime`/`tick`,
`$.ui.invalidate`) só roda com algo "rodando" e é reiniciado por eventos; depois de uma recarga do clone
(a cada edição), a variável do relógio some até o próximo evento que o reinicia.

## Dado do usuário e amostragem (23:04–23:05)
- `/task-tree` na orquestradora: "Painel de tarefas aberto. Painéis: task-tree (na frente). Desenho: 18 KB de 600 KB."
- Amostragem do arquivo publicado a cada 5 s por 90 s (cada publicação traz `drawSize`/`rows` do último render):
  23:04:02 rows 15 / 26.317 B, work [q1]; 23:05:13 idem; 23:05:23 rows 14 / 23.800, work [v1];
  23:05:30 rows 3 / 7.939; 23:05:40 rows 4 / 10.503. renderError nulo em todas.
  → o render roda a cada mudança de estado e acompanha o estado. O mod entrega desenhos novos.
- Doc do kit (types/claude-code/index.d.ts): redesenho em (1) gravação de `$.state` lido no desenho, (2)
  `$.ui.invalidate`, (3) carga do plugin; erro no desenho → desenho do app, não congela. No mod, o único
  `invalidate` é o relógio de 1 s (`tick`), que só roda com tarefa cronometrando (start) ou sessão viva.
- Perguntas ao usuário (pela orquestradora): conteúdo velho na tela ou só relógio parado? fechar/reabrir ou
  trocar de visão destrava? Sem isso, nenhuma causa no mod a corrigir.

## Respostas do usuário e teste de recarga
- (a) a tela mostra as tarefas atuais; (b) os relógios voltaram a contar; (c) trocar completa/resumida
  redesenha. Congelamento não reproduzido agora; coincidiu com as recargas do clone (minhas edições).
- Teste `task-tree/tests/relogio-recarga.test.ts` (2): recarga (módulo novo, state semeado) com tarefa
  cronometrando, só o desenho do painel → espera `clock.every(1000)`. **Vermelho na branch**: `Expected:
  containing 1000`, `Received: []` (log scratchpad `vermelho-relogio.log`). O controle (nada cronometrando
  → sem relógio) passa. Defeito real: depois de uma recarga o relógio só volta com um evento.
- Correção planejada (commit próprio, depois do A/F): o desenho chama `keepTime`/`watchSessions` (o kit
  não recusa `$.clock.every` no desenho; só `state.set`). Teste guardado em scratchpad/espera até o A/F.

## Correção (retomada depois do reinício; branch em 3a762a9)
- Vermelho confirmado de novo: "com uma tarefa cronometrando, o desenho da recarga já pede o relógio de 1 s,
  sem nenhum outro evento": Expected: containing 1000, Received: [] (346 pass, 1 fail).
- `task-tree/hooks/render.tsx`, `render`: depois de ensureGroups/ensureView/ensureWork, `await keepTime($)` e
  `watchSessions($)` (o desenho da carga do mod religa os relógios; não fazem nada se já ligados).
- Suíte: 347 pass / 0 fail em 2 rodadas; validate ok (`$.clock.every (via keepTime, watchSessions)`);
  0 GOLDEN-NEW / TEXTOS-NEW; orçamento 11.741 / 11.859 / 47.484 / 48.246.
- Commit sugerido: `task-tree/hooks/render.tsx`, `task-tree/tests/relogio-recarga.test.ts` (novo) + patch da
  docs. Mensagem: `fix(task-tree): o desenho religa os relógios do painel depois de uma recarga do mod`
