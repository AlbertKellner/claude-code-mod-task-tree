# Lote 06 (triagem C): ligações na recarga, o state é a verdade

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "A primeira gravação das ligações depois de uma recarga funde o store por cima do state que
  sobreviveu: cartas duplicadas ou ressuscitadas e cartões fantasmas". Correção direta.

## 2. Causa confirmada na ponta

- Escrito, `hooks/panel.ts:690-691`: a primeira `saveLinks` de um módulo novo chama `restoreLinks`.
- Escrito, `hooks/panel.ts:711-723` e `state/durability.ts:221-244`: `restoreLinks` funde o registro do
  store com o state: `union` para `sends`, `received` e `launches` (as entradas do store que o state
  não tem, comparadas pelo JSON inteiro, entram antes), `fill` para `children`.
- Escrito, `hooks/sessions.ts:199-205` (`takenNote`): o lembrete "recebimento confirmado" marca a carta
  (`noted`) só no state; nada publica em seguida. O mesmo vale para qualquer mudança de uma carta entre
  duas publicações (`taken`, `cut`, `lost`, a âncora renomeada por um plan).
- Escrito, `hooks/panel.ts:646-652`: o comentário diz que a recarga esvazia o state; ela o mantém
  (`state/durability.ts:3-5` diz o certo).
- Dedução: salvo um arquivo do mod entre a mudança no state e a publicação seguinte, a entrada antiga
  do store difere da nova pelo JSON e volta: duas linhas "Para X: …" sob a tarefa e o lembrete de
  recebimento de novo; a carta de uma tarefa cujo id um plan reusou volta sob a tarefa nova; a carta
  que o plan descartou volta. Nesta máquina o clone recarrega em todas as sessões a cada arquivo salvo.

## 3. O que muda

Regra nova: o registro das ligações do store só entra numa chave que o state não tem (valor
indefinido: processo novo). Com o state mantido (recarga), o state fica como está.

`hooks/panel.ts`:
- Uma função de "primeiro uso" das ligações, no molde de `ensureGroups`: uma vez por módulo, lê o
  registro `links` do store; refaz sempre a cópia do módulo (`keptLinks`); para cada uma das quatro
  chaves (`children`, `sends`, `received`, `launches`), grava a do store só quando o state não a tem.
  Só marca "já trazido" depois de a leitura responder.
- `restoreLinks` (a do `session.start`) passa a ser essa mesma função; `saveLinks` deixa de fundir:
  chama a função antes de gravar (sem efeito quando já rodou).
- A função é chamada antes de qualquer escrita das ligações: em `change` e `publishPanel` (junto de
  `ensureGroups` e `ensureWork`), e no começo de cada entrada que escreve ligações sem passar por eles:
  `toolCall` (`hooks/tool-call.ts`, antes do `launch`), `promptSubmit` (`hooks/prompt-submit.ts`, antes
  do `noteReceived`), `agentSpawn` e `agentReceive` (`hooks/agents.ts`), `refreshChildren`
  (`hooks/sessions.ts`).
- O comentário das linhas 646-652 é corrigido (a recarga mantém o state e zera as variáveis do módulo).

`state/durability.ts`:
- As quatro linhas das ligações na `TABLE`: `merge` passa a `current`; "quando volta" passa a
  `start` e `first-use` (sai `first-save`); o `keep` de 20 continua valendo no que cada escrita corta.
- As fusões `union` e `fill` ficam sem uso: saem do tipo `Merge` e da função `merge` (com o texto do
  cabeçalho que as descreve), se nada mais as usar na hora.

Em termos do painel: depois de uma recarga do mod, cada tarefa segue com as mesmas cartas e os mesmos
cartões de antes, sem linha repetida, sem carta de volta e sem lembrete de recebimento repetido. Num
processo novo, nada muda: as ligações voltam do store como hoje.

## 4. Impacto

`npm run impacto -- hooks/panel.ts state/durability.ts hooks/tool-call.ts hooks/prompt-submit.ts
hooks/sessions.ts hooks/agents.ts hooks/session-start.ts`: 125 cenários (todas as áreas de
comportamento: subagentes 23, sessões 22, envios 17, turnos 14, pedidos 14, lembretes 11,
durabilidade 9, perguntas 8). Checklist: os dois de envios e os quatro de subagentes "no app" (não
tocados). Golden: nenhum.

## 5. Testes de verificação (`tests/durabilidade.test.ts`)

Par com `armazem` (o store) e `estado` (o state, `captura` e depois `semear`), como os de recarga:
- "recarga com a carta já avisada, 1/2: a carta entregue e o lembrete dado" e "…, 2/2: o módulo novo
  não repete a carta nem o lembrete". Regra: `durabilidade.recarga-nao-funde-as-ligacoes`. O 1/2:
  `host` com uma sessão, `responderEnvio` em fila; pedido, plan, start, envio; `h.recebeu`; `aviso`
  (a carta vira entregue e o contexto traz "recebimento confirmado": a marca fica só no state). O 2/2
  (módulo novo, state semeado, mesmo store): `aviso`; afirma que o contexto não traz "recebimento
  confirmado" e que há uma só linha "Para …" sob a tarefa. Falha hoje: a entrada do store, sem a marca,
  entra de novo: duas linhas e o lembrete repetido.
- "recarga depois de um plan que reusou o id da tarefa da carta, 1/2" e "…, 2/2: a carta não aparece
  sob a tarefa nova". Mesma regra. O 1/2: carta entregue sob a tarefa `1` do pedido um; fim do turno;
  pedido dois e um plan que reusa o id `1` (o plan renomeia a tarefa antiga e a âncora da carta só no
  state, `hooks/tools.ts:107-109`, depois da publicação do próprio plan); o 1/2 termina logo depois
  desse plan, sem outra escrita (um start publicaria e esconderia o caso). O 2/2: um start na tarefa
  nova e o painel sem linha "Para …" sob ela. Falha hoje: a entrada do store, com a âncora antiga,
  entra de novo e a carta aparece sob a tarefa nova.
- "processo novo sem session.start: as ligações voltam antes da primeira escrita". Mesma regra. 1/2
  com `armazem` só (filha aberta sob a tarefa, carta na fila); 2/2 sem `iniciarSessao`: um `aviso` e o
  cartão segue sob a tarefa, com a carta. Protege o caminho do processo novo.
- Testes existentes: nenhum muda. Os pares "recarga a quente … a filha aberta sob uma tarefa" e "a
  lista do host deixa uma filha de fora" seguem valendo e protegem o `keptLinks`.

## 6. Catálogo (`regras/durabilidade.md`) e selos

Novo, `coberto`:

```markdown
### durabilidade.recarga-nao-funde-as-ligacoes
Depois de uma recarga do mod, as cartas e os cartões são os que o painel já tinha.

- Dado cartas e cartões ligados a tarefas, e uma mudança neles que ainda não foi ao store (o lembrete de recebimento dado, a carta que um plan descartou, a tarefa renomeada por um plan)
- Quando o mod recarrega a quente (módulo novo, state mantido) e o painel volta a ser gravado
- Então cada tarefa segue com as mesmas cartas e cartões: nenhuma linha repetida, nenhuma carta de volta, e o lembrete de recebimento não sai de novo; num processo novo (state vazio), as ligações voltam do store antes da primeira escrita delas

Origem: auditoria 2026-11-10 (a primeira gravação depois da recarga fundia o store por cima do state); aplica durabilidade.recarga-mantem-painel-ligacoes-e-resumo, sem mudar nenhuma regra.
Código: hooks/tool-call.ts, hooks/prompt-submit.ts, hooks/sessions.ts, hooks/agents.ts
Estado: coberto
```

Selos: `npm run regras:selar -- "task-tree/tests/durabilidade.test.ts::<nome>" --tipo novo --motivo "auditoria: ligações na recarga"`, um por teste novo.

## 7. Documentação

Comentários de `hooks/panel.ts` e a `TABLE`. `DESENVOLVIMENTO.md`: no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

- Recarga a quente real: com uma carta entregue e o lembrete já dado, salvar um arquivo do mod e
  esperar a publicação seguinte: uma só linha "Para …" e nenhum lembrete repetido no turno seguinte.

## 10. Dependências e conflitos

- Depois do lote 05; antes do 07 (o `/clear` com filhas usa a mesma função de primeiro uso para a
  lista das filhas deixadas de fora) e do 08 (a gravação das ligações ganha o registro de falha).
- Triagem B, lote 10 (recibo guardado no envio: `hooks/sessions.ts`, `state/durability.ts`, um campo
  novo no envio): mexe no mesmo registro. Com a regra daqui, um campo novo do envio vive no state e
  vai ao store na gravação seguinte; não há fusão a adaptar.
- Triagem A, lote 12 e 13 (leitura das filhas) e lote 14 (o plan adota cartas e cartões): tocam
  `refreshChildren` e as mesmas chaves; só precisam manter a chamada de primeiro uso no começo.
- Triagem B, lotes 02 e 03 (`sendAnchor`, em `hooks/panel.ts`): outro trecho do arquivo.

## 11. Bloqueio

Nenhum.
