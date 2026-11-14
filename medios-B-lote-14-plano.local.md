# Lote 14: as tarefas do subagente contam no cabeçalho e nas linhas acima

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão). Só `draw/layout.ts` muda.

## 1. O que cobre

- Achado: "As tarefas de um subagente contam no cabeçalho só enquanto o cartão dele está desenhado, e
  nunca na linha da tarefa ou do pedido".
- Decisão 23 (B), 2026-11-14: "No cabeçalho e acima". Texto da opção: "entram no 'd de n' e no x/y da
  tarefa de origem e do pedido, com o cartão aberto, recolhido ou em cartão de grupo." (não era a
  recomendada; vale a resposta).

## 2. Causa confirmada na ponta

Tudo em `draw/layout.ts`:

- Cartão do subagente desenhado: as linhas das tarefas dele levam as próprias tarefas para a soma do
  cabeçalho (`Row.nodes`), e o cartão recolhido leva todas (`:1617-1621`). Por isso o "d de n" já as
  conta enquanto o cartão está à vista.
- Tarefa de origem recolhida: `row.nodes = [t, ...w.cards]` (`:1158`); `w.cards` são só as tarefas das
  sessões filhas (`atWork`, `:567-568`). As do subagente somem do cabeçalho.
- Pedido recolhido: `row.nodes = [...list, ...ws.flatMap(w => w.cards)]` (`:1226`). Idem.
- x/y da tarefa: `[sd, sn] = [ld + w.d, ln + w.n]` (`:1118-1119`), tarefas próprias mais as das sessões.
  x/y do pedido: `:1181-1182`. Nenhum soma as do subagente.
- Cartão de grupo: o cabeçalho e a linha fechada de cada agente têm `nodes: []` (`:1550`, `:1569`); as
  tarefas de um agente do grupo só contam com a linha dele aberta.
- A conta da sessão inteira (`total`, `:497-508`) já soma as tarefas de todos os grupos, as dos
  subagentes também. O status "Tarefas d/n" também.

Escrito no código. `subagentes.fora-da-contagem` (2026-11-09, "Fora da contagem") fala do subagente em
si (o cartão não é uma tarefa); para as tarefas que ele planeja não havia decisão.

## 3. O que muda

Uma noção nova no desenho: "as tarefas dos subagentes lançados desta tarefa ou de baixo dela", pelo dono
do grupo (o loop que os lançou), seguindo os subagentes que esses subagentes lançaram. Usada assim:

- x/y da tarefa de origem (e dos pais dela): soma as feitas e o total dessas tarefas; as interrompidas
  ficam fora, como sempre. A folha que tem subagente com tarefas passa a mostrar x/y (ela mesma mais as
  dele), como a folha com sessão filha.
- x/y do pedido: soma as das suas tarefas de nível 1.
- Linha recolhida (tarefa, pedido): leva essas tarefas para a soma do cabeçalho, junto das que já leva.
- Cartão de subagente recolhido: leva as tarefas dele e as dos subagentes que ele lançou.
- Cartão de grupo: a linha fechada de cada agente leva as tarefas dele (e as de quem ele lançou); o
  cartão recolhido leva as de todos.
- Dentro do cartão de uma sessão filha vale igual (é o mesmo desenho); o x/y do próprio cartão da filha
  já contava todos os grupos dela.
- O que não muda: o cartão do subagente não é tarefa e segue fora de tudo (um subagente sem plano não
  acrescenta nada); a pílula "N subagentes"; o tempo das linhas (não soma o das tarefas do subagente); a
  cor das linhas (o lote 15 trata da tarefa com subagente rodando).

No painel: um subagente planeja 2 tarefas sob "Investigar" e conclui 1; "Investigar" mostra 1/3, o
pedido 1/4 (com mais uma tarefa da sessão), o cabeçalho "1 de 4"; recolher "Investigar", o pedido ou o
cartão não muda o "1 de 4"; num cartão de grupo, o mesmo com as linhas dos agentes fechadas.

## 4. Impacto

`npm run impacto -- task-tree/draw/layout.ts`: 110 cenários. Golden pelo mapa: os quatro. No cenário
`subagente` nenhum subagente planeja tarefas: o desenho não muda.

## 5. Testes

Novos, em `tests/subagentes.test.ts`:

1. "as tarefas que o subagente planeja contam no cabeçalho e no x/y da tarefa de origem e do pedido, com
   o cartão aberto ou a tarefa recolhida". Cenário novo `subagentes.tarefas-do-subagente-contam-acima`.
   Roteiro: `lancaveis(['sub-1'])`; pedido; plan da sessão com "Investigar" e "Outra"; start em
   "Investigar"; `lancar`; o subagente planeja dois níveis 1, "X1" e "X2" (`plan(…, undefined,
   'sub-1')`), dá start e done em "X1". Afirma: cabeçalho 1 de 4; a linha "Investigar" contém "1/3"; a
   linha do pedido contém "1/4". Depois, com `montar`, recolhe "Investigar": cabeçalho ainda 1 de 4;
   recolhe o pedido: ainda 1 de 4. Falha hoje: "Investigar" sem x/y, o pedido com "0/2", e o cabeçalho
   cai a 0 de 2 ao recolher.
2. "num cartão de grupo, as tarefas de um agente contam com a linha dele fechada". Mesmo cenário.
   Roteiro: quatro `lancar` da mesma tarefa (cartão "4 subagentes"); um deles planeja duas tarefas e
   conclui uma. Afirma: o cabeçalho soma as duas (total da sessão mais 2, feitas mais 1) com as linhas
   fechadas; recolhido o cartão de grupo, igual. Falha hoje: não somam.

Testes existentes: o de `subagentes.fora-da-contagem` (`:119-133`) lança subagentes sem plano e não
muda. Os de `tests/turnos.test.ts:326-360` (subagente com plano que termina) e os do subagente neto
(`tests/subagentes.test.ts:622-760`) têm subagentes com tarefas: se algum afirmar um x/y ou um "d de n"
que agora soma as tarefas do subagente, ele muda por esta decisão: o cenário dele ganha `Reescrito:
2026-11-14, decisão do usuário ("No cabeçalho e acima"): as tarefas do subagente contam no x/y da tarefa
de origem e do pedido e no cabeçalho.` e o teste é selado `--tipo decisao --motivo "decisão do usuário,
2026-11-14: No cabeçalho e acima"`. Nenhum outro teste pode mudar.

## 6. Catálogo e selos

`regras/subagentes.md`:

- Cenário novo `### subagentes.tarefas-do-subagente-contam-acima`
  - Título: "As tarefas que um subagente planeja contam no cabeçalho e nas linhas acima do cartão dele."
  - Dado um subagente que usa o painel e planeja tarefas, com o cartão sob a tarefa de onde foi lançado
  - Quando o painel é desenhado, com o cartão aberto, recolhido ou num cartão de grupo, e com a tarefa de
    origem ou o pedido recolhidos ou não
  - Então as tarefas dele entram no "d de n" do cabeçalho e no x/y da tarefa de origem, dos pais dela e
    do pedido; as interrompidas ficam fora do total; recolher qualquer dessas linhas não muda os números;
    o cartão em si segue fora da contagem (subagentes.fora-da-contagem)
  - `Origem: decisão do usuário, 2026-11-14 ("No cabeçalho e acima"), à pergunta "As tarefas de um
    subagente contam onde?".`
  - `Estado: coberto`
- `subagentes.fora-da-contagem`: no Então, acrescentar "; as tarefas que um subagente planeja contam
  (subagentes.tarefas-do-subagente-contam-acima)". Linha nova: `Reescrito: 2026-11-14, decisão do usuário
  ("No cabeçalho e acima"): só o cartão fica fora da contagem; as tarefas planejadas pelo subagente
  contam. O teste deste cenário não muda.`

Selos (`novo`):

    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::as tarefas que o subagente planeja contam no cabeçalho e no x/y da tarefa de origem e do pedido, com o cartão aberto ou a tarefa recolhida" --tipo novo --motivo "decisão do usuário, 2026-11-14: No cabeçalho e acima"
    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::num cartão de grupo, as tarefas de um agente contam com a linha dele fechada" --tipo novo --motivo "decisão do usuário, 2026-11-14: No cabeçalho e acima"

## 7. Documentação

`DESENVOLVIMENTO.md`: no parágrafo "Contador" e na descrição do cartão de subagente (procurar "Fora da
contagem"), a decisão de 2026-11-14 com as palavras dele. `CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Um subagente real que usa o painel (planeja tarefas): o x/y da tarefa de origem e do pedido somam as
tarefas dele, e o "d de n" não muda ao recolher a tarefa, o pedido ou o cartão.

## 10. Dependências e conflitos

- Depois do lote 12 (o que a linha recolhida leva) e do 13 (as linhas do cartão de grupo).
- Lote 15 (tarefa ◉ com subagente rodando) usa a mesma busca "os subagentes desta tarefa ou de baixo
  dela": o segundo a entrar reaproveita a do primeiro.
- Triagem A, decisão 3 ("✕ fora do x/y (Recomendado)", tarefa abandonada) e decisão 15 ("Rodada fora da
  conta"): mexem em `count` e em `total`; a soma nova usa `count`, então segue o que A decidir.
- Triagem C, decisão 34 ("Apagar os sem tarefas (Recomendado)", poda dos subagentes terminados): poda só
  os grupos sem tarefas; os com tarefas ficam, e são eles que contam aqui. Decisão 44 ("Do primeiro
  start", tempo de pai e pedido): o tempo não entra neste lote.

## 11. Bloqueio

Nenhum.
