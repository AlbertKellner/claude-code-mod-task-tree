# A tarefa pai reflete o subagente concluído

Análise de 2026-11-09, só leitura, sobre o HEAD bb2392e (via `git show`) e os arquivos sem commit da
árvore de trabalho (`hooks/agents.ts`, `regras/subagentes.md`). Clone intocado.
Pedido do usuário: "falta só corrigir as tarefas pai, quando um agente é concluido com sucesso, o pai
sempre deve refletir seu status, não ficar pendente se não tiver nada em execucao".

## Resposta curta

Hoje o subagente não mexe na tarefa de onde foi lançado: `subEnd` (`hooks/agents.ts:144`) só troca a
palavra do cartão ("concluído", "falhou", "interrompido"). A tarefa continua `open` + iniciada e, com o
turno encerrado, é desenhada ◷ (`turnos.iniciada-aguarda-no-fim`), e os pais e o pedido ◷ com ela
(`turnos.pai-e-pedido-aguardam-no-fim`). O x/y não anda porque a folha não está `done`.

**Proposta (recomendada): a tarefa fecha de fato, no fim do turno.** Quando o turno do loop principal
termina e uma folha iniciada e aberta tem embaixo só subagentes dela, todos "concluído", e nada mais em
execução (nenhum subagente rodando, nenhuma sessão filha viva, nenhuma carta na fila), o painel a
conclui sozinho, com `endedAt` no fim do último subagente. Os pais fecham pela regra de sempre
(`arvore.pai-fecha-com-os-filhos`), o x/y anda, e o cartão do subagente segue "fora da contagem": o que
conta é a folha, como sempre contou. É o mesmo precedente da carta: "na entrega o painel a conclui
sozinho" (decisão de 2026-10-30, `envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila`).

Por que no fim do turno e não na hora em que o subagente termina: o modelo costuma trabalhar depois do
hand-back (ler o relato, relatar). Fechar na hora deixaria a folha ✓ com o modelo ainda nela, e um
`done` seguinte cairia numa tarefa já fechada. No fim do turno, "não tem nada em execução" é verdade
pelas palavras dele.

Não contradiz decisão anterior: reescreve `turnos.iniciada-aguarda-no-fim` com uma exceção, e
"Fora da contagem" (2026-11-09) continua valendo para o cartão.

## Como está hoje, no código

| Peça | Onde | O que faz |
|---|---|---|
| Fim do subagente | `hooks/agents.ts:144` `subEnd` | `sub.state` = done / failed / interrupted, `end`, `calls`. Não toca `tasks` nem a âncora |
| Fim do turno do subagente | `hooks/turn.ts:134-141` | interrompe (✕) o que o subagente deixou aberto **no grupo dele** (`turnos.subagente-que-termina-interrompe`) |
| Fim do turno principal | `hooks/turn.ts:116` | grava `turnEnded`; nada fecha, nada interrompe (`turnos.pendentes-seguem-pendentes`) |
| Tom da folha iniciada | `draw/layout.ts` | aberta + iniciada: ◉ no turno, ◷ depois de `turnEnded` |
| Tom do pai | `draw/layout.ts` `resting`, `atWork` | ◷ com algo feito embaixo e nada em andamento; ◉ enquanto uma sessão filha trabalha embaixo (`sessoes.filha-trabalhando-mantem-pais-em-andamento`) |
| Contagem | `draw/layout.ts:91` `count` | só folhas de tarefa; `done` conta em d. O grupo do subagente não entra (`subagentes.fora-da-contagem`) |
| Cartão de filha | `draw/layout.ts:143` `settle` | a origem **fechada** encerra a filha parada; o inverso (filha termina → origem fecha) não existe |
| Carta | `hooks/sessions.ts` `watchSends` | a **entrega** conclui a tarefa da carta sozinha |

O caso do print, portanto, não é bug de desenho: é ausência de regra. Nada liga o fim do subagente ao
estado da tarefa de origem.

## O que a tarefa deve ser: estado derivado ou concluída de fato?

### A (recomendada): concluída de fato, no fim do turno

No fim do turno principal (`turn.ts`, onde grava `turnEnded`; e também no `subEnd` de um subagente em
segundo plano que termina **depois** do turno, com `turnEnded` já gravado):

- para cada folha `open` com `started`, no grupo do loop que terminou;
- cujo subtree tem pelo menos um grupo de subagente ancorado nela;
- todos com `sub.state === 'done'` (nenhum `running`/`background`, nenhum `failed`/`interrupted`);
- sem sessão filha viva ancorada nela (`atWork(...).live`), sem carta dela na fila (`sends` não `taken`),
  sem pergunta aberta nela (`waits`);
- → `status: 'done'`, `endedAt` = `max(sub.end)`, sem `summary` (a linha ↩ fica do `done` do modelo, se
  vier; ver abaixo).

Os pais fecham por `arvore.pai-fecha-com-os-filhos`; o pedido idem. O x/y anda. Nada muda no cartão.

Vantagens: o estado que o usuário vê é o estado gravado (um `plan` seguinte, a retomada após recarga e
o painel publicado para a mãe concordam); a mãe vê a filha com 1/1 e `settle` passa a encerrá-la
normalmente; é o mesmo mecanismo da entrega.

Custo: um `done` do modelo depois do fechamento. Hoje `done` numa folha já fechada sem filhos não gera
aviso (`tools.ts:212` só avisa quando tem subtarefas) e o `summary` precisa continuar sendo aceito:
conferir na implementação que o `summary` de um `done` sobre folha auto-fechada vira a linha ↩ (como a
carta entregue aceita o `done` seguinte).

### B: só desenho

Desenhar ✓ a folha e os pais, sem mudar `status`. O x/y teria de ser recalculado pela mesma condição
(senão fica ✓ com 0/1, que é o que o print já mostra na carta "0/1"). Dois lugares para a mesma
condição, estado publicado para a mãe diferente do desenhado, e `settle` da mãe não enxerga. Não
recomendo.

### C: fechar na hora do fim do subagente

Mesma condição da A, mas no `subEnd`, dentro do turno. Fecha a folha enquanto o modelo ainda relata o
resultado; se o modelo lança outro subagente da mesma folha, ela está fechada e o cartão novo vai à
pendente seguinte. Não recomendo; a A cobre o subagente em segundo plano que termina fora do turno.

## Casos

| Caso | Proposta A | Regra que vale |
|---|---|---|
| Folha iniciada, só subagentes concluídos, turno encerrado | ✓ de fato; pais ✓; x/y anda | nova `subagentes.pai-conclui-no-fim-do-turno`; reescreve `turnos.iniciada-aguarda-no-fim` |
| Um concluído, outro rodando | nada muda: ◉ (o pai conta como "com algo em execução") | a mesma: só com **todos** concluídos |
| Subagente falhou ou interrompido (Esc, erro, recusa) | não fecha; ◷ como hoje, cartão "falhou"/"interrompido" | palavras dele: "concluído com sucesso". Pergunta 2 |
| Folha com subtarefas abertas | não é folha: nada; o pai segue a regra dos filhos | `arvore.pai-fecha-com-os-filhos` |
| Folha com subagente concluído e carta na fila / filha viva | não fecha (algo em execução) | `envios.tarefa-aguarda…`, `sessoes.filha-trabalhando…` |
| Subagente concluído, mas o modelo deu `done` antes do fim do turno | já fechada; nada a fazer | como hoje |
| Subagente lançado da pendente (sem start, regra "Vai à pendente") | a folha não está iniciada: não fecha. Pergunta 3 | `subagentes.cartao-desde-o-lancamento` |
| Subagente em segundo plano termina depois do turno | fecha no `subEnd`, porque `turnEnded` já está gravado | a mesma regra, segundo gatilho |
| Cartão de sessão filha concluída (turno encerrado) sob folha iniciada | **não há regra hoje e não proponho**: a filha "parada" não é "concluída"; ela pode receber outro pedido. A entrega da carta já fecha a tarefa da carta. Pergunta 4 | `sessoes.filha-parada-*` |
| Dentro do cartão da filha (o caso da 3ª rodada aqui) | a filha fecha a própria folha pela A; a mãe lê 1/1 no painel publicado e a carta/ tarefa dela já estão ✓ | `subagentes.na-filha` |

Contagem e barra: a folha sempre contou (1 em n); passa de 0 a 1 em d. O cartão do subagente segue
fora do x/y e a pílula "N subagentes" não muda (ela conta rodando). Sem contradição com "Fora da
contagem".

## Catálogo

### Novo: `subagentes.pai-conclui-no-fim-do-turno` (regras/subagentes.md)

- Dado uma folha iniciada com um ou mais subagentes lançados dela, todos "concluído", e nada mais em
  execução embaixo (nenhum subagente rodando, nenhuma sessão filha viva, nenhuma carta na fila,
  nenhuma pergunta aberta)
- Quando o turno termina (ou o último subagente em segundo plano termina depois do turno)
- Então a folha fica ✓ sozinha, com o tempo parado no fim do último subagente; o pai e o pedido ✓; o
  x/y conta a folha; o cartão segue "concluído" e fora da contagem; um `done` do modelo depois disso
  só acrescenta o resumo
- Origem: decisão do usuário, 2026-11-09 ("falta só corrigir as tarefas pai, quando um agente é
  concluido com sucesso, o pai sempre deve refletir seu status, não ficar pendente se não tiver nada em
  execucao").
- Código: hooks/turn.ts, hooks/agents.ts
- Estado: coberto (com o teste)

### Novo: `subagentes.falha-nao-conclui-o-pai`

- Dado uma folha iniciada cujo subagente terminou "falhou" ou "interrompido"
- Quando o turno termina
- Então a folha fica ◷ como qualquer iniciada, nunca ✓ nem ✕ por causa dele
- Origem: a mesma decisão ("concluido com sucesso"), se a pergunta 2 confirmar.

### Novo: `subagentes.um-rodando-mantem-o-pai`

- Dado uma folha com um subagente concluído e outro rodando
- Quando o painel é desenhado
- Então a folha segue ◉ e o x/y não muda até o último terminar

### Reescrever: `turnos.iniciada-aguarda-no-fim` (regras/turnos.md)

Acrescentar ao Então: "salvo a folha cujo trabalho embaixo era só subagentes, todos concluídos
(subagentes.pai-conclui-no-fim-do-turno), que fica ✓". `Reescrito: 2026-11-09`, com as palavras acima.
Os testes atuais dessa regra não têm subagente: continuam passando sem mudança (a conferir na cópia).

### Testes novos (`tests/subagentes.test.ts`, selados `--tipo novo`)

1. start em A/1, `lancar`, `fimDoSubagente` (done), `fimDoTurno`: "Investigar" ✓, "Plano A" ✓, pedido
   ✓, 1/1; cartão "concluído".
2. idem com dois subagentes, um termina, `fimDoTurno`: ◉/◷ sem fechar; termina o segundo (segundo
   plano, depois do turno): ✓.
3. subagente termina `isAborted` (ou `reason: 'error'`), `fimDoTurno`: ◷, 0/1.
4. subagente concluído e carta na fila da mesma folha, `fimDoTurno`: ◷ até a entrega.
5. folha auto-fechada e `done` do modelo depois com `summary`: linha ↩ com o resumo, sem aviso.
6. subagente lançado da pendente (sem start), termina, `fimDoTurno`: ○ (se a pergunta 3 for "não").

Golden: o cenário `golden: subagente` não chama `fimDoTurno` e tem um subagente rodando ao lado do
concluído em cada tarefa, então o desenho não muda. Se a opção C fosse escolhida, mudaria
("ler o kit" concluído com "buscar usos de hover" rodando: não; ok também).

## Perguntas ao usuário

1. Fechar **de fato** no fim do turno (A, recomendada), ou só desenhar ✓ (B)?
2. Subagente que **falha ou é interrompido**: a folha fica ◷ como hoje (recomendado), ou ✕?
3. Subagente lançado de uma **pendente** (sem start) que termina: fecha a pendente também? Recomendo
   **não**: pendente nunca vira ✓ sem start, e o modelo ainda não começou aquela etapa.
4. **Sessão filha** que termina o turno com tudo ✓ sob uma folha iniciada da mãe: fechar a folha da mãe
   também? Recomendo **não** por enquanto: a filha parada pode receber outro pedido, e a tarefa da
   carta já fecha na entrega; a tarefa de trabalho da mãe fecha pelo `done` dela.

## `npm run impacto -- hooks/turn.ts hooks/agents.ts draw/layout.ts`

```
Arquivos do mod tocados: hooks/turn.ts, hooks/agents.ts, draw/layout.ts
Cenários afetados (83): 81 cobertos, 2 checklist (cabecalho.aviso-de-painel-grande-volta, subagentes.cartao-no-app)
Checklist do app: cabecalho.aviso-de-painel-grande-volta, subagentes.cartao-no-app
Golden: visual.desenho-principal, visual.desenho-cartao-filha, visual.desenho-envios, visual.desenho-subagente
Fora do mapa: nenhum
```

`draw/layout.ts` entra só se a condição "nada em execução embaixo" for exportada de lá (reusar
`atWork`); a mudança de comportamento fica em `turn.ts` e `agents.ts`. Golden não deve mudar (acima).

## Não verificado

- Não montei cópia no harness: `agents.ts` ainda está sem commit e mudando. A sequência acima vem da
  leitura; o teste 1 confirma na implementação.
- Validação no app: a reprodução já está no painel (a tarefa "Consultar a hora em três fontes por
  subagente (3ª rodada)" aberta nesta sessão, com o cartão concluído embaixo). Com a A, ao fim do
  próximo turno meu ela deve ficar ✓ e o cartão analise-plano na orquestradora 1/1.
