# Achados no app sobre o PR 37: análise e correções

Sessão `codificacao-migracao-nativo`, 2026-11-13.

## Estado

As correções estão aplicadas no clone (`feat/painel-nativo`, ponta `22ad5de`), sem commit e sem `golden:aprovar`. Elas esperam o "funcionou" do usuário.

`npm run check`: regras, travas, selos, os dois validate e o tsc passaram. Os testes deram 229 aprovados e 4 reprovados, só o golden (principal, filha, envios, subagente), como esperado. A regressão não roda enquanto o golden falha.

Arquivos alterados:
- `task-tree/draw/desktop.tsx`
- `task-tree/hooks/render.tsx`
- `task-tree/tests/visual.test.ts` (2 testes novos, selados)
- `regras/visual.md` (2 cenários novos)
- `regras/selos.json`

## Primeiro achado: o cartão não aparece ("nao aparece nenhum card")

Era bug, uma regressão da migração. O cartão nativo usava o fundo `userMessageBackground` e a borda padrão, e os dois saíam iguais ao painel.

Correção, no `CARD` de `draw/desktop.tsx`, que é o mesmo para o cartão de sessão filha e o de subagente:
- **Fundo:** `rgba(128,128,128,0.06)`, perto de `#20201f` no tema escuro e de `#f7f7f7` no claro.
- **Borda:** `rgba(128,128,128,0.22)`, perto de `#353534` no escuro e de `#dddddd` no claro.

O kit não tem chave de tema para uma superfície um passo acima do painel, por isso a cor translúcida, que se ajusta aos dois temas.

Teste e cenário: `visual.cartao-destaca-do-painel`.

## Segundo print ("outro exemplo de comportamento estranho")

A migração não mudou a lógica das linhas: `layout.ts` só perdeu `frames`, e os hooks de estado não mudaram. Por isso, a ordem e o lugar de cada linha são os mesmos da `main`. Só o desenho de cada linha mudou.

### 1. O turno atual cai no cartão errado

Não é regressão.

- Quando a mensagem foi entregue, esta sessão ainda não tinha planejado nada para ela. Esse turno não tinha tarefas, e por isso não havia cartão sob o ✉.
- O sinal de que a sessão está trabalhando aparece no rótulo do cartão que já existia: o cartão vivo do pedido cortado, desenhado solto no fim, conforme o cenário `sessoes.cartao-vivo-nunca-some`.
- Assim que esta sessão planejou, o cartão do turno novo passou a aparecer sob o ✉.
- **Pergunta para o usuário:** quer um cartão "trabalhando" sob o ✉ antes de a filha planejar? Isso é comportamento novo, por isso não mudei.

### 2. O plano da migração está sob o pedido errado

Não é bug. O painel agrupa as tarefas de nível 1 pela mensagem em que foram planejadas.

- O brief de abertura planejou só "Ler o brief e o código" e o planejamento. Essas tarefas ficam sob a origem, que está cortada em "+57 pedidos anteriores".
- O nível 1 "Migrar em etapas com check e commit" (e o push e o relatório) foi planejado no turno aberto pela mensagem do esforço. Conferi no histórico desta sessão: o `plan` com "Migrar em etapas…" veio depois daquela mensagem.
- Pelas regras, ele fica sob esse ✉.

### 3. O cartão da sessão não tem moldura

Era bug, com duas causas.

- **A mesma do primeiro achado:** o cartão de sessão usa o mesmo `CARD`. Corrigido junto.
- **Achado novo no print:** os ícones do primeiro nível, o ▸ de "+N pedidos anteriores" e o cartão solto encostavam na borda esquerda e saíam cortados pela metade. Com isso, a borda esquerda do cartão solto também sumia.
  - Correção: as linhas da árvore ficam num bloco (`Box key="tree"`) recuado uma coluna (`hooks/render.tsx`).
  - Não sei a causa exata no app: o harness não pinta. O recuo deve tirar os ícones da borda; confira no app.
  - Teste e cenário: `visual.arvore-afastada-da-margem`.

### 4. "Etapa 2" e "Etapa 4" com 0:00, e falhas nas guias

O 0:00 está certo pelas regras: as duas tarefas foram fechadas sem start, junto com a etapa anterior. Isso vem do uso que esta sessão fez do painel, não do plugin.

As falhas nas guias │ são o espaço entre as linhas de texto do app. O caractere │ não ocupa a altura toda da linha, e isso vem da decisão "Caracteres (Recomendado)", que pedia guias de caixa em fonte mono. Não mexi.

**Pergunta para o usuário:** se quiser guias contínuas, há duas saídas:
- desenhar as guias como `Box` finos com fundo, o que é nativo, mas desfaz "Caracteres";
- voltar a guia para `Svg`, o que desfaz "Vai para nativo" nesse ponto.

## O que conferir no app, nos dois temas

1. O cartão de subagente e o de sessão filha têm fundo próprio e borda arredondada visível. O app também aplica a cor translúcida na borda.
2. Os ícones do primeiro nível e o ▸ de "+N pedidos anteriores" aparecem inteiros. O cartão solto não encosta na borda.
3. O recuo de uma coluna não ficou largo demais.

## Respostas do usuário e guias contínuas (2026-11-13)

- **Cartão "trabalhando" sob o ✉:** "Deixar como está". Nada mudou.
- **Guias:** "Caixas finas nativas (Recomendado)". As guias │ ├─ └─ deixaram de ser caracteres e viraram caixas nativas finas (`draw/desktop.tsx`, `guideCell`).
  - Cada nível ocupa uma célula de 3 colunas, alinhada com o ícone do pai.
  - A linha vertical fica no meio da célula, com 8% da largura (cerca de 2 px). A horizontal vai do meio até a borda direita, com 0,1 da altura da linha.
  - A cor é `rgba(128,128,128,0.4)`, nos dois temas.
  - Linhas uma embaixo da outra se encontram, sem falha.
  - Ao lado de um cartão, a faixa tem a guia da linha do cartão na altura da primeira linha. Embaixo dela, um trecho cresce pela altura inteira do cartão.
- **Catálogo e testes:**
  - Cenário `visual.guias-continuas` com `Reescrito: 2026-11-13, decisão do usuário ("Caixas finas nativas (Recomendado)")`.
  - Um teste novo, selado.
  - Nenhum teste existente mudou: nenhum lia as guias no app.
- **Documentação:** `CLAUDE.md` (checklist) e `DESENVOLVIMENTO.md` atualizados.
- **Check:** tudo ok até o tsc. Os testes deram 230 aprovados e 4 reprovados, só o golden dos 4 cenários. Sem commit e sem `golden:aprovar`.
- **A conferir no app, nos dois temas:**
  - guias contínuas, sem falhas entre as linhas;
  - ├ e └ no meio da célula, sob o ícone do pai;
  - o traço horizontal chegando ao ícone;
  - a guia descendo sem corte ao lado dos cartões;
  - a espessura e a cor visíveis sem pesar.

## Contraste por nível e espaço interno (2026-11-13)

Pedido do usuário: "aumente um pouco o contraste do card, deixando ele um pouco mais claro, e repita isso para cada card dentro de card. aumente um pouco o padding interno tambem, os textos estão muito colados, tando dentro do cartao, quanto fora".

- **Fundo do cartão:** de 6% para `rgba(128,128,128,0.1)`. Como é translúcido, cada cartão dentro de outro soma mais um degrau, regular.
  - Tema escuro (painel `#1a1a19`): `#242423`, depois `#2d2d2c`, depois `#353534`. Clareia a cada nível.
  - Tema claro (painel branco): `#f2f2f2`, `#e6e6e6`, `#dbdbdb`. Escurece a cada nível, com o mesmo contraste relativo.
- **Borda do cartão:** de 22% para `rgba(128,128,128,0.3)`, perto de `#40403f` no escuro e de `#c9c9c9` no claro, no primeiro nível.
- **Espaço:**
  - Cada linha passa de 1 para 1,3 linha de altura.
  - O título fica a 1,5 coluna do ícone (antes, 1).
  - O cartão tem 1,5 coluna de recuo nas laterais (antes, 1) e 0,3 linha em cima e embaixo (antes, 0). `CARD_COLS` passou a 4.
  - A faixa de guias ao lado do cartão ganhou um trecho de 0,3 linha em cima, para o conector seguir na altura da linha do cartão sem falha.
- **Valores fracionários:** o kit aceitou altura fracionária (`height={0.2}`) na sondagem. Recuo fracionário (1,5 e 0,3) é novo: confira no app se ele é respeitado.
- **Catálogo e testes:**
  - `visual.cartao-destaca-do-painel` ganhou `Reescrito:` com as palavras do usuário.
  - Cenário novo `visual.espaco-interno`, com um teste novo.
  - O teste do cartão foi ajustado e selado de novo. Ele ainda não está no `HEAD`, por isso o selo é de teste novo.
- **Check:** tudo ok até o tsc. Os testes deram 231 aprovados e 4 reprovados, só o golden.
