# Lote 14 (triagem C): painel fechado reabre só na mensagem da pessoa

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- A pergunta ligada ao achado "A premissa 'a recarga não roda session.start' contradiz o contrato do
  kit" (o achado em si é "não confirmado" e fica fora).
- Decisão 36: "Só na sua mensagem (Recomendado)". A opção: "Só na sua próxima mensagem e em processo
  novo. Fechar vale até você escrever de novo; plan e recarga do mod não reabrem."

## 2. Causa confirmada na ponta

- Escrito, `hooks/tools.ts:119`: todo `plan` (do loop principal ou de subagente) chama `$.ui.open` do
  painel, colocado ou não.
- Escrito, `hooks/session-start.ts:64`: todo `session.start` chama `$.ui.open`. Se a recarga do mod
  rodar o `session.start` (o contrato do kit 2.1.321 diz que roda; o repositório mediu que não, em
  outubro; não confirmado), cada arquivo do mod salvo reabre o painel em todas as sessões.
- Escrito, `hooks/panel.ts:562-569` (`showPane`) e `hooks/prompt-submit.ts:77`: o prompt da própria
  pessoa já reabre o painel quando ele não está na tela. `hooks/command.ts`: o `/task-tree` também.
- Nenhum cenário do catálogo diz que o plan abre o painel (busca em `regras/` por "abre o painel" e
  "reabr": só usos de outro sentido). Não há regra registrada a reescrever.

## 3. O que muda

- `hooks/tools.ts` (`planTool`): sai a abertura do painel. O plan só grava e responde.
- `hooks/session-start.ts` (`sessionStart`): o painel abre com a sessão só em processo novo. Como
  saber: uma marca no state, gravada na primeira vez que o `session.start` abre o painel; o state
  morre com o processo e sobrevive à recarga, então a marca presente quer dizer "este processo já
  abriu". Chave nova do state (`types/index.d.ts`, `PluginState`; linha na `TABLE` de
  `state/durability.ts`, só state, sem store).
- `showPane` (a mensagem da pessoa) e o `/task-tree` não mudam.

Em termos do painel: se a pessoa fecha o painel de tarefas, ele fica fechado enquanto o modelo
trabalha, planeja e replaneja, e enquanto o mod recarrega; volta na próxima mensagem que ela mesma
escrever na sessão, num processo novo (reabrir o app, `/model`) ou com `/task-tree`. Mensagens de
outras sessões, avisos do app e retornos de subagente não o reabrem (já era assim no prompt).

## 4. Impacto

`npm run impacto -- hooks/tools.ts hooks/session-start.ts hooks/panel.ts`: 81 cenários (envios 17,
turnos 14, pedidos 14, durabilidade 9, árvore 9, perguntas 8, cabeçalho 4, fumaça 1). Com
`types/index.d.ts` (núcleo), todos os cobertos. Golden: nenhum.

## 5. Testes de verificação (`tests/durabilidade.test.ts`)

Cada teste registra, antes da primeira chamada a `$`, um `ui.open` que conta as aberturas e um
`ui.panes` que diz se o painel está colocado (uma variável do teste):
- "o plan não reabre o painel que a pessoa fechou; a mensagem seguinte dela reabre". Regra:
  `durabilidade.painel-fechado-reabre-so-na-mensagem`. Pedido (abre: 1), o painel passa a colocado;
  plan e start; "fecha" (não colocado); um replano e um plan de subagente: a conta segue 1; outro
  pedido: 2. Falha hoje: cada plan soma uma abertura.
- "a recarga do mod não reabre o painel", 1/2 e 2/2 com `estado` (`captura`, `semear`). Mesma regra.
  O 1/2: `iniciarSessao` (abre: 1). O 2/2 (módulo novo, state mantido): `iniciarSessao` de novo, conta
  0. Falha hoje: abre de novo.
- "o processo novo abre o painel". Mesma regra: `iniciarSessao` com o state vazio, conta 1 (passa
  hoje; protege o "em processo novo").
- "a mensagem de outra sessão e o aviso do app não reabrem". Mesma regra: com o painel não colocado,
  `mensagemDe` e `aviso`: conta 0 (passa hoje).
- Testes existentes: nenhum muda (nenhum afirma a abertura pelo plan; o `fumaca.test.ts` só confere
  "Plano exibido").

## 6. Catálogo (`regras/durabilidade.md`) e selos

Novo, `coberto`:

```markdown
### durabilidade.painel-fechado-reabre-so-na-mensagem
O painel que a pessoa fechou só reabre na próxima mensagem dela, em processo novo ou com /task-tree.

- Dado o painel de tarefas fechado pela pessoa
- Quando o modelo planeja ou replaneja, um subagente planeja, chega mensagem de outra sessão ou aviso do app, ou o mod recarrega
- Então o painel segue fechado; ele volta quando a pessoa escreve a próxima mensagem na sessão, quando um processo novo abre a sessão, ou com /task-tree

Origem: decisão do usuário, 2026-11-14 ("Só na sua mensagem (Recomendado)"), à pergunta "Quando você fecha o painel de tarefas, ele deve reabrir sozinho?".
Código: hooks/tools.ts, hooks/prompt-submit.ts, hooks/command.ts
Estado: coberto
```

Selos: `npm run regras:selar -- "task-tree/tests/durabilidade.test.ts::<nome>" --tipo novo --motivo "decisão 2026-11-14: painel fechado reabre só na mensagem da pessoa"`, um por teste novo.

## 7. Documentação

- `text/rules.ts`: nenhum texto ao modelo diz que o plan abre o painel (conferido); nada a mudar.
- Comentário de `showPane` em `hooks/panel.ts:556-561` ("The panel opened with the session
  (session.start, plan)…"): tirar o plan.
- `DESENVOLVIMENTO.md` (linha 688 e a lista de hooks): no lote 30.
- `CLAUDE.md`, checklist do app: uma linha, abaixo.

## 8. Golden

Não muda.

## 9. Checklist do app

- Fechar o painel com o modelo trabalhando: ele não volta nos plans seguintes; volta ao mandar a
  próxima mensagem.
- Com o painel fechado, salvar um arquivo do mod (recarga a quente): o painel segue fechado, nesta e
  nas outras sessões abertas.
- Trocar o modelo (`/model`, processo novo): o painel abre.
- Acrescentar ao checklist do `CLAUDE.md`, no item "recarga a quente real": "o painel fechado pela
  pessoa segue fechado na recarga e nos plans".

## 10. Dependências e conflitos

- Independente dos outros lotes da triagem C; depois do lote 09 (a conferência de chaves do state
  exige a linha nova na tabela).
- Triagem A, lotes 02, 03, 04, 05, 14 e 15 e triagem B: mexem em `planTool` (`hooks/tools.ts`), em
  outros trechos; a linha tirada aqui é a 119.
- Triagem A, lote 05 e lote 25: tocam `hooks/session-start.ts` (registro de ferramenta, dobras no
  `/clear`), outros trechos.

## 11. Bloqueio

Nenhum.
