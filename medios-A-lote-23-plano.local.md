# Lote 23: /clear numa filha, o cartão mantém o histórico

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário).

## 1. O que cobre

- Achado "/clear numa filha apaga da mãe todo o trabalho dela (os ✓ saem da contagem) e o cartão vira
  "concluída" vazio, sem cenário".
- Decisão 16, 2026-11-14: **"Mantém o histórico (Recomendado)"**. A opção: "Mantém o que ela já tinha
  feito, como histórico: o x/y da tarefa de origem e o cabeçalho da mãe não encolhem, e o trabalho que a
  filha fizer depois aparece num cartão novo."

## 2. Causa confirmada na ponta atual

Escrito no código:
- `hooks/session-start.ts:72-78`: o `/clear` troca os grupos por um grupo principal vazio (`replace`), que
  é salvo e publicado;
- `io/host.ts:62-70` e `166`: a mãe lê o painel publicado e ele substitui o anterior (`read.panels[id] ??
  before?.panel`): o painel vazio entra no lugar do trabalho feito;
- `draw/layout.ts:1252`: o cartão sem tarefa aberta, de sessão parada, diz "concluída".

Dedução: em até 3 s o cartão perde as tarefas e as respostas, o x/y da tarefa de origem e o cabeçalho da
mãe encolhem.

`durabilidade.clear-esvazia` cobre só o painel da própria sessão ("Nenhuma tarefa planejada.") e não muda.

## 3. O que muda

`types/index.d.ts`, `hooks/session-start.ts`, `draw/layout.ts`.

A sessão que leva o `/clear` guarda o que tinha feito dentro do próprio grupo principal, num campo que o
painel dela não desenha; como o grupo é salvo e publicado como sempre, a mãe o recebe sem mudança no
arquivo publicado nem na leitura.

- `Group` (grupo principal) ganha um campo opcional com o trabalho de antes de cada `/clear` (sugestão:
  `past?: { at: number; tasks: TaskNode[]; turns?: Turn[] }[]`), os 5 mais recentes.
- `/clear` (`classicSessionStart`): antes de esvaziar, se o grupo principal tem tarefas, acrescenta uma
  entrada com a hora, as tarefas e os turnos dele. O que estava aberto entra como interrompido
  (`interrupt`, como numa sessão arquivada: não será feito por aquele plano). O grupo novo nasce com
  `tasks: []`, sem turnos, e com `past`. Os grupos de subagente não vão ao histórico.
- O painel da própria sessão não muda: `layout()` só lê `tasks` e `turns` ("Nenhuma tarefa planejada.").
  Todo código que reescreve o grupo principal com `{ ...g, … }` mantém o campo.
- Na mãe (`draw/layout.ts`, `split`): para a filha cujo grupo principal publicado traz `past`, cada
  entrada vira os cartões de um painel só com aquelas tarefas e turnos, divididos por rodada como
  qualquer outro (as mensagens da mãe de antes do `/clear` casam com os turnos de antes pelo horário).
  São cartões de histórico: nunca "trabalhando" nem "aguardando", com a chave de linha própria (a de
  hoje mais a hora do `/clear`), para a dobra não se confundir com a do cartão novo.
  - O cartão do trabalho de depois do `/clear` é o de hoje: os turnos da filha recomeçam em 1, e o
    desenho já sabe ler isso (`opening`, `layout.ts:342-345` e `375`; `sessoes.test.ts:780`).
  - Enquanto a filha não planeja nada depois do `/clear`, o cartão mais recente do histórico responde
    pela sessão (leva o "trabalhando", o anel e a palavra de estado); o cartão vazio não é desenhado.
- A contagem vem sozinha: os cartões de histórico entram em `total`, `atWork` e nas linhas (`nodes`) como
  qualquer cartão; as ✓ contam, as ✕ ficam fora.

Comportamento novo no painel da mãe: `/clear` numa filha que tinha feito 5 de 5: o cartão segue com as 5
tarefas ✓, a tarefa de origem segue com o x/y e o cabeçalho não encolhe; o que a filha fizer depois
aparece em outro cartão (sob a tarefa de origem, se foi logo depois da abertura; como "pedido do usuário
na filha", no pedido vigente, se foi mais tarde).

## 4. Impacto

`npm run impacto -- types/index.d.ts hooks/session-start.ts draw/layout.ts`: núcleo tocado: todos os 159
cenários cobertos; os 4 do golden; ver 8.

## 5. Testes a escrever

1. `tests/durabilidade.test.ts`, regra `sessoes.clear-na-filha-mantem-o-historico` (nova):
   **"o /clear guarda no painel publicado o que a sessão tinha feito, e o painel dela fica vazio"**.
   Roteiro: `fixar`; `const h = host(on, [])`; `pedido`; `plan(A)`; `start(['1'])`; `done(['1'])`;
   `limpar($)`. Afirma: `cabecalho(await painel($)).vazio` verdadeiro; o grupo principal de `h.proprio()`
   tem `tasks` vazio e `past` com uma entrada, cujas tarefas trazem "Um" `done` e "Dois" `interrupted`.
   Falha hoje: o publicado não tem `past`.
2. `tests/sessoes.test.ts`, mesma regra:
   **"depois do /clear na filha, o cartão dela na mãe mantém as tarefas feitas e a contagem"**. Roteiro:
   `fixar`; `host` com K1 parada, usando `publicado` (texto cru, versão 1): `groups` com o grupo principal
   de `tasks: []` e `past: [{ at: AGORA + 5000, tasks: [cinco tarefas concluídas, "p1" a "p5", com
   `turn: 1`], turns: [{ id: 1, title: 'turno 1', at: AGORA + 10 }] }]`; `pedido`; `plan(A3)`;
   `start(['1'])`; `abrirSessao`; `aviso`.
   Afirma: `cartoes(p, 'filha-um')` tem um cartão, sob "Um", com "p1" a "p5"; a linha "Um" contém "5/6";
   `cabecalho(p)`: `[feitas, total]` igual a `[5, 8]`.
   Falha hoje: o cartão vem vazio, "Um" mostra 0/1 e o total é 3.
3. `tests/sessoes.test.ts`, mesma regra:
   **"o trabalho da filha depois do /clear aparece num cartão novo, e o histórico segue no dele"**. Como
   em 2, com o grupo principal trazendo também uma tarefa nova "n1" iniciada, num turno 1 digitado
   (`own: true`) com `at` 20 minutos depois da abertura. Afirma: dois cartões da filha, um com "p1" a
   "p5" sob "Um" e outro com "n1"; `[feitas, total]` igual a `[5, 9]`.
   Falha hoje: só o cartão de "n1".

Testes existentes: `durabilidade.clear-esvazia` (`durabilidade.test.ts:125`) não muda.

## 6. Catálogo e selos

`regras/sessoes.md`:

```markdown
### sessoes.clear-na-filha-mantem-o-historico
Depois de um /clear numa filha, o cartão dela na mãe mantém o que ela tinha feito.

- Dado uma sessão filha com tarefas feitas
- Quando a pessoa dá /clear nela, e depois ela trabalha de novo
- Então o painel da filha fica vazio (durabilidade.clear-esvazia), e o que ela tinha feito segue no painel publicado como histórico: na mãe, o cartão mantém as tarefas (as abertas ficam ✕), o x/y da tarefa de origem e o cabeçalho não encolhem; o trabalho de depois aparece num cartão novo; ficam os 5 /clear mais recentes

Origem: decisão do usuário, 2026-11-14 ("Mantém o histórico (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (o /clear na filha apagava da mãe o trabalho dela).
Código: hooks/session-start.ts, draw/layout.ts
Estado: coberto
```

Selos: `--tipo novo` para os três testes, motivo `decisão do usuário, 2026-11-14: "Mantém o histórico
(Recomendado)"`.

## 7. Documentação

`DESENVOLVIMENTO.md`: `classicSessionStart` em "Os 14 hooks" e o comentário de `Group` em
`types/index.d.ts:59-70`; "Arquivo publicado" (o campo vai dentro de `groups`, sem campo novo no arquivo
nem versão nova); entrada em "Decisões (histórico)".

## 8. Golden

Não muda (nenhum cenário tem `/clear`).

## 9. Checklist do app

- `/clear` numa filha real com tarefas feitas: na mãe, o cartão segue com as tarefas e a contagem; a
  filha mostra "Nenhuma tarefa planejada."; o que ela fizer depois aparece em outro cartão.
- Conferir no app se, depois do `/clear`, o `$.session.id()` da filha muda e se o painel dela (com o
  histórico) segue salvo e publicado: o `replace` do `/clear` grava sob o id que o engine der naquele
  momento.

## 10. Dependências e conflitos

- Depois dos lotes 16, 17, 19 e 20 (`split`). Mesmo handler que o lote 25 (dobras no `/clear`).
- Lote 24 (arquivada antiga vira uma linha) resume o cartão inteiro, com o histórico dentro da conta.
- Triagem C, no mesmo handler do `/clear`: decisão 32 ("Some na hora": o `/clear` de uma sessão **com**
  filhas tira os cartões delas; é o outro lado, o da mãe), a correção "/clear publica o painel antes de
  zerar waits e sends" e a retomada num processo vivo. A decisão 35 ("Enxugar e esvaziar" os arquivos
  publicados) e a 37 (guardar o painel enquanto a sessão existir) tocam o tamanho do que é guardado: o
  histórico tem teto de 5 entradas e só tarefas e turnos. Juntar no mesmo trecho.
- Triagem B: nada aqui.

## 11. Bloqueio

Nenhum.
