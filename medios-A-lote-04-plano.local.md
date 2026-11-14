# Lote 04: start num pai inicia a primeira subtarefa aberta

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário).

## 1. O que cobre

- Achado "start num pai aberto acende a primeira folha sem ela ter sido iniciada, e o cabeçalho diz o
  contrário da linha".
- Decisão 2, 2026-11-14: **"Inicia a 1ª subtarefa (Recomendado)"**. A opção: "ela fica ◉ de verdade, com o
  relógio desde o start, conta no chip "em andamento" e fica ◷ no fim do turno; a subtarefa seguinte não
  acende sozinha quando a primeira fecha."

## 2. Causa confirmada na ponta atual

Escrito no código:
- `hooks/tools.ts:216-222` (`startTool`): só recusa o pai já fechado; o pai aberto vai a `begin`.
- `state/tasks.ts:120-133` (`begin`): marca só a tarefa pedida (`started`, `startedSeq`, `startedAt`); as
  subtarefas ficam sem início.
- `draw/layout.ts:683-696` (`current`): para cada tarefa com `started`, acende o caminho até ela e a
  primeira folha aberta abaixo (`firstOpen`); a folha acesa não tem `startedAt`.
- `hooks/render.tsx:288`: o chip "em andamento" conta folhas com `startedAt` sem `endedAt`: a folha
  acesa entra como pendente.
- `draw/layout.ts:57-73` (`halt`): no fim do turno só a folha iniciada vira ◷; a acesa pelo pai volta a ○.
- `state/tasks.ts:78` (`park`): no Esc, o pai iniciado perde o `started` e as folhas ficam ○.

Dedução: ao fechar a primeira folha, o pai segue com `started`, e `current` acende a folha seguinte
sozinha.

Regras que tocam: `arvore.sem-start-nada-acende` (não previu o start num pai; não muda) e
`turnos.parada-segue-interrompida-ate-o-start`, que diz "o pai iniciado diretamente e parado com Esc
também só reacende com o start nele", com teste selado (`tests/turnos.test.ts:259`).

## 3. O que muda

`hooks/tools.ts` (`startTool`), `text/rules.ts`. `state/tasks.ts` não precisa mudar.

- `startTool`: quando o id resolve para uma tarefa aberta com subtarefas, o que é iniciado é a primeira
  folha aberta abaixo dela, na ordem do plano (o último id de `firstOpen(hit.children)`, de
  `draw/layout.ts`): `begin` nessa folha, com o mesmo `seq` e `now`. O pai não recebe `started`; ele e
  os pais acima ganham `startedAt` pelo caminho, como em qualquer start de folha.
  - A resposta diz a folha: "Em andamento: <título da folha>", e um aviso em `notes`:
    `"<id pedido>" tem subtarefas: iniciei a primeira aberta, "<id da folha>" <título>`.
  - `roots` (o que entra no trabalho atual) usa o nível 1 da folha, que é o mesmo do pai.
  - O pai fechado com subtarefas segue recusado, como hoje.
  - Pai aberto sem nenhuma folha aberta abaixo (não acontece pelo `settle`): segue como hoje.
- `current`, `park` e `halt` não mudam. O ramo de `current` para tarefa com subtarefas e `started` fica
  para painéis gravados antes desta mudança.

Comportamento novo no painel:
- `start` no pai: a primeira subtarefa aberta fica ◉ com o relógio desde o start, o pai e o pedido ◉
  pelo caminho, o chip "em andamento" conta 1;
- `done` nela: a subtarefa seguinte segue ○ até o start dela;
- fim normal do turno: ela fica ◷; Esc: ela fica ✕ até o start (nela ou de novo no pai, que a retoma
  por ser a primeira aberta).

Textos ao modelo (`text/rules.ts`), texto exato:
- `TOOLS.start`: depois de "Várias podem estar em andamento; sem nenhuma marcada, nenhuma tarefa aparece
  em andamento." acrescentar "Numa tarefa aberta com subtarefas, inicia a primeira subtarefa aberta dela;
  as seguintes não acendem sozinhas: dê start em cada uma."
- `RULES`, item do replano: antes de "start só reabre tarefas sem subtarefas" acrescentar "start numa
  tarefa aberta com subtarefas inicia a primeira subtarefa aberta dela."

## 4. Impacto

`npm run impacto -- hooks/tools.ts text/rules.ts`: `hooks/tools.ts` 31 cenários (pedidos 14, arvore 9,
turnos 2, cabecalho 2…); `text/rules.ts` 16 (lembretes 11…). Checklist: nenhum. Golden: nenhum cenário
(nenhum cenário do golden dá start num pai).

## 5. Testes

Novo, `tests/arvore.test.ts`, regra `arvore.start-no-pai-inicia-a-primeira-subtarefa`:
1. **"start numa tarefa aberta com subtarefas inicia a primeira subtarefa aberta, de verdade"**.
   Roteiro: `const { relogio } = fixar(on)`; `pedido`; `plan(ARVORE)`; `relogio.advance(5000)`;
   `const r = await start($, ['1.2'])`; `relogio.advance(3000)`.
   Afirma: `r.texto` contém "Em andamento: Editar"; no painel "Editar" em andamento, "Validar" pendente,
   "Corrigir" e "Pedido" em andamento; `cabecalho(p).chips.andamento` é 1; a linha "Editar" contém
   "0:03". Depois `done($, ['1.2.1'])`: "Validar" segue pendente. Depois `start($, ['1.2'])` (a
   primeira aberta agora é "Validar") e `fimDoTurno`: "Validar" aguardando.
   Falha hoje: a resposta diz "Em andamento: Corrigir"; o chip "em andamento" é 0; a linha "Editar"
   mostra 0:08 (o relógio conta desde o plano); depois do done, "Validar" acende sozinha; no fim do
   turno ela volta a pendente.

Teste existente que muda (decisão registrada), `tests/turnos.test.ts:259`, **mantendo o nome**:
- "o pai iniciado e parado com Esc não reacende no prompt seguinte; o start nele o reacende". Hoje,
  depois do Esc e do aviso, afirma "Dois", "Dois.um" e "Dois.dois" pendentes. Com a decisão, o start em
  "Dois" inicia "Dois.um" de verdade, e o Esc a deixa ✕. O corpo passa a afirmar, nesse ponto: "Dois.um"
  interrompida, "Dois.dois" pendente, "Dois" pendente, e nada aceso (`semNadaAceso`). O resto fica: depois
  de `pedido($, 'segue')` e `start(['1'])`, "Um" em andamento e "Dois" pendente (acrescentar: "Dois.um"
  segue interrompida); depois de `start(['2'])`, "Dois" e "Dois.um" em andamento. As asserções não
  diminuem (hoje são 8 `esperarEstado` e um `semNadaAceso`).

Nenhum outro teste dá start num pai (conferido por `grep` dos `start(` contra os planos de cada teste).

## 6. Catálogo e selos

`regras/arvore.md`, cenário novo:

```markdown
### arvore.start-no-pai-inicia-a-primeira-subtarefa
start numa tarefa aberta com subtarefas inicia a primeira subtarefa aberta dela.

- Dado um pai aberto com subtarefas abertas
- Quando o modelo chama start no pai
- Então a primeira subtarefa aberta, na ordem do plano, fica ◉ de verdade: o relógio conta desde o start, ela entra no chip "em andamento", fica ◷ no fim do turno e ✕ no Esc; o pai e o pedido ficam ◉ pelo caminho; a resposta do start diz qual foi iniciada; quando ela fecha, a seguinte segue ○ até o start dela; o pai fechado com subtarefas segue recusado (arvore.start-recusa-pai-concluido)

Origem: decisão do usuário, 2026-11-14 ("Inicia a 1ª subtarefa (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (a folha acendia sem início: relógio desde o plano, fora do chip, ○ no fim do turno).
Código: draw/layout.ts, text/rules.ts
Estado: coberto
```

`regras/turnos.md`, `turnos.parada-segue-interrompida-ate-o-start`: no "Então", trocar "o pai iniciado
diretamente e parado com Esc também só reacende com o start nele" por "o start num pai inicia a
primeira subtarefa aberta dele (arvore.start-no-pai-inicia-a-primeira-subtarefa): parada com Esc, ela
segue ✕ como qualquer outra, e o start de novo no pai a retoma", e acrescentar antes do `Estado:`:
`Reescrito: 2026-11-14, decisão do usuário ("Inicia a 1ª subtarefa (Recomendado)"); desfaz "o pai iniciado diretamente": o start num pai passa a iniciar a primeira subtarefa aberta, que o Esc deixa ✕.`

Selos:

```bash
npm run regras:selar -- "task-tree/tests/turnos.test.ts::o pai iniciado e parado com Esc não reacende no prompt seguinte; o start nele o reacende" --tipo decisao --motivo "decisão do usuário, 2026-11-14: \"Inicia a 1ª subtarefa (Recomendado)\"; a subtarefa iniciada pelo start no pai fica ✕ no Esc"
npm run regras:selar -- "task-tree/tests/arvore.test.ts::start numa tarefa aberta com subtarefas inicia a primeira subtarefa aberta, de verdade" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Inicia a 1ª subtarefa (Recomendado)\""
```

Atenção: o selo `decisao` exige `Reescrito:` com data igual ou posterior à do selo anterior em cada regra
que o teste cita; esse teste cita só `turnos.parada-segue-interrompida-ate-o-start`.

## 7. Documentação

`DESENVOLVIMENTO.md`: na linha do `startTool` em "Os 14 hooks" e no trecho "A parada com Esc espera o
`start`" (~591-604, que cita "o `started` de um pai iniciado diretamente é desfeito"), dizer que o start
num pai inicia a primeira folha aberta e que o ramo do pai iniciado só serve a painéis antigos; entrada
em "Decisões (histórico)".

## 8. Golden

Não muda.

## 9. Checklist do app

Nada novo (o relógio da subtarefa e o chip são lidos pelo harness).

## 10. Dependências e conflitos

- Depois dos lotes 02 e 03 (mesmo arquivo, função diferente).
- Lote 07 (◷ até o start na mensagem seguinte) depende de toda tarefa em andamento ter início próprio:
  este lote tira o último caso de folha acesa sem início. Fazer este antes.
- Triagem C: a correção "refazer um pai concluído: três textos diferentes, a recusa do start não diz
  "ids novos"…" mexe na recusa do `startTool` e nas mesmas frases de `TOOLS.start` e `RULES`. Quem vier
  depois mantém a frase nova deste lote.
- Triagem B, decisão 24 ("◉ como a filha" para tarefa sem start com subagente rodando): é do desenho
  (`draw/layout.ts`), sem conflito aqui.

## 11. Bloqueio

Nenhum.
