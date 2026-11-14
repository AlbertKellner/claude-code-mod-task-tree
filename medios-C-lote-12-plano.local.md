# Lote 12 (triagem C): painel guardado enquanto a sessão existir

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "O store guarda o painel só das 30 sessões que gravaram por último: sessão antiga retomada
  volta vazia e apaga o histórico do cartão na mãe".
- Decisão 37: "Enquanto a sessão existir (Recomendado)". A opção: "Enquanto a sessão existir no app.
  O painel volta inteiro sempre que ela for retomada, e o cartão na mãe mantém o histórico."

## 2. Causa confirmada na ponta

- Escrito, `state/durability.ts:125` (`KEEP = 30`) e `173-180`: a lista `sessions` é do plugin, de
  todas as sessões da máquina; o painel (`session:<id>`) das que saem das 30 é apagado.
- Escrito, `hooks/panel.ts:390-430`: sem o painel no store, um processo novo começa do vazio; a
  primeira escrita grava o painel vazio e a publicação seguinte apaga do arquivo publicado o histórico
  que o cartão dela mostrava na mãe.
- Escrito, `io/publish.ts`: o arquivo publicado da própria sessão tem os grupos inteiros, o trabalho,
  as cartas, as mensagens recebidas e as filhas com as ligações (`anchor`, `lastAnchor`, `rounds`,
  `openedAt`). Ele só existe no app desktop (fora dele não há id).
- A triagem já apontava a saída: "restaurar do arquivo publicado da própria sessão quando o store não
  tem o painel", sem somar ao teto de 4 MiB do store.

## 3. O que muda

A cópia de longo prazo do painel passa a ser o arquivo publicado da própria sessão, que dura enquanto
a sessão existir no app (o lote 11 só o esvazia quando o app deixa de listar a sessão). O store segue
com as 30 últimas (o caminho rápido, e o único fora do app).

`hooks/panel.ts` (o que traz o painel: `keptGroups`, `restore`, `ensureGroups`) e
`hooks/session-start.ts`:
- Quando o store não tem o painel desta sessão (processo novo, no `session.start` ou no primeiro
  uso), e só então, o mod lê o arquivo publicado dela (o id `local_…` pelo `selfId`). Se o arquivo tem
  grupos com tarefas, o painel volta dele: os grupos (o que os subagentes deixaram aberto volta
  interrompido, como na volta do store), o trabalho, as cartas, as mensagens recebidas, as filhas com
  as ligações (para os cartões voltarem sob as mesmas tarefas) e o fim do turno. Em seguida tudo é
  gravado no store, e a sessão volta à lista das 30.
- A leitura do arquivo acontece antes de qualquer publicação do módulo (dentro do mesmo "primeiro
  uso" dos grupos), para o arquivo não ser regravado vazio antes de ser lido. Uma tentativa por módulo.
- Fora do app desktop (sem id) nada muda: valem as 30 últimas.
- A retomada de outra sessão no mesmo processo (`resume`, com o uuid) segue só pelo store: o arquivo é
  pelo id do app, que é o desta sessão.

`io/publish.ts` e `types/index.d.ts`: o arquivo publicado precisa dizer o fim do turno (quando
terminou, se foi parado, se o replano está pendente), senão o painel que volta dele cairia na regra do
lote 05 e a tarefa iniciada viraria ✕. Se o lote 21 da triagem A (fim do turno no arquivo publicado)
já entrou, usa-se o campo dele; senão este lote acrescenta ao arquivo o mesmo registro que o store
guarda em `turn` (campo opcional; leitores antigos o ignoram; `PUBLISHED_VERSION` não muda).

`state/durability.ts`: a nota das linhas `groups`, `work` e das ligações na `TABLE` (sem cópia no
store, o arquivo publicado da própria sessão).

Em termos do painel: uma sessão parada há dias, cujo painel já saiu das 30, ao ser reaberta volta com
o painel inteiro (pedidos, ✓, cartões das filhas sob as mesmas tarefas, "+N pedidos anteriores"), e o
cartão dela na mãe mantém as rodadas e os ✓ anteriores.

## 4. Impacto

`npm run impacto -- hooks/panel.ts hooks/session-start.ts state/durability.ts io/publish.ts`: 95
cenários (sessões 22, envios 17, turnos 14, pedidos 14, durabilidade 9, perguntas 8). Com
`types/index.d.ts` (núcleo), todos os cobertos. Golden: nenhum.

## 5. Testes de verificação (`tests/durabilidade.test.ts`)

O `host` do kit precisa servir o arquivo da própria sessão (hoje só serve os das filhas): uma opção
para semear o arquivo próprio com o que um teste anterior publicou (selo de refatoração do kit).
- "painel fora do store, 1/2: a sessão publica o painel" e "…, 2/2: o processo novo o traz do arquivo
  publicado". Regra: `durabilidade.painel-volta-do-arquivo-publicado`. O 1/2: `host`, `armazem`;
  pedido um concluído com resumo, pedido dois com uma tarefa iniciada, uma filha aberta sob ela, fim
  do turno; guarda `h.proprio()`. O 2/2: `armazem` vazio (o painel saiu das 30), `host` com o arquivo
  próprio semeado; `iniciarSessao`; afirma: o pedido dois desenhado com os estados (a iniciada ◷, não
  ✕ nem ◉), "+1 pedidos anteriores", o cartão da filha sob a mesma tarefa depois de um `aviso`, e
  `session:<id>` de volta no store. Falha hoje: o painel volta vazio.
- "painel fora do store, sem session.start: o primeiro uso o traz do arquivo". Mesma regra, sem
  `iniciarSessao` no 2/2.
- "com o painel no store, o arquivo não é lido como painel": o store com o Plano A e o arquivo próprio
  com o Plano B: vale o do store. Mesma regra.
- "fora do app, sem painel no store, o painel volta vazio". Mesma regra (sem `host`: não há id). Passa
  hoje; protege o limite.
- Testes existentes: nenhum muda (nos atuais o `host` responde "sem arquivo" para a própria sessão).

## 6. Catálogo (`regras/durabilidade.md`) e selos

Novo, `coberto`:

```markdown
### durabilidade.painel-volta-do-arquivo-publicado
O painel de uma sessão parada há muito tempo volta inteiro enquanto a sessão existir no app.

- Dado uma sessão do app desktop cujo painel já saiu do store (só as 30 que gravaram por último ficam lá) e que ainda existe no app
- Quando um processo novo a abre (session.start, ou o primeiro uso sem ele)
- Então o painel volta do arquivo que ela mesma publicou: pedidos, estados, trabalho atual, cartas, cartões das filhas sob as mesmas tarefas e o fim do turno como estava; ele volta ao store, e o cartão dela na sessão que a abriu mantém o histórico; com o painel no store, vale o do store; fora do app desktop valem as 30 últimas

Origem: decisão do usuário, 2026-11-14 ("Enquanto a sessão existir (Recomendado)"), à pergunta "Por quanto tempo o painel de uma sessão parada deve ser guardado?".
Código: io/publish.ts, io/host.ts
Estado: coberto
```

Selos:
- `node scripts/selos.mjs --kit task-tree/tests/kit/ambiente.ts --tipo refatoracao --motivo "host serve o arquivo publicado da própria sessão"`
- `npm run regras:selar -- "task-tree/tests/durabilidade.test.ts::<nome>" --tipo novo --motivo "decisão 2026-11-14: painel guardado enquanto a sessão existir"`, um por teste novo.

## 7. Documentação

A `TABLE` e o topo de `io/publish.ts` (o arquivo passa a ser também a cópia de longo prazo do painel
da própria sessão). `DESENVOLVIMENTO.md`: no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

- Abrir uma sessão antiga (fora das 30 últimas; com o lote 08 dá para ver no arquivo do store quais
  ids estão em `sessions`) e mandar uma mensagem: o painel volta com o histórico, e o cartão dela na
  mãe não perde as rodadas.

## 10. Dependências e conflitos

- Depois do lote 05 (a regra do processo morto, que este lote precisa não disparar), do 08 (a poda de
  `work:`, `turn:` e `links:` das sessões fora da lista só fica sem perda com este lote) e do 11 (o
  arquivo próprio continua inteiro; só é esvaziado quando a sessão deixa de existir).
- Triagem A, lote 21 (fim do turno no arquivo publicado): mesmo campo. Um dos dois o cria; o outro
  usa. O nome e a forma ficam com quem entrar primeiro.
- Triagem A, lote 23 (`/clear` numa filha: o cartão mantém o histórico): se guardar o histórico do
  lado da mãe, não conflita; se mudar o que a filha publica depois do `/clear`, o painel que volta do
  arquivo é o de depois do `/clear` (certo: o `/clear` grava o painel vazio no store, e com cópia no
  store o arquivo nem é lido).
- Lote 07 daqui (as filhas deixadas para trás no `/clear`): a lista vive no registro `links` do
  store; quando ele foi podado, as filhas de antes de um `/clear` antigo poderiam voltar pelo arquivo.
  O arquivo publicado depois do `/clear` já não as traz em `children`, então não voltam.

## 11. Bloqueio

Nenhum.
