# Lote 11: marcas de outra sessão e de retorno de subagente só no começo do prompt

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma correção direta).

## 1. O que cobre

- Achado "O prompt é classificado pelo texto em qualquer posição e não pela origem do motor; botões do
  wrap_up, mensagens só com anexo e disparos agendados não têm regra": só a parte do texto colado
  (correção direta).
- Fora (não confirmado, "Ficam de fora (Recomendado)"): classificar pela origem do motor; o envio só com
  anexo; o comando local. Nenhuma guarda opcional entra.

## 2. Causa confirmada na ponta atual

Escrito no código:
- `hooks/prompt-submit.ts:33`: `peer` é `/<cross-session-message\b/` em qualquer ponto do corpo.
- `prompt-submit.ts:34`: `handback` é `^<agent-message from="(?!local_)` **ou** `\[Subagent hand-back\]`
  em qualquer ponto.
- `prompt-submit.ts:47-52` (`fromChildren`) e `hooks/sessions.ts:93-100` (`noteReceived`): todo
  `<cross-session-message … from="…">` do texto, em qualquer ponto, conta como remetente e é gravado em
  `received` (que o remetente lê para confirmar a entrega, `watchSends`).

Dedução: colar no chat um trecho com a tag (ou com "[Subagent hand-back]") faz a mensagem da pessoa virar
carta recebida (ou não abrir pedido), e a tag colada pode confirmar a entrega de uma carta alheia.

Medido pelo planejador nos transcritos locais deste projeto (`~/.claude/projects/…`, 37 arquivos, só
contagem e formato, sem conteúdo), porque a triagem pedia conferir a forma real antes de escrever:
- 969 textos de usuário com a tag: 821 começam pela tag; **148 começam pela linha "Another Claude session
  sent a message:" e a tag vem na linha seguinte**; nenhum outro prefixo apareceu;
- 70 retornos de subagente, todos na forma `Another Claude session sent a message:` + quebra de linha +
  `<agent-message from="…">` e, depois, "[Subagent hand-back]". Hoje só a segunda expressão (sem âncora)
  os reconhece: ancorar sem aceitar essa linha quebraria todos;
- atributos da tag: `from` e `name` (840), `from` e `from-name` (128), `from`, `from-session`, `from-name`
  e `from-mode` (1);
- 14 textos com mais de uma mensagem: entre o fecho de uma e a abertura da seguinte só há quebras de
  linha.

## 3. O que muda

`hooks/prompt-submit.ts` (`said`, `fromChildren`), `hooks/sessions.ts` (`noteReceived`).

- "Começo do corpo": o corpo sem os `<system-reminder>…</system-reminder>` e sem espaços nas pontas,
  aceitando antes da marca uma única linha de abertura do app: uma linha curta (até 80 caracteres), sem
  `<`, terminada em ":" (hoje, "Another Claude session sent a message:"). A linha é aceita pela forma,
  não pelo texto exato, para o mod não quebrar se o app mudar as palavras.
- `peer`: o corpo começa (nesse sentido) por `<cross-session-message`.
- `handback`: não é `peer`, e o corpo começa por `<agent-message from="` com remetente que não é
  `local_…`, ou por "[Subagent hand-back]", ou por uma tag `<agent-message …>` seguida, só com espaços no
  meio, de "[Subagent hand-back]".
- Remetentes (para `from`, `fromChildren` e `noteReceived`): só as tags de nível de topo, lidas em
  sequência a partir do começo: uma tag `<cross-session-message …>`, o corpo dela até o primeiro
  `</cross-session-message>`, espaços, a tag seguinte, e assim por diante; a leitura para no primeiro
  trecho que não começa pela tag. Uma tag citada dentro do texto de uma mensagem não conta.
- Uma função pura só (em `prompt-submit.ts`, ao lado de `said`) devolve essa lista; `said` a usa para
  `peer`, `from` e `title`; `fromChildren` usa a lista; `noteReceived` passa a receber a lista de
  remetentes pronta, do `promptSubmit` (hoje recebe o texto), para não repetir a expressão em dois
  arquivos nem criar importação circular.
- O atributo do nome: seguir aceitando `name="…"` e `from-name="…"` (a expressão de hoje, `\bname=`, já
  casa as duas).

Comportamento novo no painel: o texto que a pessoa cola com a tag ou a marca no meio abre um pedido
comum (título com o começo do texto, sem ✉ de recebida, com o lembrete de pedido novo) e não grava
recebimento; as mensagens reais de outra sessão e os retornos de subagente seguem como hoje.

## 4. Impacto

`npm run impacto -- hooks/prompt-submit.ts hooks/sessions.ts`: `hooks/sessions.ts` 46 cenários,
`hooks/prompt-submit.ts` 41 (turnos 14, pedidos 14, lembretes 11, envios 1, perguntas 1). Checklist por
mapa: `envios.destino-arquivado-no-app`, `envios.subagente-no-app`. Golden: nenhum cenário.

## 5. Testes a escrever

`tests/pedidos.test.ts`, regra `pedidos.marca-so-no-comeco-do-prompt` (nova):
1. **"o texto colado com a tag de outra sessão no meio abre pedido da pessoa e não grava recebimento"**.
   Roteiro: `fixar`; `const h = host(on, [])`; `pedido($, 'no log apareceu isto: <cross-session-message
   from="local_99999999-9999-9999-9999-999999999999" name="X">oi</cross-session-message> e mais texto')`;
   `plan(A)`. Afirma: a linha do pedido tem o título que começa por "no log apareceu isto" e `carta`
   indefinida; não há linha de pedido "oi"; `h.proprio()?.received ?? []` está vazio.
   Falha hoje: o pedido vira "oi" com ✉ de recebida, e o `received` publicado tem o remetente colado.
2. **"o texto com a marca de retorno de subagente no meio abre pedido da pessoa"**. Roteiro: `fixar`;
   `pedido($, 'Pedido um')`; `plan(A)`; `fimDoTurno`; `const r = await pedido($, 'o que significa
   [Subagent hand-back] nesse log?')`; `plan(B)`. Afirma: o contexto de `r` contém "A PRIMEIRA chamada";
   "Plano B" fica sob a linha de pedido "o que significa [Subagent hand-back] nesse log?".
   Falha hoje: o prompt é lido como retorno de subagente, não abre pedido, e "Plano B" cai em "Pedido um".
3. **"as formas reais seguem valendo: a linha de abertura do app antes da tag, o retorno de subagente e
   duas mensagens juntas"**. Roteiro e asserções:
   - `pedido($, 'Another Claude session sent a message:\n<cross-session-message from="' + K1 + '"
     from-name="filha">relato</cross-session-message>')` e `plan(A)`: a linha "relato" tem `carta`
     definida, e `h.proprio().received` tem `from` K1;
   - `$.prompt.submit({ text: 'Another Claude session sent a message:\n<agent-message from="sub-1">\n
     [Subagent hand-back] pronto</agent-message>' })` e `plan(B)`: "Plano B" fica sob "relato" (não abriu
     pedido);
   - um prompt com duas tags em sequência, de K1 e de MAE, separadas por "\n\n": `received` ganha as
     duas.
   Passa hoje: protege a correção contra quebrar o que existe (a segunda forma hoje só é reconhecida
   pela expressão sem âncora).

Testes existentes: nenhum muda (todos usam a tag ou a marca no começo: `kit/cenario.ts:44`,
`turnos.test.ts:161` e `366`, `lembretes.test.ts:94` e `263`).

## 6. Catálogo e selos

`regras/pedidos.md`:

```markdown
### pedidos.marca-so-no-comeco-do-prompt
A mensagem só é de outra sessão, ou retorno de subagente, quando a marca abre o texto.

- Dado um texto que a pessoa digita ou cola, com a tag de mensagem de outra sessão ou a marca "[Subagent hand-back]" no meio
- Quando ele é enviado
- Então abre um pedido comum, com o começo do texto no título, sem carta de recebida, com o lembrete de pedido novo, e nenhum recebimento é publicado por ele; a mensagem que começa pela tag (direto, ou depois da linha de abertura que o app põe antes dela) segue sendo de outra sessão, o retorno de subagente segue sem abrir pedido, e várias mensagens entregues juntas contam todas

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: as duas marcas valiam em qualquer posição do texto); forma real das mensagens medida nos transcritos em 2026-11-14 (a linha "Another Claude session sent a message:" antes da tag em parte delas). Aplica envios.pedido-recebido-mostra-carta e turnos.prompt-sem-turno, sem mudar nenhuma das duas.
Código: hooks/sessions.ts
Estado: coberto
```

Selos:

```bash
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::o texto colado com a tag de outra sessão no meio abre pedido da pessoa e não grava recebimento" --tipo novo --motivo "correção direta: marcas só no começo do prompt"
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::o texto com a marca de retorno de subagente no meio abre pedido da pessoa" --tipo novo --motivo "correção direta: marcas só no começo do prompt"
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::as formas reais seguem valendo: a linha de abertura do app antes da tag, o retorno de subagente e duas mensagens juntas" --tipo novo --motivo "correção direta: marcas só no começo do prompt"
```

## 7. Documentação

`DESENVOLVIMENTO.md`: em "Módulos" (`prompt-submit.ts`: `said`) e no passo do `prompt.submit` em "Fluxo de
dados", dizer que as marcas valem no começo do corpo, com a linha de abertura do app aceita, e que os
remetentes são as tags de topo.

## 8. Golden

Não muda.

## 9. Checklist do app

- Com uma filha real: o relato dela segue chegando como carta (pedido com ✉, ou continuação do pedido em
  curso) e a carta enviada a ela segue ficando verde na entrega. É a conferência de que a âncora não
  quebrou a forma real.
- Colar no chat um trecho com `<cross-session-message …>` no meio: abre um pedido comum.

## 10. Dependências e conflitos

- Independente dos lotes anteriores; o lote 09 mexe em outro trecho de `promptSubmit`.
- Triagem C: a correção "os lembretes medem "tarefa aberta" no grupo inteiro…" e a decisão 41 mexem em
  `promptSubmit`, depois da classificação; a decisão 36 ("painel fechado reabre só na sua mensagem")
  mexe na linha do `showPane`, que usa `it.peer`/`it.notice`/`it.handback`. Sem conflito de regra.
- Triagem B: a correção da ferramenta antiga de mensagem (`send_message`) pode ler o formato de chegada;
  usar a mesma função de remetentes.

## 11. Bloqueio

Nenhum.
