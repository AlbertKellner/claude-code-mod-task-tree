# Lote 26: documentação e textos de cenário

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (duas correções diretas de documentação e o texto dos cenários de uma decisão "como hoje").
Nenhum código do mod muda.

## 1. O que cobre

- Achado "Fim de turno: o documento diz que a tarefa iniciada vira interrompida; o código e o catálogo a
  deixam aguardando (◷), e só o Esc interrompe". Correção direta (só documentação).
- Achado "Tarefa da mãe com `done` e filha ainda trabalhando: o documento cita uma decisão ("vale como
  concluído") oposta à do catálogo e do código (segue ◉)". Correção direta (documentação e origem do
  cenário).
- Achado "Duas regras se contradizem para a filha parada com Esc que tem pendentes: "o cabeçalho as conta"
  e "saem do cabeçalho"". Decisão 15, 2026-11-14: **"Rodada fora da conta (Recomendado)"** (como hoje). A
  opção: "A rodada inteira sai da contagem, como hoje: o cartão segue desenhado com a palavra "parada",
  mas contribui 0 de 0 para o cabeçalho e para o x/y da tarefa de origem, até a filha dar start de novo na
  tarefa parada. Os dois cenários que dizem "o cabeçalho as conta" ganham a exceção escrita."

## 2. Causa confirmada na ponta atual

Documento (`DESENVOLVIMENTO.md`; as linhas da triagem eram de `1f9e8c1`, estas são de `6d5e026`):
- linha 270, tabela de durabilidade, `turnEnded`: "o que ela deixou aberto é desenhado interrompido, sem
  relógio";
- linhas 561-579, parágrafo "Tarefas abertas de uma sessão que terminou o turno": "aparece interrompido
  (não concluído, sem fechamento)", "folha aberta e iniciada… vira interrompida", "pai sem nada aberto
  embaixo vira interrompido"; o efeito da linha 589 ("uma filha parada com tarefa em andamento passa a
  ter essa tarefa fora do total") vem da mesma regra antiga;
- linha 1307: "regra substituída: hoje o que estava em andamento aparece interrompido, sem relógio";
- o trecho novo do PR 36 (linhas 591-604, "A parada com Esc espera o `start`") convive com eles.
- linhas 383-391, "Tarefa da mãe concluída com `done` (decisão do usuário: "um done explícito da mãe deve
  valer como concluído…")": descreve a tarefa ✓ com contagem própria e o tempo parado; linhas 1317-1321
  repetem ("uma tarefa concluída com `done` fica concluída (regra substituída: antes ela era desenhada em
  andamento…)").

Código e catálogo:
- `draw/layout.ts:57-73` (`halt`) e `turnos.iniciada-aguarda-no-fim`: a iniciada fica ◷; ✕ só com Esc;
  o pai sem nada aberto embaixo fica ✓ (`arvore.pai-fecha-com-nada-aberto-embaixo`, 2026-11-04);
- `draw/layout.ts:551-556` e `sessoes.filha-trabalhando-mantem-pais-em-andamento`: a tarefa com `done` e
  filha trabalhando segue ◉, com os pais.

Histórico do repositório (conferido com `git log -S`):
- `a818dae`, 2026-10-23, "tarefa concluída com done fica concluída com sessão trabalhando embaixo": a frase
  "um done explícito da mãe deve valer como concluído";
- `8637626`, 2026-10-24, "tarefa e pais ficam em andamento enquanto a sessão filha trabalha, mesmo com
  done…": a frase "as linhas pai anteriores somente deveriam ficar como concluídas, quando as filhas
  fossem concluídas", que desfaz a anterior (está citada em `draw/layout.ts:552-553`);
- `d956e11`, a origem que o cenário cita, não existe no repositório (`git cat-file`: "Not a valid object
  name").

Catálogo, a contradição da decisão 15:
- `turnos.pendentes-seguem-pendentes`: "na principal e nas filhas… seguem ○, nunca ✕, e o cabeçalho as
  conta";
- `sessoes.filha-parada-pendentes-seguem-pendentes`: "as pendentes seguem ○ e entram no chip "pendentes";
  a iniciada aberta ◷ (✕ se o turno foi interrompido)";
- `sessoes.rodada-descartada-fora-da-contagem`, `sessoes.filha-parada-com-esc-sem-pendente` e
  `sessoes.filha-parada-com-esc-segue-descartada-ate-o-start`: a rodada da filha parada com Esc sai
  inteira da contagem. O código faz isto (`draw/layout.ts:156-161`, `497-507`).

## 3. O que muda

Só `DESENVOLVIMENTO.md`, `regras/turnos.md`, `regras/sessoes.md` e um teste novo em
`tests/sessoes.test.ts`.

1. `DESENVOLVIMENTO.md`, fim de turno: reescrever os três trechos com a regra do catálogo, ou trocá-los
   por uma frase que aponta para `regras/turnos.md`. O que o texto novo tem de dizer:
   - no fim normal do turno, a tarefa iniciada e aberta fica ◷ "Aguardando", com o relógio parado; as
     pendentes seguem ○ e contam; o pai aberto com algo feito ou aguardando embaixo fica ◷; o pai sem
     nada aberto embaixo fica ✓, com qualquer mistura de ✓ e ✕;
   - ✕ só com Esc, e até o start na tarefa; a tarefa com carta na fila fica ◷ enquanto a carta espera;
   - a sessão arquivada, o subagente que termina e o plano substituído seguem deixando ✕ o que ficou
     aberto;
   - conforme os lotes desta série que já estiverem na ponta: a espera do fim normal é gravada na tarefa
     e segue até o start (lote 07); o turno que morre por erro deixa ✕ "falhou" (lote 09); o Esc poupa a
     tarefa com trabalho delegado vivo (lote 18). Escrever só o que estiver implementado.
   - Na tabela (linha 270), `turnEnded`: "o que ela deixou em andamento é desenhado aguardando (◷), com o
     relógio parado; interrompido só se o turno foi parado (Esc)".
2. `DESENVOLVIMENTO.md`, done da mãe com filha trabalhando: reescrever os dois trechos (383-391 e
   1317-1321) com a regra de hoje: a tarefa com `done` e os pais dela seguem ◉ enquanto uma filha
   trabalha na rodada atual sob ela, e voltam a ✓ quando a filha para; o x/y soma as tarefas da filha,
   com a tarefa aberta ou concluída; dizer que a frase de 2026-10-23 foi desfeita pela de 2026-10-24,
   com os dois commits. Sobre o tempo dessa linha, escrever o que estiver na ponta (o lote 22 o muda
   para "só o próprio").
3. `regras/sessoes.md`, `sessoes.filha-trabalhando-mantem-pais-em-andamento`: a linha `Origem:` passa a
   `Origem: decisão do usuário, 2026-10-24 ("as linhas pai anteriores somente deveriam ficar como
   concluídas, quando as filhas fossem concluídas"); commit 8637626. Desfaz "um done explícito da mãe deve
   valer como concluído" (2026-10-23, commit a818dae).` Sem `Reescrito:` (a regra não mudou; só a origem
   estava errada) e sem mexer no teste.
4. Decisão 15, texto dos dois cenários (a regra não muda):
   - `turnos.pendentes-seguem-pendentes`, no "Então": "elas seguem ○, nunca ✕, e o cabeçalho as conta;
     salvo, no painel da mãe, a rodada de uma filha parada com Esc com tarefa aberta, que sai inteira da
     contagem até a filha dar start na tarefa parada (sessoes.rodada-descartada-fora-da-contagem,
     sessoes.filha-parada-com-esc-segue-descartada-ate-o-start); no painel da própria filha elas contam".
   - `sessoes.filha-parada-pendentes-seguem-pendentes`, no "Então": depois de "(✕ se o turno foi
     interrompido)" acrescentar "; com o turno interrompido (Esc), a rodada inteira sai da contagem da mãe:
     as pendentes seguem desenhadas ○, mas fora do cabeçalho, do chip e do x/y da tarefa de origem, até o
     start na tarefa parada (sessoes.rodada-descartada-fora-da-contagem)".
   - Nos dois, antes do `Estado:`: `Reescrito: 2026-11-14, decisão do usuário ("Rodada fora da conta
     (Recomendado)"); só o texto ganha a exceção que o código já fazia. Os testes não mudam.`

Comportamento no painel: nenhuma mudança.

## 4. Impacto

Nenhum arquivo do mod é tocado: `npm run impacto` responde "Arquivos do mod tocados: nenhum".

## 5. Testes

Um teste novo, para o caso que a triagem achou sem teste ("nenhum teste afirma a contagem de uma filha
parada com Esc que tem ✓, iniciada e pendentes"):

- `tests/sessoes.test.ts`, regras `sessoes.rodada-descartada-fora-da-contagem` e
  `sessoes.filha-parada-pendentes-seguem-pendentes`:
  **"a filha parada com Esc com concluídas, uma iniciada e pendentes: tudo desenhado, nada na conta da
  mãe"**. Roteiro: `fixar`; `host` com K1 publicando, no turno 1, "F1" e "F2" concluídas, "Começada"
  iniciada e "P1" e "P2" abertas; `pedido`; `plan(A3)`; `start(['1'])`; `abrirSessao`; `aviso`;
  `h.filha(K1).rodando = false`; `h.filha(K1).aborted = true`; `aviso`.
  Afirma: "F1" concluída, "Começada" interrompida, "P1" e "P2" pendentes (desenhadas); `cabecalho(p)`:
  `[feitas, total]` igual a `[0, 3]`, `chips.pendentes` 2 (só "Dois" e "Três" da mãe),
  `chips.interrompidas` 0; a linha "Um" contém "0/1"; o cartão tem "parada".
  Passa hoje: trava o que a decisão confirmou.

Atenção ao selo `decisao`/`novo`: o teste novo cita duas regras; como é teste novo (`--tipo novo`), não
exige `Reescrito:` nelas (uma delas ganha a linha de qualquer forma).

Testes existentes: nenhum muda.

## 6. Catálogo e selos

Os textos estão na seção 3 (itens 3 e 4). Selo:

```bash
npm run regras:selar -- "task-tree/tests/sessoes.test.ts::a filha parada com Esc com concluídas, uma iniciada e pendentes: tudo desenhado, nada na conta da mãe" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Rodada fora da conta (Recomendado)\"; trava a contagem que os cenários passam a dizer"
```

## 7. Documentação

É o próprio lote (seção 3, itens 1 e 2).

## 8. Golden

Não muda.

## 9. Checklist do app

Nada.

## 10. Dependências e conflitos

- Fazer por último na triagem A: o texto do documento deve descrever o que estiver implementado dos
  lotes 07, 09, 18 e 22. Se algum deles ainda não tiver entrado, escrever a regra de hoje e deixar a
  frase do lote para o commit dele.
- Triagem C: decisão 45 ("Atualizar agora" o `DESENVOLVIMENTO.md`) e a correção "tabela de durabilidade e
  documentação desatualizadas" reescrevem partes do mesmo documento, a tabela inclusive (a linha
  `turnEnded`). Quem vier depois confere se os trechos 270, 383-391, 561-579, 1307 e 1317-1321 já foram
  reescritos e completa só o que faltar. A decisão 42 ("Cenário por texto") cria cenários de textos, não
  toca nestes.
- Triagem B: decisão 30 ("Âmbar, como hoje": corrigir o texto do cenário da faixa de 2026-11-03) mexe em
  `regras/visual.md`, outro arquivo.

## 11. Bloqueio

Nenhum.
