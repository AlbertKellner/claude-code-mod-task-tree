# Lote 24: filha arquivada antiga vira uma linha

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário).

## 1. O que cobre

- Achado "Filhas arquivadas e antigas nunca saem: painel inteiro guardado no state, arquivo relido a cada
  3 s, tudo republicado aninhado; a lista do host é pedida com limite 100": a decisão (a parte direta é o
  lote 13).
- Decisão 11, 2026-11-14: **"Vira linha resumida (Recomendado)"**. A opção: "Vira uma linha com nome e
  contagem depois que o pedido dela sai do trabalho atual: o histórico fica resumido, e uma orquestradora
  que dura dias deixa de carregar e reler o painel inteiro de cada filha antiga."

## 2. Causa confirmada na ponta atual

Escrito no código:
- `io/host.ts:144-169` (`deriveChildren`): toda filha listada, arquivada inclusive, fica no state com o
  painel inteiro (`panel`), e assim vai ao arquivo publicado (`io/publish.ts:137`);
- `draw/layout.ts:179` (`panelOf`): o cartão arquivado é desenhado com todas as tarefas, o que ficou
  aberto como interrompido; `layout.ts:1319`: "Archived sessions stay, as history".

Regra registrada que a decisão reescreve: `sessoes.filha-arquivada-interrompe` (origem: regra do painel
desde a entrada do mod, "Arquivada fica, como histórico").

## 3. O que muda

`types/index.d.ts`, `hooks/sessions.ts`, `io/host.ts`, `draw/layout.ts`.

- `Child` ganha um resumo opcional (sugestão: `summary?: { d: number; n: number; x: number; time?: number
  }`): as concluídas, o total e as interrompidas do cartão, e o tempo dele.
- Quando resumir (`refreshChildren`, depois de derivar as filhas): a filha **arquivada** cujos pontos de
  ligação (a tarefa de abertura, a do último envio e as das rodadas) estão todos fora do trabalho atual
  (as tarefas de nível 1 de `work` e as outras do mesmo pedido, a mesma conta de `openInSight`,
  `draw/layout.ts:785-788`) perde o painel no state (`panel` e `tasks` saem) e fica com o resumo,
  calculado com a conta de hoje (`total` do cartão, com as rodadas divididas). A filha sem tarefa de
  origem nenhuma segue a mesma regra (está fora do trabalho).
- Enquanto está resumida, o arquivo dela não é lido (com o lote 13, a arquivada já não é relida; aqui a
  regra vale também para a que acabou de ser resumida).
- Volta ao cartão inteiro, com uma leitura do arquivo: se a sessão é desarquivada, ou se o pedido dela
  volta ao trabalho atual (um start numa tarefa dele).
- Depois de um reinício da sessão mãe (as filhas voltam do store só com as ligações), a primeira leitura
  lê o arquivo, e a regra resume de novo.
- Desenho (`session`): a filha resumida é uma linha só: o nome, a contagem do resumo (d/n), a palavra
  "arquivada" e o tempo; sem tarefas embaixo e sem dobra. Como o pedido dela está fora do trabalho, a
  linha só aparece com "+N pedidos anteriores" aberto (ou entre os cartões antigos sem tarefa).
- Contas (`total`): a filha resumida entra com os números do resumo, de modo que o x/y da tarefa de
  origem e a conta da sessão inteira não mudam. As tarefas dela deixam de existir como linhas, e por isso
  não entram na soma do cabeçalho quando o histórico está aberto (o cabeçalho soma as linhas
  desenhadas); é a única diferença de número, só com o histórico aberto.
- O painel publicado leva a filha resumida sem o painel dela: a sessão de cima a desenha como a mesma
  linha.

Comportamento novo no painel: a filha arquivada segue com o cartão inteiro enquanto o pedido dela está no
trabalho atual; quando o pedido sai (vai para "+N pedidos anteriores"), ela vira "nome  d/n  arquivada".

## 4. Impacto

`npm run impacto -- types/index.d.ts hooks/sessions.ts io/host.ts draw/layout.ts`: núcleo tocado: todos
os 159 cenários cobertos; os 4 do golden; ver 8.

## 5. Testes a escrever

`tests/sessoes.test.ts`, regra `sessoes.arquivada-antiga-vira-linha` (nova):
1. **"a filha arquivada cujo pedido saiu do trabalho vira uma linha com nome e contagem"**. Roteiro: `const
   h = await abrir($, on, { rodando: false, arquivada: true, painel: { tasks: [tarefa('P', 'Pai da
   filha', 'aberta', [tarefa('P/1', 'Feita', 'feita'), tarefa('P/2', 'Aberta')])] } })`; o painel mostra o
   cartão inteiro ("Feita" e "Aberta" desenhadas: o pedido está no trabalho); `done(['1', '2.1'])`;
   `fimDoTurno`; `pedido($, 'Pedido novo')`; `plan` de "N" com "n1"; `start(['n1'])`; `aviso`;
   `const p = await comHistorico($, 1)`.
   Afirma: há a linha de sessão "filha-um" com "arquivada" e "1/1"; não há linhas "Feita", "Aberta" nem
   "Pai da filha"; a linha "Um" contém "2/2" (o x/y de antes); a filha no painel publicado
   (`h.proprio().children[0]`) não tem `panel` e tem o resumo. Com o `leituras` do lote 13: dois `aviso`
   a mais não leem o arquivo.
   Falha hoje: o histórico mostra o cartão com as três linhas, e o publicado leva o painel inteiro.
2. **"desarquivada, a filha resumida volta ao cartão inteiro"**. Depois do roteiro de 1:
   `h.filha(K1).arquivada = false`; `aviso`; `comHistorico`. Afirma: "Feita" volta a ser desenhada.
   Falha hoje pelo estado anterior (não existe o resumo).

Testes existentes: `sessoes.test.ts:83` (filha arquivada com o pedido no trabalho) não muda;
`cabecalho.limite-de-cartoes-antigos` (cartões antigos sem tarefa) deve seguir igual: conferir na
`regressao`.

## 6. Catálogo e selos

`regras/sessoes.md`:

```markdown
### sessoes.arquivada-antiga-vira-linha
A filha arquivada cujo pedido saiu do trabalho atual vira uma linha com nome e contagem.

- Dado uma filha arquivada, com o cartão sob uma tarefa de um pedido
- Quando esse pedido sai do trabalho atual (vai para "+N pedidos anteriores")
- Então o cartão dela passa a ser uma linha só, com o nome, a contagem e "arquivada", sem as tarefas; o x/y da tarefa de origem e a conta da sessão inteira não mudam; o painel dela deixa de ser guardado, relido e republicado; desarquivada, ou com o pedido de volta ao trabalho, volta ao cartão inteiro

Origem: decisão do usuário, 2026-11-14 ("Vira linha resumida (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (as filhas arquivadas antigas ficavam inteiras no state e no painel publicado, sem teto).
Código: hooks/sessions.ts, io/host.ts
Estado: coberto
```

`sessoes.filha-arquivada-interrompe`: o "Dado" passa a "uma filha arquivada com tarefas abertas, com o
pedido dela no trabalho atual", e a linha `Reescrito: 2026-11-14, decisão do usuário ("Vira linha resumida
(Recomendado)"); desfaz "Arquivada fica, como histórico" para o pedido que saiu do trabalho, onde ela
vira uma linha (sessoes.arquivada-antiga-vira-linha). O teste não muda.`

Selos: `--tipo novo` para os dois testes, motivo `decisão do usuário, 2026-11-14: "Vira linha resumida
(Recomendado)"`.

## 7. Documentação

`DESENVOLVIMENTO.md`: o trecho "O que a filha mostra" (~1298-1311: "arquivada… com o cartão aberto como os
demais") e a leitura das filhas; o comentário de `Child` em `types/index.d.ts:155-210`; entrada em
"Decisões (histórico)".

## 8. Golden

Não muda (nenhum cenário tem filha arquivada).

## 9. Checklist do app

- Numa orquestradora real com uma filha arquivada de um pedido antigo: abrir "+N pedidos anteriores" e
  ver a linha "nome  d/n  arquivada", nos dois temas, sem ícone de dobra.

## 10. Dependências e conflitos

- Depois do lote 13 (a arquivada não é relida; o `leituras` do kit) e do lote 17 (a conta única dos
  cartões). O lote 23 (histórico do `/clear`) entra na conta do resumo.
- Triagem C: decisão 35 ("Enxugar e esvaziar" os arquivos publicados), decisão 37 (guardar o painel
  enquanto a sessão existir) e a correção do teto do store mexem no que é guardado e publicado;
  decisão 32 (`/clear` com filhas). Triagem B: a correção ""+N pedidos anteriores" decidido por pedido" e
  a decisão 28 ("Total da sessão inteira… na linha +N") mexem em como o histórico conta: a filha
  resumida entra nos totais pelo resumo.

## 11. Bloqueio

Nenhum.
