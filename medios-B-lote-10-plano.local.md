# Lote 10: o recibo já usado sobrevive à recarga e ao reinício

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit.

## 1. O que cobre

Correção direta: "Recarga do mod faz um recibo antigo fechar a segunda mensagem ainda na fila". Nenhuma
decisão nova; aplica `envios.fica-ate-entrega` ("a carta fica azul até a entrega").

## 2. Causa confirmada na ponta

`hooks/sessions.ts:102-149` (`watchSends`):

- cada sessão destino publica as mensagens que recebeu (`received`: quem mandou e quando); os envios
  desta sessão ainda na fila para ela, do mais antigo ao mais novo, são casados cada um com o recibo
  mais antigo ainda não usado que seja igual ou posterior ao envio (`:134-148`);
- "já usado" é `usedReceipts` (`:111`), um conjunto que é variável do módulo: a recarga a quente e o
  processo novo o esvaziam (o próprio comentário, `:107-108`: "a reload starts it over"; a tabela de
  durabilidade o registra como perdido, `state/durability.ts:104`);
- os envios já tomados não entram no casamento (`:126`), então depois da recarga o recibo da primeira
  mensagem volta a valer e casa com a segunda, que foi enviada antes dele.

No painel: duas mensagens na fila de uma filha ocupada, de duas tarefas; ela toma a primeira (tarefa 1
✓, carta 1 verde, carta 2 azul); salva-se um arquivo do mod, ou o processo reinicia; na releitura
seguinte a tarefa 2 fecha ✓, a carta 2 fica verde com a mensagem ainda na fila, e o modelo recebe
"recebimento confirmado". Escrito no código.

Dedução do planejador sobre a correção sugerida na triagem ("guardar no próprio envio o recibo que o
confirmou … lembrando o maior recibo já usado por destino, porque os envios tomados saem da lista"): como
os envios tomados saem da lista (corte em 20 em `takenNote`, `hooks/sessions.ts:205`, e em `sentMessage`,
`hooks/tool-call.ts:157`; e o plan tira os entregues de tarefas que saíram, `hooks/tools.ts:113`), o
recibo guardado só no envio se perde com ele. O casamento é sempre em ordem (o envio mais antigo com o
recibo mais antigo), então basta lembrar, por destino, até onde os recibos já foram usados. O plano guarda
só isso.

## 3. O que muda

- Estado novo, no lugar de `usedReceipts`: por sessão destino (o id resolvido, como hoje), a marca do
  último recibo usado: o instante dele e quantos recibos daquele mesmo instante já foram usados (a
  entrega em lote grava vários recibos com o mesmo instante). Chave nova do `$.state` (nome sugerido
  `receipts`), declarada em `types/index.d.ts` (`PluginState`) e escrita como literal em
  `hooks/sessions.ts`.
- `hooks/sessions.ts`, `watchSends`: os recibos disponíveis de um destino são os que esta sessão mandou
  (`from` igual ao id próprio), em ordem, menos os anteriores à marca e menos os primeiros N do mesmo
  instante da marca. O casamento em si não muda. Ao casar, a marca do destino avança (instante do último
  recibo usado; a contagem soma quando o instante é o mesmo da marca anterior). A marca é gravada junto
  com as cartas marcadas como tomadas. Sai a variável `usedReceipts` e o comentário passa a dizer onde a
  marca vive.
- Durabilidade (`state/durability.ts`): linha nova na tabela para a chave (vive no state e no store, no
  registro das ligações, como `sends`; quando volta do store, vale o que o state já tem, senão o do
  store); sai a linha `usedReceipts` das variáveis do módulo.
- `hooks/panel.ts`, `saveLinks` e `restoreLinks`: o registro das ligações ganha o campo; na volta, o
  state recebe o do store só quando não tem nenhum.
- `hooks/session-start.ts`, `/clear`: onde os envios são zerados (`:76`), a marca também.
- O arquivo publicado não muda (a marca é só desta sessão).

No painel: depois de uma recarga do mod ou de um reinício, a segunda carta segue azul e a tarefa dela
segue aberta até a filha tomar a segunda mensagem; nenhum "recebimento confirmado" indevido.

Limite conhecido: um store gravado antes desta versão não tem a marca; no primeiro reinício depois da
atualização, um caso já em curso ainda pode errar uma vez.

## 4. Impacto

`npm run impacto -- task-tree/hooks/sessions.ts task-tree/types/index.d.ts task-tree/state/durability.ts
task-tree/hooks/panel.ts task-tree/hooks/session-start.ts`: todos os cenários (`types/index.d.ts` é do
núcleo). Golden pelo mapa: os quatro; o desenho não muda.

## 5. Testes

Novos, em `tests/durabilidade.test.ts`, em pares como os de recarga do arquivo (um objeto do arquivo
guarda o state ou o store entre os dois testes):

1. "recarga com duas mensagens na fila, 1/2: a filha toma a primeira". Cenário novo
   `durabilidade.recibo-usado-sobrevive-a-recarga`. Roteiro: `estado(on, G, 'captura')`; host com
   `local_x`; `responderEnvio`; pedido; plan com "Um" e "Dois"; start em "Um"; `envio`; start em "Dois";
   `envio` (a segunda carta vai a "Dois"); `h.recebeu('local_x', AGORA)`; `aviso`. Afirma: "Um"
   concluída com a carta entregue; "Dois" aberta com a carta na fila.
2. "recarga com duas mensagens na fila, 2/2: o módulo novo não confirma a segunda com o recibo da
   primeira". Mesmo cenário. Roteiro: `estado(on, G, 'semear')`; host com `{ id: 'local_x', recebidas:
   [{ from: EU, at: AGORA }] }` (a filha segue publicando só o primeiro recibo); `responderEnvio`;
   `aviso`. Afirma: "Dois" não concluída; a carta sob "Dois" na fila; o contexto do aviso sem
   "recebimento confirmado". Depois um segundo recibo (`h.recebeu('local_x', AGORA + 1)`) e `aviso`:
   "Dois" concluída e a carta entregue. Falha hoje no primeiro bloco: "Dois" fecha com o recibo antigo.
3. "reinício com duas mensagens na fila, 1/2" e 4. "…2/2: o processo novo não confirma a segunda com o
   recibo da primeira". Mesmo cenário, com `armazem(on, S)` nos dois e `iniciarSessao` no segundo (state
   vazio, tudo volta do store). Mesmas afirmações. Falha hoje como o par da recarga.

Testes existentes: nenhum muda. O teste da tabela (toda chave do `$.state` tem linha) passa a exigir a
linha nova: ela entra neste commit.

## 6. Catálogo e selos

`regras/durabilidade.md`, cenário novo:

- `### durabilidade.recibo-usado-sobrevive-a-recarga`
- Título: "Depois de uma recarga do mod ou de um reinício, o recibo já usado não confirma outra mensagem."
- Dado duas mensagens na fila da mesma sessão, de duas tarefas, e a sessão já tomou a primeira (tarefa 1
  ✓, carta 1 verde, carta 2 azul)
- Quando o mod é recarregado (um arquivo salvo) ou o processo reinicia, e a lista é lida de novo
- Então a carta 2 segue azul e a tarefa 2 segue aberta até a sessão tomar a segunda mensagem; o modelo
  não recebe "recebimento confirmado" por ela
- `Origem: auditoria 2026-11-10 (os recibos usados eram variável do módulo); aplica
  envios.fica-ate-entrega ("a carta fica azul até a entrega"), sem mudar nenhuma regra.`
- `Código: hooks/sessions.ts`
- `Estado: coberto`

Selos (`novo`), um por teste, com os nomes finais, por exemplo:

    npm run regras:selar -- "task-tree/tests/durabilidade.test.ts::recarga com duas mensagens na fila, 1/2: a filha toma a primeira" --tipo novo --motivo "o recibo usado fica no state e no store"
    npm run regras:selar -- "task-tree/tests/durabilidade.test.ts::recarga com duas mensagens na fila, 2/2: o módulo novo não confirma a segunda com o recibo da primeira" --tipo novo --motivo "o recibo usado fica no state e no store"

(e os dois do reinício, com o mesmo motivo).

## 7. Documentação

`DESENVOLVIMENTO.md`: as três passagens que citam `usedReceipts` (procurar a palavra: "Fluxo de dados",
"Estado e durabilidade" e a armadilha do casamento de recibos) passam a dizer a marca por destino no
state e no store; a "Tabela de durabilidade" ganha a chave. `CLAUDE.md`: nada (o item "recarga a quente
real" do checklist já existe).

## 8. Golden

Não muda.

## 9. Checklist do app

Recarga real: com duas mensagens na fila de uma filha ocupada e a primeira já tomada, salvar um arquivo
do mod; a segunda carta segue azul.

## 10. Dependências e conflitos

- Independente dos lotes anteriores. O lote 07 mexe no fim de `watchSends` (a condição de fechar); este,
  no casamento do começo: conflito de merge pequeno, sem cruzar lógica.
- Lote 25 (nome do destino) acrescenta outra chave pequena ao mesmo registro das ligações
  (`saveLinks`/`restoreLinks`) e outra linha à tabela: o segundo dos dois a entrar adapta.
- Lote 26 (ferramenta antiga de mensagem) grava envios pelo mesmo caminho; nada a adaptar.
- Triagem C, decisão 35 ("Enxugar e esvaziar (Recomendado)", arquivos publicados) e decisão 37 ("Enquanto
  a sessão existir", painel de sessão parada): mexem no que é publicado e guardado; a marca nova não é
  publicada, mas fica no store da sessão: C deve incluí-la no que é apagado quando o painel de uma sessão
  sai do store.
- Achado baixo vizinho (fora do escopo, só para o implementador saber): "watchSends marca os envios pelo
  índice de uma leitura antiga" (`marks` por índice, `:121` e `:179`). Não corrigir aqui.

## 11. Bloqueio

Nenhum.
