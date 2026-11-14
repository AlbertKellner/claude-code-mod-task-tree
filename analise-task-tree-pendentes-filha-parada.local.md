# Pendentes de uma sessão filha que terminou o turno viram "interrompida"

Caso: a análise fechou o turno com 2 folhas nunca iniciadas; o painel da principal mostrou ○
pendentes, pai 3/5 com relógio parado, chip "2 pendentes", cartão "parada". Decisão do usuário:
"reaproveitar o interrompida".

## Decisões do usuário
- **Filha** que terminou o turno: as pendentes (○ nunca iniciadas) viram ✕ interrompida, como as
  que estavam em andamento (volta parcial de 16062cc/55a2dd1, só para filhas).
- **Principal**: as pendentes viram ✕ **só se nada está em andamento** no pedido (nenhuma tarefa
  iniciada aberta e nenhum ✉ pendente); se há algo em andamento ou ✉, seguem pendentes.
- **Contagem**: interrompida **fora do total** (3/5 → 3/3), como hoje; o chip "N interrompidas"
  diz quantas foram.
- Exceção do ✉ (b897cac) continua: folha com envio pendente nunca é interrompida.
- Se a sessão retoma e dá start/done nessas tarefas, elas saem de interrompida (é só o desenho).

## Onde está
- `draw/layout.ts:43–53` `halt(at, sent)`: no fim do turno, folha **iniciada** e aberta →
  `interrupt`; folha pendente → fica; pai aberto sem relógio. É desenho, não estado.
- Usos: `panelOf` (linha ~100–104): cartão de filha **não viva nem recém-aberta** (`!live &&
  !starting`) → `halt(undefined)`; arquivada → `interrupt`. `layout` (linha ~773): grupo principal
  com `model.ended` (turno da principal terminado) → `halt(ended, sent)`.
- Chips: "pendentes" conta folhas abertas não iniciadas (`hooks/render.tsx`, `pending`);
  "interrompida" conta `count()[2]` (status do desenho); "em andamento" só iniciadas.

## Plano
1. `halt` ganha um modo para as pendentes: `halt(at, sent, all = false)`. Com `all`, a folha aberta
   **não iniciada** também vira `interrupt(at)`; a folha com ✉ (`sent`) continua poupada. Pai: com
   tudo interrompido embaixo, `interrupt` (regra atual, `hasOpen(children)` falso).
2. **Filha** (`panelOf`, cartão não vivo e não `starting`): `halt(undefined, [], true)`. O `at`
   segue `undefined` (o relógio da pendente nunca correu; `interrupt` só põe `endedAt` se havia
   início). O `sent` da filha não está no modelo da principal; ✉ de filha para outra sessão aparece
   no cartão pela própria publicação dela, então `[]` basta.
3. **Principal** (`layout`, `model.ended`): `all = !temAndamento`, onde `temAndamento` =
   alguma folha do grupo principal iniciada e aberta (`t.startedAt !== undefined && status open`,
   sem fim) **ou** algum envio pendente (`sent.length > 0`). Avaliar por **pedido** (turno) e não
   pelo grupo inteiro: `all` por tarefa de nível 1 segundo o `turn` dela, para um pedido antigo sem
   nada em andamento não impedir... na prática o fim do turno só deixa em andamento o pedido atual;
   avaliar por grupo é suficiente e mais simples. Escolher por grupo.
4. Chips (`hooks/render.tsx`): "pendentes" já conta só `status === 'open'` e não iniciadas → as
   interrompidas saem sozinhas; "interrompida" entra por `count()`. Conferir que o cartão "parada"
   com tudo ✕ fica com o ícone de sessão cinza (estado `parada`), não verde (`concluída` exige
   todas `done`).
5. Contagem/barra: `count()` já exclui interrompidas do total (3/3 · 100 %); a barra do pai e do
   cabeçalho seguem `count`. Nada a mudar.
6. Retomada: `wake($)` zera `turnEnded` na principal; para a filha, `live` volta a `true` e
   `panelOf` devolve o painel cru → as tarefas voltam a ○/◉ sozinhas.
7. Sem testes nem docs (memória do projeto). Validar a recarga do mod e a validação visual: filha
   que encerra com pendentes → ✕ no cartão, chip "N interrompidas", sem "pendentes", 3/3; filha
   retoma e dá start → ◉ de novo; principal encerra com pendentes e nada em andamento → ✕; com uma
   iniciada ou um ✉ → pendentes seguem ○.
