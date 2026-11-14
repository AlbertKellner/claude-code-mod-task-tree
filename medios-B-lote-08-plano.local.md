# Lote 08: relançar depois de falha, vale a última tentativa

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão).

## 1. O que cobre

- Achado: "Relançar um subagente depois de uma falha deixa a tarefa ✕ 'falhou', mesmo com a nova
  tentativa concluída".
- Decisão 22 (B), 2026-11-14: "✓, vale a última (Recomendado)". Texto da opção: "quando um subagente é
  lançado depois do fim de outro da mesma tarefa, conta o fim do último; lançados juntos, continua
  valendo o pior. O cartão do que falhou segue 'falhou' embaixo da tarefa."

## 2. Causa confirmada na ponta

`hooks/agents.ts:283-286` (`settleBySubs`): `mine` são os subagentes da folha (os de `ofLeaf`), e o fim
da tarefa é "falhou" se qualquer um falhou, senão "interrompida" se qualquer um foi interrompido, senão
concluída, sem olhar a ordem no tempo. Escrito no código. A regra coberta
`subagentes.pai-reflete-falha-ou-interrupcao` diz "com fins mistos vale o pior …, derivado das respostas
acima"; o teste selado do misto (`tests/subagentes.test.ts:257-282`) lança `m1` e `m2` juntos, antes de
qualquer fim.

## 3. O que muda

`hooks/agents.ts`, `settleBySubs`, só o cálculo do fim da folha:

- Um subagente da folha deixa de contar quando outro da mesma folha foi lançado depois do fim dele (o
  lançamento do outro é posterior ao `end` dele: comparação estrita de tempo, para que dois lançados e
  terminados no mesmo instante não se anulem).
- Entre os que restam (a última tentativa, e os que rodaram junto com ela), vale o pior, como hoje:
  falhou, depois interrompido, depois concluído.
- O instante do fechamento e o início dados à tarefa seguem saindo de todos os subagentes da folha, como
  hoje. As guardas de `ofLeaf` (tarefa reaberta, lançado antes da tarefa) não mudam.

No painel: o subagente falha, o modelo lança outro da mesma tarefa e ele conclui; no fim do turno a
tarefa fica ✓ e entra no x/y; o cartão do primeiro segue "falhou" embaixo dela. Um `done` do modelo
depois disso não é mais recusado com "foi interrompida". Lançados juntos, um falha e outro conclui:
segue ✕ "falhou". A nova tentativa que também falha: ✕ "falhou"; a que é parada: ✕ "interrompida".

## 4. Impacto

`npm run impacto -- task-tree/hooks/agents.ts`: 30 cenários (subagentes, taxa, os dois de envio a
subagente). Checklist: `envios.subagente-no-app` e os quatro de subagentes no app. Golden: nenhum cenário.

## 5. Testes

Novos, em `tests/subagentes.test.ts` (o relógio anda entre o fim do primeiro e o lançamento do segundo):

1. "o subagente falha e outro, lançado depois da mesma tarefa, conclui: a tarefa fica ✓ e o cartão do
   primeiro segue 'falhou'". Cenário `subagentes.pai-reflete-falha-ou-interrupcao`. Roteiro: `fixar`
   com `relogio`; `lancaveis(['f1', 'r1'])`; pedido; plan com "Investigar"; start; `lancar` (descrição
   "primeira"); `fimDoSubagenteCom('f1', { erro: true })`; `relogio.advance(1000)`; `lancar` (descrição
   "segunda"); `fimDoSubagente('r1')`; fim do turno. Afirma: "Investigar" concluída; `cabecalho` 1 de 1;
   a linha "Explore: primeira" contém "falhou"; `done(['1'], 'resumo')` responde sem erro e sem "foi
   interrompida". Falha hoje: a tarefa fica ✕ "falhou".
2. "a nova tentativa decide também quando termina mal: parada, a tarefa fica ✕ 'interrompida'". Mesmo
   cenário. Roteiro: igual, com `fimDoSubagenteCom('r1', { parado: true })`. Afirma: "Investigar"
   interrompida, com a palavra "interrompida" e sem "falhou". Falha hoje: "falhou" (vale o pior de
   todos).

Testes existentes: nenhum muda. O do misto (`:257-282`) lança os dois antes de qualquer fim: nenhum foi
lançado depois do fim do outro, e segue valendo o pior ("falhou").

## 6. Catálogo e selos

`regras/subagentes.md`:

- `subagentes.pai-reflete-falha-ou-interrupcao`, Então reescrito: "a tarefa fica ✕, com 'falhou' se um
  falhou, senão 'interrompida'; entre subagentes que rodaram juntos vale o pior (falhou, depois
  interrompido, depois concluído); quando um subagente é lançado depois do fim de outro da mesma tarefa
  (uma nova tentativa), conta o fim do último, e os que terminaram antes desse lançamento não contam: a
  nova tentativa concluída deixa a tarefa ✓, com o cartão do que falhou ainda 'falhou' embaixo dela".
  Linha nova: `Reescrito: 2026-11-14, decisão do usuário ("✓, vale a última (Recomendado)"); desfaz, para
  a nova tentativa lançada depois do fim da anterior, "com fins mistos vale o pior" (derivado das
  respostas de 2026-11-09). O teste do misto lançado junto não muda.`
- `subagentes.reaberta-nao-fecha-pelo-subagente-antigo`: no "Fora deste cenário", trocar "um subagente
  que falha e outro que conclui, na mesma abertura da tarefa (segue valendo o pior)" por "um subagente
  que falha e outro que conclui, na mesma abertura da tarefa (lançados juntos, vale o pior; lançado
  depois do fim do outro, vale o último: subagentes.pai-reflete-falha-ou-interrupcao)". Linha nova:
  `Reescrito: 2026-11-14, texto: remete à decisão "✓, vale a última (Recomendado)"; os testes deste
  cenário não mudam.`

Selos (`novo`):

    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::o subagente falha e outro, lançado depois da mesma tarefa, conclui: a tarefa fica ✓ e o cartão do primeiro segue 'falhou'" --tipo novo --motivo "decisão do usuário, 2026-11-14: ✓, vale a última (Recomendado)"
    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::a nova tentativa decide também quando termina mal: parada, a tarefa fica ✕ 'interrompida'" --tipo novo --motivo "decisão do usuário, 2026-11-14: ✓, vale a última (Recomendado)"

## 7. Documentação

`DESENVOLVIMENTO.md`: onde `settleBySubs` é descrito (procurar "o pior fim" ou `settleBySubs`),
acrescentar a regra da última tentativa com as palavras e a data. O comentário acima de `ofLeaf`
(`hooks/agents.ts:252-263`): a frase "the worse end decides" ganha a exceção. `CLAUDE.md`: nada.

## 8. Golden

Não muda (no cenário `subagente` nenhuma tarefa fecha pelos subagentes).

## 9. Checklist do app

Com subagentes reais: um que falha (erro de API ou recusa), outro lançado em seguida da mesma tarefa que
conclui; no fim do turno a tarefa fica ✓ com o cartão "falhou" embaixo.

## 10. Dependências e conflitos

- Depois do lote 07 (mesma função; o lote 07 troca a condição `busy`, este troca o cálculo do fim).
- Lote 09 (fim do subagente depois do Esc) só escreve cenário e teste sobre a mesma função.
- Lote 24 (subagente retomado): um subagente retomado volta a rodar com o mesmo cartão; o `end` dele some
  enquanto roda, então ele não "termina antes" de ninguém. Sem conflito.
- Triagem A, decisão 8 ("✕ 'falhou' (Recomendado)", turno que morre por erro de API ou limite de
  contexto): usa a marca `failed` da tarefa; não toca este cálculo.
- Triagem C, decisão 34 ("Apagar os sem tarefas", poda dos subagentes terminados no estado): se a poda
  apagar o cartão do subagente que falhou antes do fim do turno, ele deixa de contar de qualquer jeito;
  com a regra da última tentativa o resultado é o mesmo. C deve podar só depois de o fim ter sido
  refletido na tarefa (o `ofLeaf` e este cálculo leem os cartões).

## 11. Bloqueio

Nenhum.
