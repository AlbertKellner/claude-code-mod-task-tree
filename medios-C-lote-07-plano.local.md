# Lote 07 (triagem C): `/clear` numa sessão com filhas, o cartão da filha some na hora

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "/clear e retomada não mexem nas ligações das filhas: cartões antigos caem sob tarefas novas
  que reusam o id".
- Decisão 32: "Some na hora" (a opção: "Some na hora, com o resto do painel. A filha segue trabalhando
  sem cartão na mãe."). Foge da recomendação da triagem (solto no fim): vale a resposta.

## 2. Causa confirmada na ponta

- Escrito, `hooks/session-start.ts:72-78`: o `/clear` esvazia grupos, esperas, cartas, trabalho e fim
  do turno. As filhas (`children`, com `anchor`, `lastAnchor` e `rounds`), os lançamentos (`launches`),
  a lista de sessões terminadas (`ended`) e a cópia das ligações (`keptLinks` e o registro `links` do
  store) ficam.
- Escrito, `hooks/sessions.ts:34-89` e `io/host.ts:136-171`: a cada leitura (3 s) as filhas são
  refeitas da lista do app (`startedBy` igual a esta sessão), com as âncoras do state ou, na falta, do
  `keptLinks`. A lista é pelo id `local_…`, que o `/clear` não muda.
- Dedução: depois do `/clear`, o cartão antigo segue desenhado (solto, ou sob a tarefa nova que reusar
  o id da antiga, somando no x/y dela e deixando-a em andamento).
- Não medido (a triagem pedia medir no app se a lista segue trazendo as filhas depois do `/clear`): o
  plano abaixo vale nos dois casos, porque não depende da lista.

## 3. O que muda

Uma lista de "filhas deixadas para trás" por esta sessão: os ids das sessões que ela abriu antes de um
`/clear`.

- Onde vive: no registro `links` do store (um quinto campo, a lista de ids, as últimas 200) e numa
  variável do módulo de `hooks/panel.ts`, refeita sempre que o registro é lido ou gravado, como o
  `keptLinks` (a função de primeiro uso das ligações, do lote 06, a traz depois de uma recarga).
  `state/durability.ts`: uma linha nova na `TABLE` (variável de módulo) e a nota da linha `children`.
- `/clear` (`hooks/session-start.ts`, com uma função nova em `hooks/panel.ts`): antes da publicação do
  painel vazio (a ordem do lote 04), junta os ids das filhas do state e os do `keptLinks` à lista,
  esvazia `children`, `launches` e `ended`, zera o `keptLinks` e grava o registro.
- Leitura das filhas (`hooks/sessions.ts`, `refreshChildren`): as linhas da lista do app cujo id está
  na lista ficam fora das "minhas" antes de ler os arquivos e derivar as filhas. A conferência das
  cartas (`watchSends`) segue olhando a lista inteira.
- Envio (`hooks/tool-call.ts`, `sentMessage`): para um destino que está na lista, não cria a entrada
  provisória da filha ("Sessão…") nem grava rodada; a carta ✉ é registrada como qualquer envio.
- `start_session` (`recordStart`): uma sessão aberta depois do `/clear` tem id novo e entra normal.

Em termos do painel: depois do `/clear`, o painel fica "Nenhuma tarefa planejada." e segue assim nas
leituras seguintes; o cartão de uma filha aberta antes não volta, nem solto no fim, nem sob uma tarefa
nova que reuse o id da antiga; não soma no cabeçalho, no x/y nem no chip de sessões, e não deixa
tarefa em andamento. A filha segue trabalhando; o aviso do app de que ela terminou o turno continua
chegando ao modelo pelo próprio app, sem o lembrete do painel sobre a tarefa de origem. Uma mensagem
nova a essa filha mostra a carta ✉ sob a tarefa do envio, com a entrega acompanhada, sem cartão. Uma
sessão aberta depois do `/clear` aparece como sempre.

## 4. Impacto

`npm run impacto -- hooks/session-start.ts hooks/panel.ts hooks/sessions.ts hooks/tool-call.ts
state/durability.ts`: 95 cenários (sessões 22, envios 17, turnos 14, pedidos 14, durabilidade 9,
perguntas 8, subagentes 5). Checklist: `envios.destino-arquivado-no-app`, `envios.subagente-no-app`
(não tocados). Golden: nenhum.

## 5. Testes de verificação (`tests/durabilidade.test.ts`)

- "/clear numa sessão com filha: o cartão some e não volta sob a tarefa nova de mesmo id". Regra:
  `durabilidade.clear-tira-os-cartoes-das-filhas`. Roteiro: `armazem`, `host` com a filha trabalhando;
  pedido, plan com a tarefa `1`, start, `abrirSessao`, `aviso` (o cartão sob "Um"); `limpar`; `aviso`:
  o painel vazio; pedido, plan com outra tarefa de id `1`, start, `aviso`: nenhum cartão da filha
  (`cartoes(p, 'filha-um')` vazio), o cabeçalho com 1 tarefa e o chip de sessões em zero. Falha hoje: o
  cartão volta sob a tarefa nova.
- "uma sessão aberta depois do /clear aparece sob a tarefa dela". Mesma regra: duas filhas no `host`;
  a primeira aberta antes do `/clear`, a segunda depois; só a segunda tem cartão.
- "depois de uma recarga, a filha de antes do /clear segue sem cartão", 1/2 e 2/2 com `armazem` e
  `estado` (`captura`, `semear`). Mesma regra. Falha hoje como o primeiro.
- "uma mensagem nova à filha de antes do /clear mostra a carta, sem cartão". Mesma regra: depois do
  `/clear`, pedido, plan, start, `envio` para ela, `aviso`: a carta sob a tarefa, nenhum cartão.
- Testes existentes: nenhum muda ("/clear esvazia o painel" não tem filhas).

## 6. Catálogo (`regras/durabilidade.md`) e selos

Novo, `coberto`:

```markdown
### durabilidade.clear-tira-os-cartoes-das-filhas
Depois do /clear, os cartões das filhas abertas antes somem e não voltam.

- Dado uma sessão que abriu sessões filhas, com os cartões sob as tarefas
- Quando a pessoa usa /clear nela
- Então os cartões somem na hora, com o resto do painel, e não voltam nas leituras seguintes: nem soltos no fim, nem sob uma tarefa nova que reuse o id da antiga; não somam no cabeçalho nem no x/y e não deixam tarefa em andamento; a filha segue trabalhando sem cartão nesta sessão, também depois de uma recarga do mod; uma mensagem nova a ela mostra só a carta; uma sessão aberta depois do /clear aparece normalmente

Origem: decisão do usuário, 2026-11-14 ("Some na hora"), à pergunta "Depois de um /clear numa sessão que abriu sessões filhas, o que acontece com o cartão de uma filha aberta antes do /clear?".
Código: hooks/sessions.ts, hooks/tool-call.ts, io/host.ts
Estado: coberto
```

`durabilidade.clear-esvazia` não muda.

Selos: `npm run regras:selar -- "task-tree/tests/durabilidade.test.ts::<nome>" --tipo novo --motivo "decisão 2026-11-14: /clear com filhas, o cartão some na hora"`, um por teste novo.

## 7. Documentação

A `TABLE` e o comentário de `keptLinks` em `hooks/panel.ts`. `DESENVOLVIMENTO.md`: no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

- Numa sessão real com uma filha trabalhando: `/clear`; o painel fica vazio e segue vazio depois de
  alguns segundos (a releitura de 3 s); planejar de novo com o id `1`: nenhum cartão antigo aparece.
- Mandar uma mensagem à filha antiga: aparece só a carta, que fica verde na entrega.

## 10. Dependências e conflitos

- Depois do lote 04 (a ordem "zerar antes de publicar" no ramo `clear`) e do lote 06 (a função de
  primeiro uso das ligações, que passa a trazer também a lista; sem o lote 06, a lista teria de ser
  lida do store dentro do `refreshChildren`).
- Triagem A, lote 23 (decisão 16, `/clear` numa **filha**: o cartão dela na mãe mantém o histórico):
  é o outro lado. Aqui a mãe se limpa e esquece as filhas; lá a filha se limpa e a mãe guarda o que
  ela já tinha feito. Os dois mexem em `hooks/sessions.ts`, `io/host.ts` e `state/durability.ts`.
- Triagem A, lotes 12 e 13 (leitura das filhas) e 24 (filha arquivada antiga vira linha): mexem em
  `refreshChildren` e `deriveChildren`; o filtro daqui fica antes da leitura dos arquivos.
- Triagem A, lote 25 (o `/clear` limpa as dobras): mesmo ramo `clear`.

## 11. Bloqueio

Nenhum. Ponto para a orquestradora, que não contraria decisão registrada: o plano entende "a filha
segue trabalhando sem cartão na mãe" como definitivo naquela sessão, mesmo quando a mãe manda uma
mensagem nova à filha (só a carta aparece). Se o usuário quiser o cartão de volta nesse caso, é uma
pergunta nova: "Depois do /clear, ao mandar uma mensagem nova a uma filha aberta antes, o cartão dela
volta (só com a rodada nova) ou segue só a carta?".
