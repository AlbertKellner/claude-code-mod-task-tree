# Lote 04 (triagem C): `/clear` e retomada limpos

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

Dois achados, o mesmo arquivo e a mesma função; correção direta, um commit:
- "/clear publica o painel antes de zerar waits e sends: o arquivo publicado fica dizendo 'aguardando'
  e com as cartas antigas".
- "Retomada (resume) num processo vivo troca só grupos, work e turno, e só se o store tiver cópia; o
  resto fica da sessão anterior" (a parte das cartas e ligações da sessão anterior é "não confirmado"
  e fica fora).

## 2. Causa confirmada na ponta

- Escrito, `hooks/session-start.ts:72-78`: no `/clear`, o `replace` (linha 73) grava e publica
  (`hooks/panel.ts:383-386` → `persist` 355-361 → `publishPanel` 506-530), e só depois as linhas 74 a
  77 zeram esperas, cartas, trabalho e fim do turno, sem publicar de novo. `io/publish.ts:133` grava
  `waiting` pelo número de esperas.
- Escrito, `hooks/session-start.ts:79-83` e `hooks/panel.ts:396-399`: na retomada, `restore` não faz
  nada quando o store não tem o painel da sessão retomada; `restoreWorkOf` (726-732) e
  `restoreTurn(…, true)` (95-106) idem. Nada toca `waits`, `brief` nem `recap`.
- Dedução: (a) a filha que termina o turno com pergunta do wrap_up e recebe `/clear` segue "aguardando"
  no cartão da mãe até publicar de novo; (b) retomar, no mesmo processo, uma sessão sem painel guardado
  mantém desenhado o painel da anterior, e a escrita seguinte o grava sob o id da retomada; com painel
  guardado, um "Aguardando sua escolha" da anterior segue no painel da retomada.

## 3. O que muda

`hooks/session-start.ts`, `classicSessionStart`:
- `/clear`: zera esperas, cartas, trabalho, fim do turno, resumo do done e recap **antes** do `replace`
  com o painel vazio, para a única publicação do ramo já sair limpa.
- Retomada: (1) antes de trazer o painel, zera as esperas, o resumo e o recap (são da sessão
  anterior); (2) quando o store não tem o painel da sessão retomada, o painel fica vazio como no
  `/clear` (grupos, trabalho e fim do turno), em vez de manter o da anterior; (3) com cópia, como hoje,
  e o trabalho e o fim do turno que a cópia não trouxer ficam vazios, não os da anterior.

`hooks/panel.ts`:
- `restore` passa a responder se trouxe o painel (para o ramo da retomada decidir esvaziar).
- Uma função para zerar esperas, resumo e recap sem publicar (as chaves `waits`, `brief` e `recap` já
  são literais deste arquivo; `session-start.ts` só tem `waits` e `sends`). A publicação fica com o
  `replace`.
- `restoreWorkOf` e `restoreTurn(…, true)`: sem registro no store, gravam vazio (trabalho `[]`; fim do
  turno como o `clearTurn`), em vez de deixar o valor da sessão anterior.

Em termos do painel: depois do `/clear`, o arquivo publicado da sessão diz que nada espera e não traz
cartas, e o cartão dela na mãe deixa de ficar âmbar. Depois de uma retomada, o painel é o da sessão
retomada ou "Nenhuma tarefa planejada.", nunca o da anterior, e não sobra "Aguardando…" da anterior.

## 4. Impacto

`npm run impacto -- hooks/session-start.ts hooks/panel.ts`: 69 cenários (durabilidade 9, envios 17,
turnos 14, pedidos 14, perguntas 8 e outros), por causa de `hooks/panel.ts`. Checklist do app:
`envios.destino-arquivado-no-app`, `envios.subagente-no-app` (não tocados pela mudança). Golden: nenhum.

## 5. Testes de verificação (`tests/durabilidade.test.ts`)

- "/clear com espera e carta: o arquivo publicado sai sem espera e sem cartas". Regra:
  `durabilidade.clear-publica-limpo`. Roteiro: `fixar`, `host` com uma sessão, `responderEnvio`,
  `responderDepois` do wrap_up (como em `perguntas.test.ts:124`); pedido, plan, start, um envio na fila,
  wrap_up com `ask`; `limpar`. Afirma, em `h.proprio()`: `waiting` falso, `waits` vazia, `sends` vazia,
  e o painel "Nenhuma tarefa planejada.". Falha hoje: a última publicação é a do `replace`, com a
  espera e a carta.
- "retomada sem painel guardado, 1/2: um painel no state" e "…, 2/2: a retomada esvazia o painel".
  Regra: `durabilidade.retomada-nao-herda-a-sessao-anterior`. Par como os de recarga (objeto próprio,
  `estado` em `captura` e depois `semear`, `armazem` vazio): o 2/2 confere o plano antigo desenhado,
  chama `retomar` com um id sem cópia e afirma o painel vazio. Falha hoje: o plano antigo fica.
- "retomada com espera da sessão anterior, 1/2" e "…, 2/2: a espera e o resumo da anterior não passam".
  Mesma regra. O 1/2 deixa no state um wrap_up com `ask` e um `done` com summary; o 2/2 (state
  semeado, `armazem` com o painel de `REINICIO`) retoma `SESSAO` e afirma: o painel é o Plano A, não há
  "Aguardando sua escolha", e o fim do turno seguinte não publica o resumo antigo. Falha hoje: a
  espera segue.
- Testes existentes: nenhum muda ("/clear esvazia o painel" e o par "retomada, 1/2 e 2/2" continuam
  passando: a retomada com cópia segue trazendo o painel dela).

## 6. Catálogo (`regras/durabilidade.md`) e selos

Novos, estado `coberto`:

```markdown
### durabilidade.clear-publica-limpo
Depois do /clear, o arquivo publicado da sessão sai sem espera e sem cartas.

- Dado uma sessão com uma espera aberta (a escolha do wrap_up) e uma carta na fila
- Quando a pessoa usa /clear
- Então o painel fica "Nenhuma tarefa planejada." e o que a sessão publica para a que a abriu já não diz que ela espera nem traz as cartas: o cartão dela na mãe não fica "aguardando"

Origem: auditoria 2026-11-10 (o /clear publicava antes de zerar as esperas e as cartas); aplica durabilidade.clear-esvazia, sem mudar nenhuma regra.
Código: io/publish.ts
Estado: coberto

### durabilidade.retomada-nao-herda-a-sessao-anterior
A retomada não herda o painel, as esperas nem o resumo da sessão anterior do mesmo processo.

- Dado um painel de outra sessão no state, com uma espera aberta e um resumo do done ainda não usado
- Quando uma sessão é retomada (resume) nesse processo
- Então o painel é o guardado para a sessão retomada ou, sem painel guardado, "Nenhuma tarefa planejada."; as esperas, o resumo e o recap da anterior não aparecem nem são gravados sob a retomada

Origem: auditoria 2026-11-10 (a retomada sem cópia no store mantinha o painel anterior); estende durabilidade.reinicio-restaura-do-store, sem mudar nenhuma regra.
Estado: coberto
```

Selos (um por teste novo, depois de escritos):
`npm run regras:selar -- "task-tree/tests/durabilidade.test.ts::<nome do teste>" --tipo novo --motivo "auditoria: /clear e retomada limpos"`.

## 7. Documentação

`DESENVOLVIMENTO.md` fica para o lote 30 (uma passada só). O comentário do topo de
`hooks/session-start.ts` (linhas 1-3) ganha "a resume empties what the store does not hold".

## 8. Golden

Não muda.

## 9. Checklist do app

- Numa filha real: terminar o turno com pergunta do wrap_up, `/clear` nela, e conferir na mãe que o
  cartão deixa de ficar âmbar "aguardando" em até 3 s.

## 10. Dependências e conflitos

- Antes dos lotes 05 e 07 (mesma função) e do 06 (`hooks/panel.ts`).
- Triagem A, lote 25 (dobras: "o /clear limpa as dobras") e lote 23 (/clear numa filha: o cartão na mãe
  mantém o histórico): mexem no mesmo ramo `clear` de `classicSessionStart` ou no que a mãe lê depois
  dele. Quem vier depois adapta a ordem das linhas: a regra daqui é "tudo zerado antes da publicação".
- Triagem A, lote 06 (o Esc também zera o resumo e o recap): mesmas chaves `brief` e `recap`.
- Lote 16 daqui tira a chave `recap`: o zerar do recap escrito aqui sai lá.

## 11. Bloqueio

Nenhum.
