# Lote 16: faixa "em andamento" enquanto o turno roda

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão).

## 1. O que cobre

- Achado: "Faixa e chips do cabeçalho divergem do que a árvore mostra: 'aguardando' com linha ◉", a
  primeira pergunta.
- Decisão 29 (B), 2026-11-14: "'Em andamento' (Recomendado)". Texto da opção: "Âmbar 'em andamento'
  enquanto o turno roda: a faixa e o estado geral dizem 'em andamento' durante o turno; o chip 'em
  andamento' não muda (segue contando só as folhas iniciadas)." A pergunta: "No meio de um turno, entre o
  done de uma tarefa e o start da seguinte, o pedido segue ◉ na árvore, mas a faixa do cabeçalho passa a
  âmbar claro 'aguardando' e volta a âmbar no start: ela alterna a cada tarefa."

## 2. Causa confirmada na ponta

- `draw/svg.ts:221-229` (`headerState`): "em andamento" só com `active > 0`; sem isso, com algo esperando
  é "aguardando", com sessão viva "sessão ativa", e o caso que sobra (tarefas pendentes, nada correndo)
  cai em "aguardando" (`:228`).
- `hooks/render.tsx:287-296`: `active` são as folhas abertas com o relógio correndo entre as desenhadas.
  Entre um done e o start seguinte não há nenhuma: o estado cai em "aguardando" e volta no start.
- A árvore, no mesmo intervalo, mostra o pai e o pedido ◉ pelo caminho da última iniciada no turno
  (`trail`, `draw/layout.ts:655-664`).

Escrito no código. A decisão registrada em `visual.faixa-de-estado-geral` (2026-11-03): "Âmbar claro,
'aguardando'" para "só tarefas pendentes, nada iniciado". O teste selado
(`tests/visual.test.ts:11-27`) afirma esse "aguardando" logo depois do plan, com o turno em curso e
nenhum start.

## 3. O que muda

Leitura do planejador, para a resposta de 2026-11-14 não desfazer a de 2026-11-03: "enquanto o turno
roda" vale a partir do primeiro start do pedido. Antes de qualquer start ("só pendentes, nada iniciado")
a faixa segue âmbar claro, como o teste selado afirma.

- `draw/svg.ts`, `headerState`: um dado novo de entrada, "o turno está em curso e alguma tarefa desta
  sessão já foi iniciada no pedido atual". Com ele verdadeiro e tarefas pendentes, o estado é "em
  andamento" (âmbar). A ordem: tarefa em andamento; algo esperando a pessoa ("aguardando"); o caso novo;
  sessão ativa; concluído; interrompido; nenhuma tarefa; "aguardando".
- `hooks/render.tsx`: calcula o dado com o que já lê: o turno em curso (o fim do turno não é número,
  `:236`); a tarefa iniciada por último do grupo principal (`startedLast`, já importada) iniciada no
  pedido atual ou depois (`lastTurnAt` dos grupos, de `draw/layout.ts`). Passa a `headerState`.
- O chip "em andamento", os outros chips e os números não mudam. O texto alternativo ("estado geral: em
  andamento") acompanha a faixa.

No painel: no meio do turno, depois do done de uma tarefa e antes do start da seguinte, a faixa segue
âmbar "em andamento" (o chip "em andamento" some nesse intervalo, como hoje). Logo depois do plan, sem
nenhum start, segue âmbar claro. Com o turno terminado, nada muda. Com a pessoa sendo esperada (pergunta
aberta sem tarefa correndo), segue "aguardando".

## 4. Impacto

`npm run impacto -- task-tree/draw/svg.ts task-tree/hooks/render.tsx`: todos os cenários (núcleo).
Golden pelo mapa: os quatro. Nos quatro, ou o turno terminou (`principal`, `envios`) ou há tarefa
correndo (`filha`, `subagente`): a faixa não muda.

## 5. Testes

Novo, em `tests/visual.test.ts` (o ajudante `faixa` do arquivo):

1. "a faixa segue em andamento entre o done de uma tarefa e o start da seguinte, com o turno em curso".
   Cenário `visual.faixa-de-estado-geral`. Roteiro: pedido; plan com dois níveis 1 sem subtarefas, "Um"
   e "Dois" (o caso em que nem o pedido fica ◉ no intervalo); afirma "aguardando" (nada iniciado); start
   em "Um": "em andamento"; done em "Um": "em andamento", e o cabeçalho sem a pílula "N em andamento";
   start em "Dois": "em andamento"; fim do turno: "aguardando". Falha hoje depois do done ("aguardando").

Testes existentes: os dois de `visual.faixa-de-estado-geral` (`:11-47`) não mudam: o primeiro afirma
"aguardando" antes de qualquer start; o segundo, "sessão ativa" com tudo desta sessão concluído.

## 6. Catálogo e selos

`regras/visual.md`, `visual.faixa-de-estado-geral`: no Então, trocar "a faixa é âmbar com tarefa em
andamento" por "a faixa é âmbar com tarefa em andamento e também, com o turno em curso, enquanto há
tarefas pendentes e alguma já foi iniciada no pedido (entre um done e o start seguinte)". Linha nova:
`Reescrito: 2026-11-14, decisão do usuário ("\"Em andamento\" (Recomendado)"): com o turno em curso, a
faixa não volta a âmbar claro entre um done e o start seguinte; "só pendentes, nada iniciado" segue âmbar
claro (2026-11-03). Os testes existentes deste cenário não mudam.`

Selo:

    npm run regras:selar -- "task-tree/tests/visual.test.ts::a faixa segue em andamento entre o done de uma tarefa e o start da seguinte, com o turno em curso" --tipo novo --motivo "decisão do usuário, 2026-11-14: Em andamento (Recomendado)"

## 7. Documentação

`DESENVOLVIMENTO.md`: no item "Cabeçalho V4" (procurar `headerState` ou "estado geral"), a decisão com
as palavras e a data. O comentário de `headerState` em `draw/svg.ts:215-219`: acrescentar o caso.
`CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Num turno real com várias tarefas: a faixa do cabeçalho não pisca para âmbar claro entre o done de uma
e o start da seguinte.

## 10. Dependências e conflitos

- Depois do lote 12 (os números que `headerState` recebe). O lote 17 reescreve outra frase do mesmo
  cenário (`visual.faixa-de-estado-geral`): vem depois deste.
- Lote 15: a tarefa ◉ por subagente não entra em `active`; com o turno terminado e só um subagente em
  segundo plano rodando, a faixa segue como hoje ("aguardando"). Não há decisão sobre isso.
- Triagem A, decisão 5 ("Seguir ◷ até o start (Recomendado)", tarefa ◷ depois do fim normal, na mensagem
  seguinte): muda o que fica ◉ ou ◷ no começo do turno seguinte, e portanto `active`; a regra nova daqui
  lê "iniciada no pedido atual", que não muda com A.
- Triagem C, decisão 43 ("Ampliar o golden"): um cenário de golden no meio do turno, depois de um done,
  nasce com a faixa âmbar se este lote vier antes.

## 11. Bloqueio (não bloqueia o lote)

A opção escolhida diz "enquanto o turno roda", sem exceção; a decisão de 2026-11-03 diz âmbar claro para
"só tarefas pendentes, nada iniciado", e o teste selado afirma isso com o turno em curso. O plano mantém
as duas (a faixa fica âmbar a partir do primeiro start do pedido). Se a orquestradora quiser fechar o
ponto:

> Logo depois do plan, com o turno em curso e nenhuma tarefa iniciada ainda, a faixa do cabeçalho hoje
> fica âmbar claro "aguardando" (sua decisão de 2026-11-03). Com a decisão de hoje ("em andamento
> enquanto o turno roda"), esse momento também deve ser âmbar "em andamento"?
- **Não, só depois do primeiro start (Recomendado):** antes de qualquer start segue âmbar claro.
- **Sim, o turno em curso inteiro:** desfaz "Âmbar claro, 'aguardando'" para o turno em curso; o âmbar
  claro fica para o turno terminado.
