# Lote 08 (triagem C): store, falha registrada, sobras apagadas, poda e nova tentativa

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "Store do plugin tem teto de 4 MiB: ao estourar, o painel para de ser salvo em silêncio e a
  poda nunca mais roda". Correção direta. A política de quanto guardar é dos lotes 10 (subagentes
  terminados), 11 (arquivos publicados) e 12 (painel enquanto a sessão existir).
- Do mesmo registro: a leitura do store que falha passa a ir ao log (é o que a triagem deixou para os
  dois achados "não confirmados" do store; a defesa deles fica fora).

## 2. Causa confirmada na ponta

- Escrito, `state/durability.ts:173-180` (`saveGroups`): a única poda apaga `session:<id>` além das 30
  (`KEEP`), e só depois de a gravação do painel dar certo.
- Escrito, `hooks/panel.ts`: quatro gravações engolem a falha sem registro: `persist` (357-359),
  `saveTurn` (56-64), `setWork` (622-624) e `saveLinks` (692-706).
- Escrito, tipos do kit 2.1.321 (`$.store.set`): rejeita com o store acima de 4 MiB de JSON; há
  `$.store.keys()` e `$.store.delete`.
- Escrito: nenhum código grava mais os prefixos `asks:` e `view:` (busca na ponta: nenhuma ocorrência
  fora do `DESENVOLVIMENTO.md`); os registros `work:`, `turn:` e `links:` de sessões que saíram da
  lista das 30 nunca são apagados.
- Medido pela triagem (não refeito): store em 962 KB, 23% do teto; 145 `work`, 98 `turn`, 143 `links`
  para 30 painéis.
- Dedução: passado o teto, o painel segue certo na tela e nada mais é salvo; no reinício, no `/model`
  ou na retomada volta a última versão salva, sem aviso e sem recuperação.

## 3. O que muda

`state/durability.ts`:
- Uma função de poda do store, que roda no máximo uma vez por módulo por conta própria e sempre que
  uma gravação falha: lê as chaves (`$.store.keys()`); apaga as de prefixos que não existem mais
  (`asks:`, `view:`); apaga `work:<id>`, `turn:<id>` e `links:<id>` cujo id não está na lista
  `sessions` e não é o desta sessão; apaga `session:<id>` fora da lista. Falha da própria poda vai ao
  log e não quebra nada.
- Um invólucro para as gravações do store: tenta; se falhar, registra, roda a poda e tenta mais uma
  vez; se falhar de novo, registra e desiste (como hoje, sem quebrar o hook). Guarda numa variável do
  módulo a última falha (o quê, o erro, quando) e a zera quando a mesma gravação volta a dar certo.
- `saveGroups`: quando o id desta sessão não estava na lista `sessions` (sessão nova, ou que tinha
  saído das 30 e teve os registros podados por outra), avisa quem chamou, para as cópias "já gravado"
  do módulo (`lastLinks`, `lastTurn`) serem esquecidas e o trabalho, o fim do turno e as ligações
  serem gravados de novo junto com o painel.

`hooks/panel.ts`: `persist`, `saveTurn`, `setWork` e `saveLinks` gravam pelo invólucro. As leituras
(`ensureGroups`, `ensureWork`, `ensureTurn`, `restoreTurn`, `restoreWork`, `restoreWorkOf`, a leitura
das ligações) registram no log a leitura que falha, uma vez por chave e motivo, sem mudar o que fazem.

`io/log.ts`: uma forma de registrar "uma vez por motivo" (um conjunto no módulo), usada pelas duas.
Texto das linhas: `task-tree: store não gravado (<painel|trabalho|fim do turno|ligações>): <erro>` e
`task-tree: store não lido (<o quê>): <erro>`.

`hooks/command.ts` (`/task-tree`): a resposta ganha, só quando há falha guardada, "Store: a última
gravação de <o quê> falhou (<erro>); o painel na tela está certo, mas não está sendo salvo."

Em termos do painel: nada muda na tela. Com o store cheio, a primeira gravação que falha limpa as
sobras e tenta de novo; se ainda assim não couber, o log de depuração e o `/task-tree` dizem. Hoje a
poda devolve cerca de 110 KB (conta da triagem).

## 4. Impacto

`npm run impacto -- state/durability.ts hooks/panel.ts hooks/command.ts io/log.ts`: 70 cenários
(envios 17, turnos 14, pedidos 14, durabilidade 9, perguntas 8, fumaça 1 e outros). Checklist:
`envios.destino-arquivado-no-app`, `envios.subagente-no-app` (não tocados). Golden: nenhum.

## 5. Testes de verificação (`tests/durabilidade.test.ts`)

O kit precisa de dois apoios pequenos em `tests/kit/ambiente.ts` (selados como refatoração do kit,
sem mudar o que os testes existentes veem): `armazem` com uma opção para recusar gravações (um
predicado sobre o conteúdo do objeto; a recusa do kit é `{ deny }`, como o `fs.read` do `host`), e
`fixar` devolvendo também as linhas do `ui.log`.

- "store cheio: a gravação que falha apaga as sobras e tenta de novo". Regra:
  `durabilidade.store-cheio-nao-perde-em-silencio`. O objeto do store começa com sobras (`asks:x`,
  `view:x`, `work:velha`, `turn:velha`, `links:velha`, e `sessions` sem `velha`) e recusa gravações
  enquanto alguma sobra existir. Pedido, plan, start. Afirma: as sobras saíram; `session:<id>`,
  `work:<id>` e `links:<id>` desta sessão estão gravados; uma linha "store não gravado" no log (uma
  só, mesmo com várias gravações recusadas pelo mesmo motivo). Falha hoje: nada é gravado e o log
  fica vazio.
- "store que não aceita nada: o painel segue na tela e o log diz". Mesma regra: recusa sempre; o
  painel desenha as tarefas; o log tem a linha; nenhum erro sobe para a ferramenta (o `plan` responde
  "Plano exibido").
- "a sessão que volta à lista regrava trabalho, fim do turno e ligações". Mesma regra: par 1/2 e 2/2
  no mesmo store; entre os dois o teste apaga do objeto os registros desta sessão e a tira de
  `sessions` (o que a poda de outra sessão faria); no 2/2, com o state semeado, um start regrava
  `session:`, `work:`, `turn:` e `links:`. Falha hoje: `links:` e `turn:` não voltam enquanto não
  mudarem.
- O texto do `/task-tree`: se o harness alcançar o comando (o `fumaca.test.ts` mostra o que há),
  um teste; senão fica no checklist.
- Testes existentes: nenhum muda.

## 6. Catálogo (`regras/durabilidade.md`) e selos

Novo, `coberto`:

```markdown
### durabilidade.store-cheio-nao-perde-em-silencio
O store cheio não deixa de salvar o painel em silêncio.

- Dado o store do mod no teto, com registros de sessões que já saíram da lista e chaves de versões antigas
- Quando uma gravação do painel, do trabalho, do fim do turno ou das ligações falha
- Então o mod apaga essas sobras e grava de novo; se ainda falhar, o painel segue certo na tela, o log de depuração diz qual gravação falhou (uma vez por motivo) e o /task-tree diz que o painel não está sendo salvo; a sessão cujos registros foram apagados por outra os grava de novo na escrita seguinte

Origem: auditoria 2026-11-10 (passado o teto de 4 MiB, nada mais era salvo e nada avisava); sem mudar nenhuma regra.
Código: hooks/command.ts, io/log.ts
Estado: coberto
```

Selos:
- `node scripts/selos.mjs --kit task-tree/tests/kit/ambiente.ts --tipo refatoracao --motivo "armazem que recusa gravações e fixar que devolve o log"`
- `npm run regras:selar -- "task-tree/tests/durabilidade.test.ts::<nome>" --tipo novo --motivo "auditoria: store cheio"`, um por teste novo.

## 7. Documentação

`state/durability.ts`: o texto do topo e a nota da linha `sessions`. `DESENVOLVIMENTO.md`: no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

- `/task-tree` num uso normal: a resposta não ganha a linha do store.
- Depois do primeiro uso com este lote, olhar o arquivo do store (`~/.claude/plugins/store/
  task-tree_inline-….json`): sem chaves `asks:` e `view:`, e sem `work:`, `turn:`, `links:` de sessões
  fora da lista. Só leitura do arquivo; nada a simular.

## 10. Dependências e conflitos

- Depois do lote 06 (a gravação das ligações muda lá); antes dos lotes 10 e 12, que mudam o que se
  guarda e por quanto tempo.
- Lote 12 daqui (painel enquanto a sessão existir): a poda de `work:`, `turn:` e `links:` das sessões
  fora da lista só é segura porque o lote 12 traz essas três coisas do arquivo publicado quando o
  store não tem o painel. Até o lote 12 entrar, o efeito é o de hoje (a sessão fora das 30 já volta
  sem painel).
- Triagem B, lote 10 (recibo guardado no envio) e lote 25 (nome do destino): acrescentam campos ao
  registro `links` em `state/durability.ts`; sem conflito de função.
- Triagem A, lote 23: toca `state/durability.ts`.

## 11. Bloqueio

Nenhum.
