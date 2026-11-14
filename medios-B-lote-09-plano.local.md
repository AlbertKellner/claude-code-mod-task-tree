# Lote 09: fim do subagente depois do Esc fecha a tarefa como no fim normal

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão). Nenhum arquivo do mod muda: só catálogo e testes.

## 1. O que cobre

- Achado: "O fechamento pelo fim dos subagentes: os dois gatilhos têm guardas diferentes e não há guarda
  de tempo", na parte que restou (o caso do Esc; a guarda de tempo foi resolvida no PR 36).
- Decisão 21 (B), 2026-11-14: "Fecha como no fim normal". Texto da opção: "quando o último subagente
  termina, a tarefa fica ✓ (ou ✕ 'falhou'), mesmo depois do Esc." Nota da orquestradora: "coerente com a
  7: a tarefa segue ◷ enquanto o subagente roda e fecha pelo fim dele".

A resposta é o comportamento de hoje: pelas instruções, vira o texto do cenário e os testes que o fixam.

## 2. Causa confirmada na ponta

- No Esc, `hooks/turn.ts:148` pula a varredura (`settleBySubs`) e `:161-166` marca a folha iniciada como
  parada (`park`, `state/tasks.ts:73-79`: aberta, com `stopped` e o relógio parado); o desenho a lê ✕
  (`halt` e `stay`, `draw/layout.ts:57-95`).
- Quando um subagente termina com o turno já terminado, `hooks/agents.ts:161` (`subEnd`) chama
  `settleBySubs`; o mesmo em `checkSubs` (`:249`) e `strandedSends` (`:391`). A condição é só o turno ter
  terminado, não importa se com Esc.
- `settleBySubs` (`:280-307`) percorre toda folha aberta (a parada com Esc é aberta no state): com os
  subagentes dela todos terminados e nada mais em execução, fecha ✓ (`finish`, que tira a marca da
  parada) ou ✕ "falhou"/"interrompida".

Escrito no código: a tarefa que o Esc deixou ✕ fecha sozinha quando o último subagente dela termina.
`regras/subagentes.md` deixava o caso de fora de propósito ("Fora deste cenário: … o fim de um subagente
depois do Esc", em `subagentes.reaberta-nao-fecha-pelo-subagente-antigo`).

## 3. O que muda

Nada no código. O comportamento passa a estar escrito e testado:

- depois do Esc, a tarefa iniciada com um subagente em segundo plano ainda rodando não fecha enquanto ele
  roda; quando ele termina, ela fica ✓ (se concluiu), ✕ "falhou" (se falhou) ou ✕ "interrompida" (se foi
  parado), sem start e sem done;
- é uma exceção, decidida, a `turnos.parada-segue-interrompida-ate-o-start` ("só o start nela a reacende
  … e o done a conclui").

## 4. Impacto

Nenhum arquivo do mod tocado (`npm run impacto` sobre o diff: nada). Cenários de texto alterado:
`turnos.parada-segue-interrompida-ate-o-start`, `subagentes.reaberta-nao-fecha-pelo-subagente-antigo`.

## 5. Testes

Novos, em `tests/subagentes.test.ts`. Passam hoje (fixam a decisão). O estado da tarefa entre o Esc e o
fim do subagente não é afirmado como ✕: a decisão 7 da triagem A ("Segue ◉/◷ (Recomendado)") muda esse
intervalo; os testes só afirmam que ela não está concluída ali.

1. "depois do Esc, o fim do subagente em segundo plano fecha a tarefa que ele deixou: ✓ se concluiu".
   Cenário novo `subagentes.fim-depois-do-esc-fecha-a-tarefa`. Roteiro: `lancaveis(['sub-1'])`; pedido;
   plan com "Investigar" e "Outra"; start em "Investigar"; `lancar` com `segundoPlano: true`; `esc`.
   Afirma: "Investigar" não concluída; `cabecalho.feitas` 0. Depois `fimDoSubagente('sub-1')`:
   "Investigar" concluída, "Outra" pendente, `cabecalho` 1 de 2, o cartão "concluído" embaixo dela.
2. "depois do Esc, o subagente em segundo plano que falha deixa a tarefa ✕ 'falhou'". Mesmo cenário.
   Roteiro igual, com `fimDoSubagenteCom('sub-1', { erro: true })`. Afirma: "Investigar" interrompida,
   com "falhou".

Testes existentes: nenhum muda.

## 6. Catálogo e selos

`regras/subagentes.md`, cenário novo:

- `### subagentes.fim-depois-do-esc-fecha-a-tarefa`
- Título: "Depois do Esc, o fim do último subagente da tarefa a fecha como no fim normal do turno."
- Dado uma tarefa iniciada quando a pessoa para o turno (Esc), com um subagente em segundo plano lançado
  dela ainda rodando
- Quando o subagente termina, com o turno já parado
- Então a tarefa fecha sozinha como no fim normal: ✓ se ele concluiu, ✕ "falhou" se falhou, ✕
  "interrompida" se foi parado, sem start nem done; antes disso ela não fecha; o cartão segue embaixo
  dela com a palavra de estado
- `Fora deste cenário: como a tarefa é desenhada entre o Esc e o fim do subagente (triagem A: Esc com
  filha ou subagente vivo sob a tarefa); as outras tarefas paradas com Esc cujos subagentes terminaram
  antes do Esc (pergunta em aberto).`
- `Origem: decisão do usuário, 2026-11-14 ("Fecha como no fim normal"), à pergunta sobre o fim de um
  subagente em segundo plano depois do Esc; exceção a turnos.parada-segue-interrompida-ate-o-start
  ("Segue ✕ até novo start (Recomendado)", 2026-11-12) para a tarefa cujo subagente termina depois.`
- `Código: hooks/turn.ts, state/tasks.ts`
- `Estado: coberto`

Textos completados:

- `regras/turnos.md`, `turnos.parada-segue-interrompida-ate-o-start`: no fim do Então, acrescentar ";
  salvo a tarefa com um subagente em segundo plano que termina depois do Esc: o fim dele a fecha como no
  fim normal (subagentes.fim-depois-do-esc-fecha-a-tarefa)". Linha nova: `Reescrito: 2026-11-14, decisão
  do usuário ("Fecha como no fim normal"): exceção para a tarefa cujo subagente em segundo plano termina
  depois do Esc. Os testes deste cenário não mudam.`
- `regras/subagentes.md`, `subagentes.reaberta-nao-fecha-pelo-subagente-antigo`: no "Fora deste cenário",
  tirar "; o fim de um subagente depois do Esc" (passou a ter cenário). Se o lote 08 já mexeu nessa
  linha, juntar as duas mudanças; uma linha `Reescrito: 2026-11-14, texto: …` basta para as duas.
- `regras/subagentes.md`, `subagentes.pai-conclui-no-fim-do-turno`: no Quando, "(ou o último subagente em
  segundo plano termina depois do turno, mesmo parado com Esc:
  subagentes.fim-depois-do-esc-fecha-a-tarefa)". Mesma linha `Reescrito` de texto.

Selos (`novo`):

    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::depois do Esc, o fim do subagente em segundo plano fecha a tarefa que ele deixou: ✓ se concluiu" --tipo novo --motivo "decisão do usuário, 2026-11-14: Fecha como no fim normal"
    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::depois do Esc, o subagente em segundo plano que falha deixa a tarefa ✕ 'falhou'" --tipo novo --motivo "decisão do usuário, 2026-11-14: Fecha como no fim normal"

## 7. Documentação

`DESENVOLVIMENTO.md`: onde a tarefa parada com Esc é descrita (procurar "Segue ✕ até novo start"),
acrescentar a exceção com as palavras e a data. `CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Com um subagente real em segundo plano: Esc no turno; quando o subagente termina, a tarefa fica ✓ sem
ninguém agir.

## 10. Dependências e conflitos

- Depois dos lotes 07 e 08 (mesma função `settleBySubs`; este lote só a testa).
- Triagem A, decisão 7 ("Segue ◉/◷ (Recomendado)": Esc na principal com filha ou subagente vivo sob a
  tarefa): muda o que o Esc faz com essa tarefa (deixa de marcá-la parada, ou a desenha ◉/◷). Os testes
  daqui foram escritos para valer antes e depois do lote de A. Se A deixar de marcar a tarefa como
  parada, o fechamento pelo fim do subagente continua igual (a folha segue aberta no state).
- Lote 15 (tarefa ◉ com subagente rodando) também desenha essa tarefa em andamento enquanto o subagente
  roda; combinar com A quem escreve a exceção ao ✕ do Esc (o lote 15 não mexe em `halt` nem em `stay`
  para tarefa parada com Esc; isso fica com A).

## 11. Bloqueio (não bloqueia o lote)

Ponto que a resposta de 2026-11-14 não cobre com certeza e que toca a decisão de 2026-11-12 ("Segue ✕
até novo start (Recomendado)"): a mesma varredura fecha junto as outras tarefas que o Esc deixou ✕ e
cujos subagentes já tinham terminado antes do Esc. A pergunta dizia isso ("e fecha junto as outras
tarefas paradas cujos subagentes já tinham terminado"), mas a opção escolhida fala da tarefa cujo último
subagente termina depois. O plano não muda o código e deixa esse caso fora do cenário. Pergunta, se a
orquestradora quiser fechar o ponto:

> Depois de um Esc, quando um subagente em segundo plano termina, o painel fecha a tarefa dele (sua
> decisão: "Fecha como no fim normal"). Na mesma hora ele fecha ✓ também as outras tarefas que o Esc
> deixou ✕ e cujos subagentes já tinham terminado antes do Esc. Essas outras devem fechar junto?
- **Não, só a tarefa do subagente que terminou (Recomendado):** as outras seguem ✕ até um start nelas,
  como na sua decisão de 2026-11-12 ("Segue ✕ até novo start").
- **Sim, fecham junto, como hoje.**

Com "Não", a mudança é pequena e fica em `hooks/agents.ts` (`settleBySubs`: a folha parada com Esc só
fecha se algum subagente dela terminou depois da parada), com um teste e uma frase no cenário novo.
