# Correção do achado alto 4: plano que reusa um id não renomeia a âncora dos grupos de subagente

Data: 2026-11-10. Branch `fix/achados-altos-auditoria`, sobre `fbe86b4`. Ensaiado numa cópia no
scratchpad (clone local); o repositório não foi tocado. Diff aplicável: `correcao-alto-4.diff`, ao
lado deste arquivo (`git apply --check` no repositório: ok).

Sem BLOQUEIO: a correção aplica regras já registradas e não muda teste selado nem golden.

## O defeito, reproduzido

- `planTool` (`task-tree/hooks/tools.ts`) renomeia para `tag:id` (com a subárvore) a tarefa cujo id o
  plano reusa e que não é replanejada no lugar: nível 1 fechado, ou aberto de um pedido anterior.
- `renameAnchors` (`task-tree/hooks/panel.ts`) leva junto as âncoras das sessões, cartas e
  lançamentos, mas não `Group.anchor` dos subagentes; e só roda para o loop principal.
- Resultado: o cartão do subagente antigo passa a pender da tarefa nova de mesmo id, e
  `settleBySubs` (`hooks/agents.ts`) fecha a tarefa nova ✓ no fim do turno pelo subagente antigo.
  O mesmo vale no replano de um subagente sobre as tarefas dele (os subagentes que ele lançou).
- Os dois testes novos falham no código atual (rodados na cópia):
  - pedido novo: `○ Corrigir` com `└─ ✓ Explore: ler o kit … concluído` embaixo;
  - replano do subagente: `✓ Corrigir os testes` (deveria seguir `○`).

## Decisões conferidas (nenhuma contrariada)

- `subagentes.cartao-desde-o-lancamento`: o cartão fica sob a tarefa de onde saiu. A correção aplica isso.
- `pedidos.plano-anterior-vira-historico` e `pedidos.nivel1-concluido-e-historico`: o antigo vira
  histórico renomeado. Não muda; só a âncora do grupo passa a seguir a cópia antiga, como a da sessão e a carta.
- `subagentes.pai-conclui-no-fim-do-turno`: não muda; a tarefa de onde saiu o subagente segue fechando sozinha.
- `turnos.pendentes-seguem-pendentes`: a pendente nova deixa de ser fechada pelo subagente antigo.
- Nenhum teste existente muda (`npm run testes:alterados`: "nenhum"). Golden: nenhum cenário.

## Passo a passo

1. `task-tree/hooks/panel.ts`: extrair a regra de renomear a âncora para um helper puro exportado,
   `renamedAnchor(ids, tag)`, e usá-lo em `renameAnchors` (comportamento igual). Comentário diz que os
   grupos de subagente são renomeados no `change` do `planTool`.
2. `task-tree/hooks/tools.ts`, dentro do fecho do `change` do `planTool` (mesma escrita que renomeia as
   tarefas, sem janela entre as duas):
   - calcular os ids renomeados do grupo de quem chamou a partir de `all` (o mesmo critério de `away`:
     `ids.includes(t.id) && !replanned(t)`), valendo para o loop principal e para subagente;
   - para cada grupo com `(g.parent ?? MAIN) === agent` cuja âncora muda com `renamedAnchor`, gravar a âncora nova.
   ```ts
   const own = all.find(g => g.agent === agent)?.tasks ?? []
   const fix = renamedAnchor(own.filter(t => ids.includes(t.id) && !replanned(t)).map(t => t.id), tag)
   return all.map(g => {
     if (g.agent !== agent) return (g.parent ?? MAIN) === agent && fix(g.anchor) !== g.anchor ? { ...g, anchor: fix(g.anchor) } : g
   ```
   Efeito colateral bom: `usedAnchors` (a escolha da tarefa da carta ou do lançamento seguinte) deixa
   de ver o subagente antigo como uso da tarefa nova.
3. `regras/subagentes.md`: cenário novo `subagentes.id-reusado-nao-herda-cartao` (Dado/Quando/Então,
   origem na auditoria aplicando `subagentes.cartao-desde-o-lancamento` e
   `pedidos.plano-anterior-vira-historico`; `Código: hooks/tools.ts, hooks/panel.ts`; `Estado: coberto`).
4. `task-tree/tests/subagentes.test.ts`: dois testes com `// Regra: subagentes.id-reusado-nao-herda-cartao`:
   - "plan de um pedido novo que reusa o id não herda o cartão do subagente antigo, e o fim do turno
     não fecha a tarefa nova": pedido um com subagente que fecha a tarefa; pedido dois com o mesmo
     `A`/`1`; o cartão não está sob "Corrigir", e depois do fim do turno "Corrigir" segue `pendente` e
     "Plano B" não fica concluído;
   - "o replano de um subagente que reusa o id não deixa o subagente que ele lançou fechar a tarefa
     nova": subagente em segundo plano planeja `X`, lança um neto que termina, dá `done X`, replaneja
     `X`; no fim do turno "Ler os testes" segue `concluida` e "Corrigir os testes" segue `pendente`.
5. Selos (tipo novo):
   ```
   npm run regras:selar -- "task-tree/tests/subagentes.test.ts::plan de um pedido novo que reusa o id não herda o cartão do subagente antigo, e o fim do turno não fecha a tarefa nova" --tipo novo --motivo "auditoria 2026-11-10, achado alto 4"
   npm run regras:selar -- "task-tree/tests/subagentes.test.ts::o replano de um subagente que reusa o id não deixa o subagente que ele lançou fechar a tarefa nova" --tipo novo --motivo "auditoria 2026-11-10, achado alto 4"
   ```
   (O diff já traz os dois selos em `regras/selos.json`; ao aplicar o diff, não precisa selar de novo.)
6. `npm run check`, e commit local só destes 5 arquivos:
   `fix(task-tree): plano que reusa o id leva junto a âncora dos subagentes`.

## Impacto e check (na cópia)

- `npm run impacto -- task-tree/hooks/tools.ts task-tree/hooks/panel.ts`: 68 cenários afetados
  (todos os de `pedidos`, `perguntas`, `turnos`, `arvore`, `sessoes.cartao-sob-a-tarefa-de-origem`
  e o novo); checklist do app: nenhum; golden: nenhum cenário; fora do mapa: nenhum.
- `npm run testes:alterados`: existentes alterados: nenhum; novos: os dois acima.
- `npm run check` (binário 2.1.321): `ok regras, travas, selos, validate do marketplace, validate do
  mod, tsc, plugin test (173 pass, 0 fail), regressao (171 testes de HEAD contra o código novo, 0 falharam)`.
- Na cópia o `validate` não gerou `task-tree/.claude-plugin/types/`; copiei a pasta do repositório para o
  `tsc` rodar. No repositório isso não acontece.

## Achado 6 (fechamento automático olhando subagentes de turnos anteriores), sem conflito

- Esta correção não toca `hooks/agents.ts`. O achado 6 entra lá (`settleBySubs`, filtro por tempo).
- Arquivos em comum: só adições no fim de `regras/subagentes.md`, `task-tree/tests/subagentes.test.ts`
  e `regras/selos.json`. Aplicando o 6 depois deste, não há conflito de texto.
- Cuidado no 6: com o relógio parado do kit (`fixar`), o fim do subagente antigo e o `plannedAt`/
  `startedAt` da tarefa nova têm o mesmo instante. Um filtro `sub.end >= (startedAt ?? plannedAt)` não
  separa os dois sem `relogio.advance`. Os testes deste achado passam só pela âncora renomeada, sem
  depender do filtro.

## Fica fora (relatar, não bloqueia)

- Dados já gravados antes da correção (grupos com a âncora antiga, já sob a tarefa nova de mesmo id)
  continuam assim. A defesa por tempo do achado 6 cobre o fechamento; para o desenho, seria preciso
  conferir o lançamento contra o `plannedAt` da tarefa no `below` de `draw/layout.ts`. Proposta para
  depois, junto do achado 5.
- Achado 5 (o cartão some quando a tarefa de origem fecha): com esta correção, o cartão antigo fica
  sob a cópia fechada e, por isso, não é desenhado. É o comportamento de hoje para tarefa fechada, e o
  achado 5 o corrige à parte.
- Cartão de neto terminado (subagente lançado por subagente) não é desenhado: `trimToWork` só mantém
  o grupo cuja âncora está nas tarefas do loop principal. Achado à parte, visto no ensaio.
- `task-tree/DESENVOLVIMENTO.md:366-375` lista o que `renameAnchors` renomeia, sem os grupos de
  subagente. Não editei, porque a pergunta 37 (documentação) segue aberta.
