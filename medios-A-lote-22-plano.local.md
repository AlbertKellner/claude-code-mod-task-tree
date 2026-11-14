# Lote 22: tempo da tarefa concluída com filha embaixo, só o próprio

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário).

## 1. O que cobre

- Achado "Tarefa concluída com filha embaixo: o tempo corre enquanto a filha trabalha e regride quando ela
  para".
- Decisão 17, 2026-11-14: **"Só o próprio"** (não é a recomendada). A opção: "Só o tempo próprio, até o
  done: T mostra 0:03 também enquanto a filha trabalha; o relógio dessa linha não corre." A pergunta era
  sobre "T e o pedido".

## 2. Causa confirmada na ponta atual

Escrito no código, `draw/layout.ts`:
- `layout.ts:539-541` e `567` (`atWork`): as tarefas da filha só entram em `w.tasks` (o tempo) se a tarefa
  de origem não está concluída;
- `layout.ts:571`: `busy` é verdadeiro enquanto uma filha trabalha na rodada atual sob a tarefa, concluída
  ou não;
- `layout.ts:587-594` (`timeOf`/`timeSpan`): com `busy`, o tempo é "agora menos o primeiro início";
- `layout.ts:1136-1137` (linha da tarefa) e `1205-1206` (linha do pedido) usam essa conta.

Dedução: a mãe manda uma mensagem a partir de T, concluída em 3 s; a filha trabalha 10 minutos. T mostra
o tempo correndo até 10:03 e, quando a filha para, volta a 0:03. O pedido faz o mesmo quando todas as
tarefas dele estão concluídas.

Nenhum cenário fala do tempo dessa linha.

## 3. O que muda

Só `draw/layout.ts`.

- Linha de tarefa (`rows`): o trabalho da filha só faz o tempo correr quando a tarefa da linha está
  aberta. Com a tarefa fechada (`done` ou `interrupted`), o tempo é o próprio: do primeiro início ao
  último fim dela e das subtarefas (`span` da tarefa), parado, com a filha trabalhando ou não. O tom
  não muda (a tarefa concluída com filha trabalhando segue ◉,
  `sessoes.filha-trabalhando-mantem-pais-em-andamento`); o x/y não muda (segue somando as tarefas da
  filha).
- Linha de pedido (`turnRows`): o mesmo critério. Com todas as tarefas de nível 1 do pedido fechadas, o
  tempo do pedido é o das tarefas dele, parado; com alguma aberta, como hoje.
- Tarefa aberta com filha trabalhando embaixo, e os pais abertos dela: como hoje (o tempo corre e inclui
  as tarefas da filha).

Comportamento novo no painel: T concluída em 3 s com a filha trabalhando 10 minutos: T mostra ◉ 0:03 o
tempo todo, e 0:03 depois que a filha para; o número não cresce nem regride.

## 4. Impacto

`npm run impacto -- draw/layout.ts`: 110 cenários; os 4 do golden pelo mapa; ver 8.

## 5. Testes a escrever

`tests/sessoes.test.ts`, regra `sessoes.tempo-da-tarefa-concluida-com-filha` (nova):
1. **"a tarefa concluída com a filha trabalhando embaixo mostra só o tempo próprio, que não corre nem
   regride"**. Roteiro: `const { relogio } = fixar(on)`; `const h = host(on, [{ id: K1, nome: 'filha-um',
   painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } }])`; `pedido`; `plan(A3)`;
   `start(['1'])`; `abrirSessao`; `aviso`; `relogio.advance(3000)`; `done(['1'])`;
   `relogio.advance(600_000)`; `aviso`.
   Afirma: "Um" em andamento; a linha "Um" contém "0:03" e não contém "10:0". Depois a filha para
   (`rodando = false`, a tarefa dela concluída) e `aviso`: "Um" concluída, a linha ainda com "0:03".
   Falha hoje: com a filha trabalhando, a linha mostra 10:03.
2. **"o pedido com tudo concluído e a filha trabalhando embaixo mostra o tempo das tarefas dele, parado"**.
   Como em 1, com o plano de uma tarefa só (`{ id: 'A', title: 'Plano A', children: [{ id: '1', title:
   'Um' }] }`). Afirma: as linhas "Plano A" e "Pedido um" contêm "0:03" e não "10:0", com a filha
   trabalhando.
   Falha hoje: 10:03 nas duas.

Testes existentes: nenhum afirma o tempo dessa linha. O golden "filha" tem a tarefa de origem aberta.

## 6. Catálogo e selos

`regras/sessoes.md`:

```markdown
### sessoes.tempo-da-tarefa-concluida-com-filha
A tarefa concluída com filha embaixo mostra só o tempo próprio.

- Dado uma tarefa da mãe concluída com done, com uma sessão filha ainda trabalhando embaixo
- Quando o painel é desenhado, com a filha trabalhando e depois de ela parar
- Então a linha da tarefa mostra o tempo do início ao done dela, parado, nos dois momentos (o ícone segue ◉ enquanto a filha trabalha, e o x/y segue somando as tarefas da filha); o pedido com todas as tarefas concluídas mostra o tempo delas, parado; a tarefa aberta com filha trabalhando segue com o tempo correndo

Origem: decisão do usuário, 2026-11-14 ("Só o próprio": "T mostra 0:03 também enquanto a filha trabalha; o relógio dessa linha não corre"), sobre o achado da auditoria de 2026-11-10 (o tempo corria com a filha trabalhando e regredia quando ela parava).
Estado: coberto
```

Selos: `--tipo novo` para os dois testes, motivo `decisão do usuário, 2026-11-14: "Só o próprio"`.

## 7. Documentação

`DESENVOLVIMENTO.md`: o trecho do tempo (`timeOf`, ~1321-1325: "ou até agora enquanto alguma roda ou uma
sessão embaixo de tarefa não concluída está viva") já fala em tarefa não concluída: acertar o código ao
texto e citar a decisão; entrada em "Decisões (histórico)".

## 8. Golden

Não deve mudar (no cenário "filha" a tarefa de origem está aberta). Conferir.

## 9. Checklist do app

- Numa orquestradora real: mandar mensagem de uma tarefa, concluí-la, e ver que o tempo dela fica parado
  enquanto a filha trabalha.

## 10. Dependências e conflitos

- Independente dos outros lotes da triagem A no código (`timeOf`, `turnRows`).
- Triagem B, decisões 25 e 26 (tempo do cabeçalho com o turno encerrado; tempo da tarefa que atravessa
  turnos: "Só com turno em curso") e triagem C, decisão 44 (base do tempo de pai e pedido: "Do primeiro
  start"), mexem nas mesmas funções de tempo. Quem vier depois mantém: tarefa fechada não corre por
  causa da filha.

## 11. Bloqueio

Nenhum.
