# Lote 09: turno que morre por erro deixa a tarefa ✕ "falhou"

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário; estado novo).

## 1. O que cobre

- Achado "Turno da principal que morre por erro de API, limite de contexto ou recusa é tratado como fim
  normal".
- Decisão 8, 2026-11-14: **"✕ \"falhou\" (Recomendado)"**. A opção: "como o subagente que falha; a mensagem
  seguinte recebe o pedido de replanejar, e o cartão desta sessão na mãe indica a falha."

## 2. Causa confirmada na ponta atual

Escrito no código:
- `hooks/turn.ts:121`, `148`, `152`, `156`, `161`: o fim do turno do loop principal só lê `e.isAborted`.
- `hooks/agents.ts:152` (`subEnd`): só o subagente distingue `reason === 'error' || 'refusal'` ("falhou").
- Tipos do kit (`.claude-plugin/types/claude-code/index.d.ts`, `TurnCompleteReason`): `'answer' |
  'aborted' | 'refusal' | 'error'`; "error" é "dead on an API error (retries exhausted, the context
  limit)"; `isAborted` só é verdadeiro com `reason === 'aborted'`.
- A palavra "falhou" já existe na linha da tarefa: `draw/layout.ts:1135` (`t.failed ? 'falhou' :
  'interrompida'`), hoje posta só por `settleBySubs` (`hooks/agents.ts:300`).

Dedução: com `reason: 'error'` e uma tarefa em andamento, hoje ela fica ◷ "Aguardando", como quando o
modelo para de propósito; a mensagem seguinte recebe o lembrete comum; na mãe, o cartão diz "parada".

## 3. O que muda

O turno que termina com `reason` "error" ou "refusal" (sem `isAborted`) é tratado como o turno parado
com Esc, com palavra própria. Dedução do planejador: a recusa entra junto, como no subagente (a decisão
diz "como o subagente que falha").

`hooks/turn.ts`, `state/tasks.ts`, `hooks/panel.ts`, `hooks/prompt-submit.ts`, `state/durability.ts`,
`types/index.d.ts`, `draw/layout.ts`, `text/rules.ts`, `tests/kit/cenario.ts`.

1. `turnComplete` (loop principal), turno que falhou:
   - a resposta e o resumo não são gravados no pedido (como no Esc); `settleBySubs` segue rodando (não
     é Esc);
   - `turnAborted` e `replanDue` ficam verdadeiros, como no Esc (o desenho lê o que estava em andamento
     como interrompido, e a mãe lê `aborted` no arquivo publicado);
   - uma chave nova de state, `turnFailed` (booleana), fica verdadeira até o pedido seguinte: diz que a
     parada foi por erro, para o texto do lembrete;
   - as tarefas em andamento são marcadas como no Esc (`park`), com `failed: true` além de `stopped`.
     Com o lote 07 na ponta, este ramo roda no lugar da espera do fim normal.
2. `state/tasks.ts`: `park` aceita marcar `failed` nas folhas que para; `begin` (ramo da tarefa aberta) e
   `finish` passam a tirar `failed` junto com `stopped` (o start a reacende sem a palavra; o done a
   conclui). O `interrupt` de `draw/layout.ts` já mantém `failed` na cópia desenhada, e `halt`/`stay` já
   leem a folha `stopped` como interrompida: a linha sai ✕ "falhou" sem mudar o desenho.
3. `hooks/panel.ts`: o registro `turn` do store (`TurnRecord`, `saveTurn`, `ensureTurn`, `restoreTurn`,
   `clearTurn`) ganha o campo `failed`; registro antigo sem ele vale falso. `state/durability.ts`: linha
   `turnFailed` na `TABLE` (state+store, `turn`, campo, `current`, volta em start, resume e first-use),
   como `turnAborted`. `types/index.d.ts`: a chave em `PluginState` e uma frase no comentário.
4. `hooks/prompt-submit.ts`: no pedido seguinte (onde hoje se escolhe `PROMPT.interruptedByYou`), com
   `turnFailed` verdadeiro a mensagem da pessoa recebe `PROMPT.failedByError`; a de outra sessão segue
   com `PROMPT.interrupted`/`interruptedEmpty` (o texto "foi interrompido antes de terminar" serve). A
   chave volta a falso junto com `turnAborted` e `replanDue`. Nos turnos que não abrem pedido, a lista
   `PROMPT.parked` fica só com as paradas com Esc (`stopped` sem `failed`), e as que falharam vão em
   `PROMPT.failedTasks`.
5. `draw/layout.ts`, palavra do cartão (`session`, `layout.ts:1252`): o cartão de uma sessão parada, com
   tarefa aberta marcada `stopped` e `failed`, diz "falhou" no lugar de "parada". O resto do cartão é o
   da sessão parada com Esc: a tarefa ✕ "falhou", a rodada fora da contagem (`discarded`, pelo `aborted`
   e pela marca `stopped`), até o start nela.

Comportamento novo no painel:
- o turno morre por erro com X em andamento: X fica ✕ "falhou", fora do x/y, no chip "interrompidas";
  as pendentes seguem ○; nada acende em turnos seguintes até o start em X; o done a conclui;
- a mensagem seguinte da pessoa traz o pedido de replanejar, dizendo que o turno terminou com erro;
- na mãe, o cartão desta sessão diz "falhou" e a rodada sai da contagem, como no Esc.

Textos ao modelo (`text/rules.ts`), texto exato:
- `PROMPT.failedByError(list, answered)` (novo): o prefixo de resposta de `interruptedByYou` quando
  `answered`, e: "Painel de tarefas (task-tree): o turno anterior terminou com erro (falha da API ou
  limite de contexto) antes de concluir, e esta é a mensagem seguinte. Antes de seguir, replaneje o
  painel; esta mensagem abre um pedido novo. O que estava em andamento ficou ✕ "falhou" e só volta com
  mcp__task-tree__start nele. Se esta mensagem continua o trabalho (tarefas abertas: <lista>), siga
  essas tarefas pelos ids que já têm, com mcp__task-tree__start e mcp__task-tree__done, e planeje só o
  que ela pede de novo, com mcp__task-tree__plan e ids novos, na ordem em que vai executar: um plan com
  o id de um nível 1 da lista o deixaria como histórico, com as abertas interrompidas, e criaria uma
  cópia toda pendente. Se ela muda de rumo, feche ou cancele o que ela substitui e planeje só o pedido
  novo. Depois siga etapa por etapa com start e done."
- `PROMPT.failedTasks(list)` (novo): "Painel de tarefas (task-tree): estas tarefas estavam em andamento
  quando um turno terminou com erro e seguem ✕ "falhou" no painel: <lista>. Cada uma só volta a
  andamento com mcp__task-tree__start nela; a que já terminou, feche com mcp__task-tree__done."
- `RULES`, no item do Esc, acrescentar ao fim: "O mesmo vale quando o turno termina com erro (falha da
  API, limite de contexto): a tarefa fica ✕ "falhou" até o start nela."
- `PROMPT.parked`, `interrupted`, `interruptedEmpty` e `interruptedByYou` não mudam (os testes leem "o
  usuário parou (Esc)", "o usuário interrompeu" e "esta mensagem de outra sessão").

## 4. Impacto

`npm run impacto -- hooks/turn.ts state/tasks.ts hooks/panel.ts hooks/prompt-submit.ts state/durability.ts
types/index.d.ts draw/layout.ts text/rules.ts`: `types/index.d.ts` é núcleo (todos os 159 cenários
cobertos). Os 4 cenários do golden e todo o checklist aparecem por isso e por `draw/layout.ts`; ver 8.

## 5. Testes a escrever

Kit: `tests/kit/cenario.ts` ganha `falha($)`: `$.turn.complete({ reason: 'error', answer: '', durationMs:
1, isAborted: false, turnId: 't' })`.

1. `tests/turnos.test.ts`, regra `turnos.turno-que-falha-deixa-falhou` (nova):
   **"o turno que morre por erro deixa a tarefa em andamento ✕ "falhou", fora da contagem, até o start
   nela"**. Roteiro: `const { relogio } = fixar(on)`; `pedido`; `plan(A)`; `start(['2.1'])`;
   `relogio.advance(3000)`; `falha($)`. Afirma: "Dois.um" interrompida, a linha contém "falhou";
   "Um" e "Dois.dois" pendentes; `cabecalho(p)`: `total` 2, `chips.interrompidas` 1, `chips.aguardando` 0.
   Depois `aviso($)` e `fimDoTurno`: segue interrompida com "falhou", nada aceso. Depois
   `pedido($, 'segue')` e `start(['2.1'])`: em andamento, a linha sem "falhou", `total` 3.
   Falha hoje: "Dois.um" fica aguardando e conta.
2. `tests/turnos.test.ts`, mesma regra: **"o done na tarefa que falhou, sem start, a conclui"**: depois
   da falha e de `pedido`, `done(['2.1'])` sem erro; "Dois.um" concluída, sem "falhou".
   Falha hoje pelo estado anterior (a tarefa não fica ✕).
3. `tests/lembretes.test.ts`, regra `lembretes.replanejar-apos-turno-que-falhou` (nova):
   **"depois de um turno que morreu por erro, a mensagem da pessoa pede para replanejar dizendo o erro,
   uma vez"**. Roteiro: `iniciar`; `falha($)`; o contexto do `pedido` contém "replaneje o painel" e
   "terminou com erro", e não contém "o usuário interrompeu" nem "deixe abertas só as que continuam";
   `fimDoTurno`; o `pedido` seguinte volta à lista comum. Num segundo bloco: `iniciar`-equivalente,
   `falha`, `aviso`: o contexto contém "seguem ✕ "falhou"" e não contém "o usuário parou (Esc)".
   Falha hoje: sem pedido de replanejar.
4. `tests/sessoes.test.ts`, regra `sessoes.palavra-de-estado-do-cartao`:
   **"a filha cujo turno morreu por erro: o cartão diz "falhou", a tarefa fica ✕ "falhou" e a rodada sai
   da contagem"**. Roteiro: `fixar`; `host` com K1 publicando `Feita` (feita) e `Começada` (iniciada, com
   `stopped: true`, `failed: true` e `endedAt`), `turns: [turno(1, AGORA + 10)]`; `pedido`; `plan(A3)`;
   `start(['1'])`; `abrirSessao`; `aviso`; `h.filha(K1).rodando = false`; `h.filha(K1).aborted = true`;
   `aviso`. Afirma: `esperarPalavra(p, 'filha-um', 'falhou')`; a linha do cartão não contém "parada";
   "Começada" interrompida com "falhou"; `cabecalho(p)`: `[feitas, total]` igual a `[0, 3]`.
   Falha hoje: o cartão diz "parada".
5. `tests/durabilidade.test.ts`, regra `durabilidade.fim-do-turno-sobrevive-ao-reinicio`, em dois testes
   com um armazém do arquivo, como os pares que já existem:
   **"turno que falhou no reinício, 1/2: o turno morre por erro com uma tarefa iniciada"** e
   **"turno que falhou no reinício, 2/2: a iniciada segue ✕ "falhou" e o pedido seguinte pede para
   replanejar dizendo o erro"**. Afirma, no 2/2: depois de `iniciarSessao`, "Dois.um" interrompida com
   "falhou", nada em andamento; o contexto do `pedido` contém "terminou com erro".
   Falha hoje: aguardando, e o lembrete comum.

Testes existentes: nenhum muda. O teste da tabela de durabilidade (toda chave de state tem linha) pede a
linha nova.

## 6. Catálogo e selos

`regras/turnos.md`:

```markdown
### turnos.turno-que-falha-deixa-falhou
O turno que morre por erro deixa a tarefa em andamento ✕ "falhou", até o start nela.

- Dado uma tarefa iniciada e aberta
- Quando o turno da sessão termina por erro de API, limite de contexto ou recusa (não por Esc)
- Então ela fica ✕ com a palavra "falhou", fora da contagem, como a parada com Esc: segue assim nos turnos seguintes até o start nela (que tira a palavra) ou o done (que a conclui); as pendentes seguem ○; a mensagem seguinte pede o replano (lembretes.replanejar-apos-turno-que-falhou); o cartão desta sessão na mãe diz "falhou" (sessoes.palavra-de-estado-do-cartao)

Origem: decisão do usuário, 2026-11-14 ("✕ \"falhou\" (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (o turno que morria por erro era tratado como fim normal, ◷). Aplica ao erro a decisão de 2026-11-12 do Esc ("Segue ✕ até novo start (Recomendado)").
Código: state/tasks.ts, state/durability.ts, text/rules.ts
Estado: coberto
```

`regras/lembretes.md`:

```markdown
### lembretes.replanejar-apos-turno-que-falhou
Depois de um turno que morreu por erro, a mensagem seguinte pede para replanejar e diz o erro.

- Dado um turno que terminou por erro de API, limite de contexto ou recusa, com tarefas abertas
- Quando chega a mensagem seguinte da pessoa, ou um prompt que não abre pedido
- Então a mensagem da pessoa traz o pedido de replanejar dizendo que o turno terminou com erro, com a lista das abertas, uma vez; o prompt que não abre pedido lista as tarefas que ficaram ✕ "falhou" e diz que só voltam com start nelas; a mensagem de outra sessão segue com o pedido de replanejar dela

Origem: decisão do usuário, 2026-11-14 ("✕ \"falhou\" (Recomendado)": "a mensagem seguinte recebe o pedido de replanejar").
Código: hooks/panel.ts, state/durability.ts
Estado: coberto
```

`regras/sessoes.md`, `sessoes.palavra-de-estado-do-cartao`: no "Quando" acrescentar "para porque o turno
dela morreu por erro"; no "Então", a lista de palavras ganha "falhou". Antes do `Estado:`:
`Reescrito: 2026-11-14, decisão do usuário ("✕ \"falhou\" (Recomendado)": "o cartão desta sessão na mãe indica a falha"): a palavra "falhou". Os testes existentes não mudam.`

Selos (o do kit primeiro; depois um `--tipo novo` por teste novo, com o motivo `decisão do usuário,
2026-11-14: "✕ \"falhou\" (Recomendado)"`):

```bash
node scripts/selos.mjs --kit task-tree/tests/kit/cenario.ts --tipo refatoracao --motivo "roteiro novo: falha (turno que termina por erro); os outros roteiros não mudam"
npm run regras:selar -- "task-tree/tests/turnos.test.ts::o turno que morre por erro deixa a tarefa em andamento ✕ \"falhou\", fora da contagem, até o start nela" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"✕ \\\"falhou\\\" (Recomendado)\""
```

(e o mesmo para os outros cinco: "o done na tarefa que falhou, sem start, a conclui"; "depois de um turno
que morreu por erro, a mensagem da pessoa pede para replanejar dizendo o erro, uma vez"; "a filha cujo
turno morreu por erro: o cartão diz "falhou", a tarefa fica ✕ "falhou" e a rodada sai da contagem"; os
dois de `durabilidade.test.ts`.)

## 7. Documentação

`DESENVOLVIMENTO.md`: tabela de "Estado e durabilidade" (~255-271) com a linha `turnFailed` (se a triagem
C já tiver reescrito a tabela, na forma nova); linha do `turn.complete` em "Os 14 hooks"; entrada em
"Decisões (histórico)". Comentários de `failed` e `stopped` em `types/index.d.ts:32-43`.

## 8. Golden

Não muda (nenhum cenário do golden tem turno com erro; a palavra "falhou" já é desenhada do mesmo jeito).

## 9. Checklist do app

- Um erro real (limite de contexto, ou API fora do ar) com uma tarefa em andamento: ✕ "falhou" no painel
  e "falhou" no cartão desta sessão na mãe. O harness não produz o erro real; se não der para provocar,
  fica anotado como não verificado.

## 10. Dependências e conflitos

- Depois dos lotes 06 e 07 (mesmo bloco de `turnComplete`; `park`).
- Lote 18 (Esc com filha ou subagente vivo) mexe na leitura de `stopped` no desenho: a tarefa que falhou
  com filha viva embaixo segue a mesma regra de lá.
- Triagem C: decisão 33 (processo novo com o turno gravado como "em curso": "✕ interrompida") mexe em
  `ensureTurn`/`restoreTurn` e marca tarefas como paradas; a correção da tabela de durabilidade e a
  decisão 45 reescrevem a tabela do documento. O registro `turn` do store ganha campos dos dois lados:
  juntar.
- Triagem B: decisão 21 (fim do subagente em segundo plano depois de um Esc: "Fecha como no fim normal")
  mexe nas guardas de `settleBySubs` em `turnComplete`.

## 11. Bloqueio

Nenhum.
