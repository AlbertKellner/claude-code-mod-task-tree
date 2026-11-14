# Lote 15: a tarefa com subagente rodando aparece em andamento

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão).

## 1. O que cobre

- Achado: "Tarefa pendente com trabalho pendurado: sessão viva acende a tarefa, carta na fila acende só
  os pais, subagente rodando não acende nada".
- Decisão 24 (B), 2026-11-14: "Sim, ◉ como a filha (Recomendado)". Texto da opção: "a tarefa, o pai e o
  pedido ficam ◉ enquanto o subagente roda; a tarefa iniciada com subagente em segundo plano segue ◉
  depois do fim do turno, em vez de ◷. É uma exceção a 'sem start, nada aceso' (2026-10-23), como a da
  filha."

## 2. Causa confirmada na ponta

`draw/layout.ts`:

- O tom da tarefa (`rows`, `:1100-1117`): em andamento quando uma sessão trabalha na rodada dela ali
  (`w.busy`, de `atWork`), quando uma tarefa de baixo espera uma sessão (`waitsBelow`), ou quando está
  acesa por start (`lit`, `trailIds`). Nenhum termo olha subagente vivo.
- O tom do pedido (`turnRows`, `:1183-1190`): os mesmos termos.
- Fim do turno: `halt` (`:57-73`) deixa a iniciada aberta com o relógio parado, e a linha sai ◷
  (`leftWaiting`), com subagente em segundo plano rodando ou não.
- O relógio de 1 s (`hooks/sessions.ts:296-309`, `anyRunning`): com o turno terminado, só liga com carta
  na fila ou sessão viva; um subagente em segundo plano não o mantém.

No painel: o modelo lança um subagente de uma tarefa sem start; a tarefa, o pai e o pedido seguem ○ com
o cartão "trabalhando" embaixo, e no fim do turno a tarefa pula de ○ para ✓. Escrito no código.

## 3. O que muda

`draw/layout.ts`:

- Termo novo no desenho: "há um subagente vivo lançado desta tarefa ou de uma tarefa aberta de baixo
  dela" (pelo loop dono do grupo; conta também o subagente já terminado que lançou outro ainda vivo).
- `rows`: a tarefa aberta (pendente, iniciada, ou deixada esperando pelo fim do turno) com esse termo
  verdadeiro sai em andamento (◉). A ordem dos casos: interrompida segue ✕; sessão viva ou espera de
  sessão embaixo segue como hoje; concluída segue ✓ (a tarefa fechada com done e o subagente ainda em
  segundo plano não muda: `subagentes.cartao-fica-com-a-origem-fechada` diz "o cartão segue sob a tarefa
  ✓"); o pai sem nada aberto embaixo segue ✓; depois entra o termo novo, antes de "aguardando" e de
  "pendente".
- `turnRows`: o pedido sai em andamento quando alguma tarefa aberta dele tem o termo verdadeiro.
- O tempo da linha: com o termo verdadeiro, o relógio corre como corre com a sessão filha (o mesmo
  argumento `busy` de `timeSpan`): a partir do start da tarefa; sem start, a regra que já vale para a
  linha em andamento sem start (desde o plan).
- Vale em qualquer grupo (a tarefa de um subagente que lançou outro) e dentro do cartão de uma filha
  (o painel publicado dela traz os subagentes).

`hooks/sessions.ts`, `anyRunning`: um subagente vivo em qualquer grupo mantém o relógio de 1 s ligado,
com o turno terminado ou não (a conferência dos subagentes sem fim, `checkSubs`, encerra o cartão órfão,
então o relógio não fica ligado para sempre).

O que não muda, de propósito:

- os chips: a tarefa ◉ por subagente não entra em "em andamento" (que segue contando as folhas iniciadas
  com o relógio do turno); os subagentes seguem na pílula "N subagentes", como a filha segue em "sessões
  ativas";
- a tarefa que o Esc deixou ✕ com um subagente vivo embaixo: segue ✕ aqui (a decisão 7 da triagem A,
  "Segue ◉/◷", trata desse caso);
- o fechamento automático (lotes 07 a 09).

No painel: lançado de uma tarefa sem start, o subagente rodando deixa a tarefa, o pai e o pedido ◉;
quando ele termina dentro do turno, a tarefa volta a ○ até o fim do turno (quando fecha ✓ pela regra de
sempre). A tarefa iniciada com subagente em segundo plano segue ◉, com o tempo correndo, depois do fim
do turno, e fecha quando ele termina.

## 4. Impacto

`npm run impacto -- task-tree/draw/layout.ts task-tree/hooks/sessions.ts`: os 110 cenários de
`draw/layout.ts` (os de sessões já estão neles). Golden pelo mapa: os quatro. No cenário `subagente` as
duas tarefas com subagentes foram iniciadas e o turno está em curso: já saem ◉; o desenho não muda. Se
mudar, é erro da implementação.

## 5. Testes

Novos, em `tests/subagentes.test.ts`:

1. "lançado de uma tarefa sem start, o subagente rodando deixa a tarefa, o pai e o pedido em andamento".
   Cenário novo `subagentes.tarefa-em-andamento-com-subagente-rodando`. Roteiro: `lancaveis(['sub-1'])`;
   pedido; plan com o nível 1 "Plano A" e as folhas "Investigar" e "Outra"; `lancar` sem start. Afirma:
   "Investigar", "Plano A" e a linha do pedido em andamento; "Outra" pendente. Depois
   `fimDoSubagente('sub-1')`: "Investigar" pendente de novo (o turno segue, sem start). Depois o fim do
   turno: "Investigar" concluída. Falha hoje na primeira leitura (as três pendentes).
2. "a tarefa iniciada com subagente em segundo plano segue em andamento depois do fim do turno". Mesmo
   cenário e `turnos.iniciada-aguarda-no-fim`. Roteiro: start em "Investigar"; `lancar` com
   `segundoPlano: true`; fim do turno. Afirma: "Investigar", o pai e o pedido em andamento. Depois
   `fimDoSubagente('sub-1')`: "Investigar" concluída. Falha hoje: "Investigar" aguardando (◷).

Testes existentes: o de `:351-369` (tarefa fechada com done e o subagente em segundo plano) afirma a
tarefa concluída e não muda. Se a `regressao` acusar um teste que afirmava ○ ou ◷ para uma tarefa aberta
com subagente rodando, ele muda por esta decisão: o cenário dele ganha `Reescrito: 2026-11-14, decisão do
usuário ("Sim, ◉ como a filha (Recomendado)"): a tarefa aberta com subagente rodando aparece em
andamento.` e o teste é selado `--tipo decisao --motivo "decisão do usuário, 2026-11-14: Sim, ◉ como a
filha (Recomendado)"`. Nenhum outro pode mudar.

## 6. Catálogo e selos

- `regras/subagentes.md`, cenário novo `### subagentes.tarefa-em-andamento-com-subagente-rodando`
  - Título: "Enquanto um subagente lançado dela roda, a tarefa aberta aparece em andamento."
  - Dado uma tarefa aberta, com ou sem start, com um subagente lançado dela rodando ("trabalhando" ou
    "em segundo plano")
  - Quando o painel é desenhado, com o turno em curso ou terminado
  - Então a tarefa, os pais e o pedido aparecem ◉, com o tempo correndo; a iniciada não fica ◷ no fim do
    turno enquanto ele roda; quando ele termina, vale a regra de sempre (dentro do turno, a tarefa volta
    ao que era; com o turno terminado, fecha pelo fim dele); a tarefa já concluída segue ✓ com o cartão
    embaixo; os chips não mudam: o subagente conta na pílula "N subagentes"
  - `Origem: decisão do usuário, 2026-11-14 ("Sim, ◉ como a filha (Recomendado)"); exceção a
    arvore.sem-start-nada-acende ("sem start, nada aceso", 2026-10-23), como a da sessão filha.`
  - `Código: hooks/sessions.ts`
  - `Estado: coberto`
- `regras/arvore.md`, `arvore.sem-start-nada-acende`: no Então, acrescentar "; salvo a tarefa com sessão
  filha trabalhando (sessoes.filha-trabalhando-mantem-pais-em-andamento) ou com subagente rodando
  (subagentes.tarefa-em-andamento-com-subagente-rodando)". Linha nova: `Reescrito: 2026-11-14, decisão do
  usuário ("Sim, ◉ como a filha (Recomendado)"): exceção para a tarefa com subagente rodando. O teste
  deste cenário não muda.`
- `regras/turnos.md`, `turnos.iniciada-aguarda-no-fim`: no Então, acrescentar "; com um subagente em
  segundo plano lançado dela ainda rodando, segue ◉ até ele terminar
  (subagentes.tarefa-em-andamento-com-subagente-rodando)". Mesma linha `Reescrito` de decisão, com "Os
  testes deste cenário não mudam."

Selos (`novo`):

    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::lançado de uma tarefa sem start, o subagente rodando deixa a tarefa, o pai e o pedido em andamento" --tipo novo --motivo "decisão do usuário, 2026-11-14: Sim, ◉ como a filha (Recomendado)"
    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::a tarefa iniciada com subagente em segundo plano segue em andamento depois do fim do turno" --tipo novo --motivo "decisão do usuário, 2026-11-14: Sim, ◉ como a filha (Recomendado)"

## 7. Documentação

`DESENVOLVIMENTO.md`: na entrada "Sem start, nada aceso" e na descrição do cartão de subagente, a
exceção com as palavras e a data. `CLAUDE.md`: nada.

## 8. Golden

Não deve mudar (seção 4).

## 9. Checklist do app

Subagente real em segundo plano: a tarefa segue ◉ e o tempo dela corre a cada segundo depois do fim do
turno; quando ele termina, o relógio para e a tarefa fecha.

## 10. Dependências e conflitos

- Depois do lote 07 (a noção de "em execução na tarefa") e do lote 14 (a busca dos subagentes de uma
  tarefa). Antes dos lotes 16 e 18/19 (faixa e tempo), que leem o que está em andamento.
- Triagem A, decisão 7 ("Segue ◉/◷ (Recomendado)", Esc na principal com filha ou subagente vivo sob a
  tarefa): o mesmo termo "subagente vivo sob a tarefa" serve para A decidir o que o Esc faz; este lote o
  exporta de `draw/layout.ts`. A decisão 17 ("Só o próprio", o relógio da linha não corre enquanto a
  filha trabalha) mexe no tempo da linha com filha embaixo: se A tirar o relógio da linha ◉ por filha,
  o da linha ◉ por subagente deve seguir a mesma escolha ("como a filha"); o implementador do lote que
  vier depois alinha os dois e relata.
- Triagem C, decisão 44 ("Do primeiro start", tempo de pai e pedido): mesma área de `rows` e `turnRows`.

## 11. Bloqueio (não bloqueia o lote)

Ponto de leitura: "◉ como a filha" poderia incluir a tarefa já concluída com done (com a filha
trabalhando embaixo, a tarefa concluída segue ◉). O plano não inclui: o cenário coberto
`subagentes.cartao-fica-com-a-origem-fechada` (2026-11-10) diz "o cartão segue sob a tarefa ✓" com o
subagente "em segundo plano", o teste selado afirma ✓, e a pergunta respondida falava da tarefa sem
start e da iniciada. Se o usuário quiser a concluída ◉ também, é pergunta nova:

> Uma tarefa já concluída com done, com um subagente dela ainda em segundo plano, hoje fica ✓ com o
> cartão "em segundo plano" embaixo. Com a sessão filha, a tarefa concluída segue ◉ enquanto a filha
> trabalha. O subagente deve fazer o mesmo?
- **Não, segue ✓ (Recomendado):** como está registrado para o cartão do subagente.
- **Sim, ◉ até ele terminar.**
