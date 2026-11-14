# Lote 16 (triagem C): resposta inteira do turno fora do painel

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- A pergunta que sobra do achado "Textos que o modelo lê prometem tooltip com a resposta inteira…".
- Decisão 38: "Tirar, basta o ↩ (Recomendado)". A opção: "Basta o resumo ↩: tirar a resposta inteira
  do que o painel monta. Nada muda na tela." A pergunta dizia: "A resposta inteira de cada turno (até
  600 caracteres) é guardada e publicada, mas não aparece em lugar nenhum desde que o tooltip saiu."

## 2. Causa confirmada na ponta

- Escrito, `hooks/turn.ts:121-141`: no fim do turno, a resposta (o recap do wrap_up, senão a mensagem
  final, até 600 caracteres) é gravada em `reply` no turno do grupo principal, junto do `brief` (o
  summary do done). Vai ao state, ao store e ao arquivo publicado, de todos os turnos de todas as
  sessões.
- Escrito, `hooks/tool-call.ts:82` e `hooks/panel.ts:125-141`: o recap do wrap_up é guardado numa
  chave do state (`recap`) só para virar esse `reply`.
- Escrito, `draw/layout.ts:908-909`, `1222`, `1232` e `1291`: o desenho copia a resposta para um campo
  da linha (`whole`) que ninguém lê (busca na ponta: `draw/desktop.tsx` e `hooks/render.tsx` não o
  usam; o `whole` de `draw/head.tsx` é outra coisa, o "sessão inteira"). A constante `REPLY`
  (`draw/layout.ts:979`) também não tem uso.
- Teste que afirma o que sai: o par "recarga a quente, 1/2: o recap do wrap_up no state" e "…, 2/2: o
  fim do turno mostra o recap gravado antes da recarga" (`tests/durabilidade.test.ts:158-178`), do
  cenário `durabilidade.recarga-mantem-painel-ligacoes-e-resumo`. A decisão 38 é a decisão registrada
  que permite tirá-lo.

## 3. O que muda

- `hooks/turn.ts` (`turnComplete`): o fim do turno grava no turno só o `brief` (o summary do done),
  quando houver. Na mesma gravação, os turnos já guardados do grupo principal perdem o `reply` (o que
  versões anteriores gravaram sai do state, do store e do arquivo na primeira escrita). Sem summary,
  o fim do turno não grava nada no turno.
- `hooks/tool-call.ts` (`wrapUpAsk`): deixa de guardar o recap. `hooks/panel.ts`: saem `lastRecap` e a
  chave `recap` (e o zerar dela, escrito no lote 04 e, se já tiver entrado, no lote 06 da triagem A).
- `types/index.d.ts`: sai `reply` de `Turn` (o comentário passa a dizer que arquivos antigos podem
  trazê-lo e que ninguém o lê) e `recap` de `PluginState`. `state/durability.ts`: sai a linha `recap`
  da `TABLE`.
- `draw/layout.ts`: sai o campo `whole` da linha (`Row`) e as três atribuições; sai a constante
  `REPLY` e o comentário dela. A linha ↩ segue sendo o `brief`.

Em termos do painel: nada muda na tela. A linha ↩ de cada pedido é o summary do done, no painel e no
cartão da sessão na mãe. O painel guardado e o arquivo publicado ficam menores.

## 4. Impacto

`npm run impacto -- hooks/turn.ts hooks/tool-call.ts hooks/panel.ts draw/layout.ts
state/durability.ts types/index.d.ts`: núcleo tocado (`types/index.d.ts`), todos os 166 cenários
cobertos e o golden inteiro. Checklist: o do app inteiro vale como conferência; nada de novo a olhar.

## 5. Testes

Novos (`tests/turnos.test.ts`, com `host` para ler o arquivo publicado):
- "o fim do turno não guarda nem publica a resposta inteira". Regra:
  `turnos.resposta-inteira-nao-e-guardada`. Pedido, plan, start, done com summary, um wrap_up com
  recap, `fimDoTurno` com um texto de resposta. Afirma: o painel tem a linha ↩ com o summary; no
  arquivo publicado, o turno tem `brief` e não tem `reply`, e o texto da resposta e o do recap não
  aparecem em parte alguma do arquivo. Falha hoje: o `reply` leva o recap.
- "a resposta guardada por uma versão anterior sai na gravação seguinte". Mesma regra: `armazem` com
  um painel cujo turno tem `reply`; `iniciarSessao`, um pedido com done e fim do turno; o
  `session:<id>` do store e o arquivo publicado sem `reply`.

Existentes que mudam, só com a decisão registrada (o cenário ganha `Reescrito:` 2026-11-14):
- Saem os dois testes do par do recap citado no item 2, e com eles a constante `RECAP` do arquivo.
  Remoção com registro (o comando do lote 03).
- Nenhum outro muda. O helper `resposta` de `tests/durabilidade.test.ts:18-19` fica como está (ele
  aceita `brief` ou `reply`; mexer nele mudaria o selo do teste do resumo do done). O `reply` que
  `tests/visual.test.ts:120` põe no painel de uma filha é só um campo a mais no dado: o teste não
  muda.

## 6. Catálogo e selos

`regras/durabilidade.md`, `durabilidade.recarga-mantem-painel-ligacoes-e-resumo`, reescrito:
- título: "A recarga a quente mantém o painel e as ligações.";
- "Dado um painel com cartões ligados a tarefas"; "Então o painel e os cartões seguem iguais" (sai o
  recap; o resumo do done na recarga segue em `durabilidade.resumo-do-done-na-recarga`);
- linha nova: `Reescrito: 2026-11-14, decisão do usuário ("Tirar, basta o ↩ (Recomendado)"): o recap do wrap_up deixa de ser guardado; a resposta do turno no painel é só o resumo ↩.`

`regras/turnos.md`, novo, `coberto`:

```markdown
### turnos.resposta-inteira-nao-e-guardada
Do que o turno respondeu, o painel guarda só o resumo ↩.

- Dado um turno que termina com resposta final, com ou sem recap do wrap_up
- Quando o fim do turno é gravado
- Então o pedido fica só com o resumo ↩ (o summary do done), no painel, no que é guardado e no que é publicado; a resposta inteira e o recap não são guardados, e o que versões anteriores guardaram sai na gravação seguinte; sem summary, o pedido fica sem linha ↩

Origem: decisão do usuário, 2026-11-14 ("Tirar, basta o ↩ (Recomendado)"), à pergunta sobre a resposta inteira guardada e sem uso desde que o tooltip saiu (visual.tooltip, 2026-11-09).
Código: hooks/tool-call.ts, io/publish.ts
Estado: coberto
```

Comandos:
- `node scripts/selos.mjs --remover "task-tree/tests/durabilidade.test.ts::recarga a quente, 1/2: o recap do wrap_up no state" --tipo decisao --motivo "decisão 2026-11-14: a resposta inteira e o recap não são mais guardados"`
- `node scripts/selos.mjs --remover "task-tree/tests/durabilidade.test.ts::recarga a quente, 2/2: o fim do turno mostra o recap gravado antes da recarga" --tipo decisao --motivo "decisão 2026-11-14: a resposta inteira e o recap não são mais guardados"`
- `npm run regras:selar -- "task-tree/tests/turnos.test.ts::<nome>" --tipo novo --motivo "decisão 2026-11-14: só o resumo ↩ é guardado"`, um por teste novo.

## 7. Documentação

Comentários de `types/index.d.ts` (`Turn`), `hooks/turn.ts` (topo e `turnComplete`) e
`hooks/tool-call.ts` (topo: "a wrap_up keeps its recap" sai). `DESENVOLVIMENTO.md` (tabela e "Fluxo de
dados"): no lote 30.

## 8. Golden

Não deve mudar: o campo `whole` não é desenhado, e `reply` não entra na árvore do app. Se a etapa do
golden acusar diferença, é sinal de uso não visto: parar e conferir antes de regravar.

## 9. Checklist do app

- A linha ↩ de um pedido novo aparece com o summary, no painel e no cartão da sessão na mãe.
- Um pedido antigo, de antes deste lote, segue com a mesma linha ↩.

## 10. Dependências e conflitos

- Depois do lote 03 (a remoção dos dois testes junto com o código só passa na etapa `regressao` com o
  registro de remoção) e do lote 15 (os comentários do tooltip).
- Depois do lote 09 (a conferência de chaves do state: `recap` sai dos tipos e da tabela juntos).
- Triagem A, lote 06 (o Esc também zera o resumo e o recap): se entrar antes, o zerar do recap sai
  aqui; se entrar depois, só o resumo existe para zerar.
- Triagem A, lote 08 (o ↩ de um pedido sem tarefa fica num pedido próprio): mexe no mesmo trecho de
  `turnComplete` que escolhe em que turno gravar. Aqui muda só o que se grava (sem `reply`).
- Triagem A, lote 09 (turno que morre por erro) e triagem B, lote 19 (tempo só com turno em curso):
  outros trechos de `turnComplete`.

## 11. Bloqueio

Nenhum.
