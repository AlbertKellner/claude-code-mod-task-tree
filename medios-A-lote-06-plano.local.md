# Lote 06: fim do turno (resumo depois do Esc, aviso de permissão, espera do wrap_up)

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (três correções diretas do fim do turno e das esperas, nos mesmos arquivos).

## 1. O que cobre

- Achado "Turno parado com Esc não limpa `brief` nem `recap`: o resumo antigo vira o ↩ do pedido seguinte
  e cala os avisos de "falta o summary"". Correção direta.
- Achado "Aviso de permissão é identificado só por agente e ferramenta: chamadas paralelas o tiram cedo,
  e não há rede de segurança se o fim da chamada não rodar". Correção direta.
- Achado "Todo wrap_up com ask vira espera "Aguardando sua escolha", mesmo quando falha, quando o app não
  mostra a pergunta ou quando ela não bloqueia": só a **parte direta** (a espera criada antes de a
  chamada dar certo).
- Decisão 14, 2026-11-14, sobre o mesmo achado: **"Toda pergunta espera"** (como hoje). Nada muda na
  regra: a pergunta opcional de uma filha segue contando como espera. Entra só a confirmação no texto
  do cenário.

## 2. Causa confirmada na ponta atual

Escrito no código:
- `hooks/turn.ts:121-127`: `recap` e `brief` só são lidos e zerados dentro de `if (!agent &&
  !e.isAborted)`. Nenhum outro ponto os zera (`grep` de `briefState` e `recapState`: `hooks/tools.ts:138`
  e `hooks/tool-call.ts:82` só gravam).
- `hooks/permission.ts:14-19`: a espera de permissão tem a chave `<agente>:<ferramenta>`.
  `hooks/tool-call.ts:233-237`: o `finally` de toda chamada tira a espera com essa chave, seja qual for
  a chamada que pediu a permissão. `hooks/panel.ts:582-586` (`dropAsked`, chamado no fim do turno) só
  tira pergunta e plano; `hooks/prompt-submit.ts:106` preserva a de permissão no prompt.
- `hooks/tool-call.ts:79-88` (`wrapUpAsk`) roda antes de `next(e)` (`tool-call.ts:231`): tira a escolha
  anterior e cria a nova sem conhecer o resultado.

Dedução:
- `done` com resumo "A", Esc antes do fim; no pedido seguinte, fechado sem resumo, o `done` não avisa
  "falta o summary" (`lastBrief` ainda é "A") e o fim do turno grava "A" como ↩ do pedido novo e no
  arquivo publicado;
- dois Bash no mesmo passo, um liberado por regra e outro pedindo permissão: o fim do primeiro tira
  "Aguardando permissão: Bash" com o diálogo aberto; um aviso órfão dura até a próxima chamada da
  mesma ferramenta;
- um `wrap_up` com `ask` que dá erro deixa "Aguardando sua escolha" sem pergunta na tela.

## 3. O que muda

`hooks/turn.ts`, `hooks/tool-call.ts`, `hooks/panel.ts`. `hooks/permission.ts` não muda (a chave fica).

1. Resumo e recap (`turnComplete`): no fim de todo turno do loop principal, parado ou não, `brief` e
   `recap` voltam a '' depois de lidos. No turno parado nada é gravado no pedido (como hoje: o Esc não
   registra ↩); só deixam de sobrar. Não zerar no prompt: a mensagem entregue no meio do turno apagaria
   o resumo que o `done` acabou de gravar.
2. Aviso de permissão:
   - `tool-call.ts`: um contador das chamadas em curso por `<agente>:<ferramenta>` (variável do módulo):
     sobe antes de `next(e)` e desce no `finally`; a espera de permissão com essa chave só sai quando o
     contador chega a zero. Contador ausente (recarga do mod no meio da chamada) vale zero, e nunca fica
     negativo: nesse caso o fim da chamada tira o aviso, como hoje.
   - Rede de segurança: no fim do turno do loop principal (`turnComplete`, sem `agentId`), saem as
     esperas de permissão do loop principal e o contador dele zera. O subagente já perde todas as
     esperas dele no fim (`turn.ts:175`). Não tirar no prompt (o diálogo pode estar aberto com o turno
     em curso).
3. Espera do `wrap_up`: o `recap` segue gravado antes da chamada; o resto de `wrapUpAsk` passa para
   depois de `next(e)`, só para a chamada que deu certo (sem `isError` e sem `deny`): tira a escolha
   anterior e, com `ask`, cria a nova. Se a chamada falhou, nada muda nas esperas.
   - Fica de fora (depende do app, não confirmado): "o resultado diz que a pergunta não foi mostrada".
     O repositório não tem registro do texto que o app devolve nesse caso; sem ele não há o que casar.
   - `blocked` não é lido: decisão 14, "Toda pergunta espera".

Comportamento novo no painel:
- depois de um Esc, o pedido seguinte não herda o ↩ do turno parado, e o `done` final sem resumo volta
  a avisar;
- "Aguardando permissão: <ferramenta>" fica enquanto houver chamada daquela ferramenta em curso para o
  mesmo agente, e some no fim do turno se sobrar;
- o `wrap_up` com `ask` que falha não mostra "Aguardando sua escolha", e na mãe a filha não fica
  "aguardando" por ele.

## 4. Impacto

`npm run impacto -- hooks/turn.ts hooks/tool-call.ts hooks/panel.ts`: `hooks/panel.ts` 69 cenários
(envios 17, turnos 14, pedidos 14, durabilidade 9, perguntas 8…), `hooks/turn.ts` 40 (turnos 14, lembretes
11, ultracode 5, taxa 4…), `hooks/tool-call.ts` 28 (envios 17, perguntas 8…). Checklist do app (por
mapa): `envios.destino-arquivado-no-app`, `envios.subagente-no-app`, `ultracode.cor-e-corte`; nenhum
muda. Golden: nenhum cenário.

## 5. Testes a escrever

1. `tests/turnos.test.ts`, regra `turnos.resumo-de-turno-parado-nao-passa-adiante` (nova):
   **"o resumo de um turno parado com Esc não vira o ↩ do pedido seguinte, e o done final sem resumo
   volta a avisar"**. Roteiro: `const { relogio } = fixar(on)`; `const h = host(on, [])`; `pedido`;
   `plan` de "A" com uma folha "1"; `start(['1'])`; `done(['1'], 'Resumo A')`; `esc`;
   `relogio.advance(1000)`; `pedido($, 'Pedido dois')`; `plan` de "B" com "b1"; `start(['b1'])`;
   `const r = await done($, ['b1'])`; `fimDoTurno`.
   Afirma: `r.texto` contém "falta o summary"; nenhuma linha do painel contém "Resumo A"; nenhum turno
   publicado (`h.proprio()`) tem `brief` "Resumo A".
   Falha hoje: sem o aviso, e a linha ↩ do pedido dois mostra "Resumo A".
2. `tests/perguntas.test.ts`, regra `perguntas.permissao-sai-com-a-ultima-chamada` (nova):
   **"com duas chamadas da mesma ferramenta em curso, o aviso de permissão fica até a última terminar"**.
   Roteiro: `const { relogio } = fixar(on)`; `on('classic.PermissionRequest', () => ({}))`; um stub do
   Bash no teste que espera `relogio.sleep(500)` quando `command` é "rápido" e `relogio.sleep(2000)`
   senão; `pedido`; `plan(A)`; `start(['1'])`; duas `ferramenta($, 'Bash', …)` sem `await`;
   `relogio.settle()`; `$.classic.PermissionRequest({ tool_name: 'Bash' })`; `relogio.advance(500)` e
   `await` da rápida: o painel ainda mostra "Aguardando permissão: Bash"; `relogio.advance(1500)` e
   `await` da lenta: o aviso sumiu.
   Falha hoje: o fim da chamada rápida tira o aviso.
3. `tests/perguntas.test.ts`, mesma regra:
   **"o fim do turno tira o aviso de permissão que sobrou"**. Roteiro: `fixar`; o stub de
   `classic.PermissionRequest`; `pedido`; `plan(A)`; `start(['1'])`; `PermissionRequest` de Bash sem
   chamada nenhuma; o aviso aparece; `fimDoTurno`; o aviso sumiu.
   Falha hoje: o aviso fica até a próxima chamada de Bash.
4. `tests/perguntas.test.ts`, regra `perguntas.wrapup-que-falha-nao-espera` (nova):
   **"o wrap_up com pergunta que falha não deixa "Aguardando sua escolha""**. Roteiro: `fixar`; stub
   `on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, () => ({ result: 'erro', isError: true }))`;
   `pedido`; `plan(A)`; `start(['1'])`; `ferramenta` do wrap_up com `recap` e `ask`. Afirma: nenhuma
   linha "Aguardando sua escolha". Depois, no mesmo teste, com um segundo stub não dá (um por teste):
   basta este caso.
   Falha hoje: a espera aparece.

Testes existentes: nenhum muda. `perguntas.escolha-do-wrapup-ate-proxima-mensagem`
(`perguntas.test.ts:122`) usa uma chamada que dá certo e lê o painel depois dela; `perguntas.permissao-
espera` (`:140`) pede a permissão sem chamada e sem fim de turno. Se o harness não aceitar duas
chamadas de ferramenta em curso no mesmo teste, o teste 2 vira `checklist` no catálogo e o relato diz.

## 6. Catálogo e selos

`regras/turnos.md`:

```markdown
### turnos.resumo-de-turno-parado-nao-passa-adiante
O resumo de um turno parado com Esc não passa ao pedido seguinte.

- Dado um done com summary (ou um wrap_up com recap) num turno que a pessoa para com Esc antes do fim
- Quando o pedido seguinte termina, com ou sem resumo próprio
- Então a linha ↩ do pedido seguinte mostra só o resumo dele (nenhuma, sem resumo), o done final sem summary avisa a falta, e o resumo antigo não vai ao arquivo publicado

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o resumo e o recap só eram zerados no fim normal); aplica turnos.resumo-sem-resposta-final ("o summary é a linha ↩" do turno dele), sem mudar nenhuma regra.
Código: hooks/tools.ts, hooks/tool-call.ts
Estado: coberto
```

`regras/perguntas.md`:

```markdown
### perguntas.permissao-sai-com-a-ultima-chamada
O aviso de permissão fica enquanto houver chamada daquela ferramenta em curso, e não sobrevive ao turno.

- Dado "Aguardando permissão: <ferramenta>" no painel
- Quando termina uma chamada dessa ferramenta com outra do mesmo agente ainda em curso; quando termina a última; quando o turno do loop principal termina com o aviso ainda lá
- Então o aviso fica no primeiro caso e some nos outros dois; a mensagem seguinte não o tira (o diálogo pode estar aberto com o turno em curso)

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o fim de qualquer chamada da mesma ferramenta tirava o aviso, e um aviso órfão durava até a chamada seguinte); completa perguntas.permissao-espera, que só cobre o aviso aparecer.
Código: hooks/turn.ts, hooks/permission.ts
Estado: coberto
```

```markdown
### perguntas.wrapup-que-falha-nao-espera
O wrap_up com pergunta que falha não vira espera.

- Dado um wrap_up com pergunta (ask)
- Quando a chamada falha
- Então o painel não mostra "Aguardando sua escolha", e a espera que já havia fica como estava

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: a espera era criada antes de a chamada dar certo); aplica perguntas.escolha-do-wrapup-ate-proxima-mensagem, sem mudá-la.
Estado: coberto
```

`perguntas.escolha-do-wrapup-ate-proxima-mensagem`: acrescentar ao fim da linha `Origem:` "; confirmada
pelo usuário em 2026-11-14 ("Toda pergunta espera"): a pergunta opcional, que não bloqueia o trabalho,
também fica como espera." Sem `Reescrito:` (a regra não mudou) e sem mexer no teste.

Selos:

```bash
npm run regras:selar -- "task-tree/tests/turnos.test.ts::o resumo de um turno parado com Esc não vira o ↩ do pedido seguinte, e o done final sem resumo volta a avisar" --tipo novo --motivo "correção direta: resumo e recap zerados em todo fim de turno"
npm run regras:selar -- "task-tree/tests/perguntas.test.ts::com duas chamadas da mesma ferramenta em curso, o aviso de permissão fica até a última terminar" --tipo novo --motivo "correção direta: aviso de permissão por chamadas em curso"
npm run regras:selar -- "task-tree/tests/perguntas.test.ts::o fim do turno tira o aviso de permissão que sobrou" --tipo novo --motivo "correção direta: rede de segurança do aviso de permissão"
npm run regras:selar -- "task-tree/tests/perguntas.test.ts::o wrap_up com pergunta que falha não deixa \"Aguardando sua escolha\"" --tipo novo --motivo "correção direta: espera do wrap_up só depois de a chamada dar certo"
```

## 7. Documentação

`DESENVOLVIMENTO.md`: linha do `turn.complete` em "Os 14 hooks" (~116: "zera `recap` e `brief`" passa a
valer para o turno parado, e sai a espera de permissão); o passo do `wrapUpAsk` em "Fluxo de dados"
(~156-157: a espera é criada depois da chamada); a variável nova do contador entra na lista de
variáveis de módulo (~277) e, se a triagem C mantiver a regra de uma linha por variável, na `TABLE`
de `state/durability.ts`.

## 8. Golden

Não muda.

## 9. Checklist do app

- Duas chamadas de Bash no mesmo passo, uma liberada por regra e a outra pedindo permissão: o aviso
  fica até a resposta ao diálogo (o harness não tem o diálogo real).
- Um `wrap_up` real com `ask`: a espera segue aparecendo quando a chamada dá certo.

## 10. Dependências e conflitos

- Independente dos lotes 01 a 05.
- Lote 08 (↩ de pedido sem tarefa) e lote 09 (turno que morre por erro) mexem no mesmo bloco de
  `turnComplete`: fazer este antes.
- Triagem C: decisão 38 ("Tirar, basta o ↩": sai o `reply`) mexe em `turn.ts:121-141`; decisões 39 e 40
  (pergunta com tarefa aberta e nenhuma em andamento; passo ○ de pedido anterior) mexem em `asked`, em
  `tool-call.ts`; a correção da tabela de durabilidade lista as variáveis de módulo. Adaptar ao que já
  estiver na ponta.
- Triagem B: a correção das gravações do cartão do subagente mexe em `subTool` (`hooks/agents.ts`),
  chamado de `toolCall`; sem conflito de função.

## 11. Bloqueio

Nenhum.
