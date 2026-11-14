# Ajuste 2: contagens do cabeçalho só por folhas

## Diagnóstico
- "N de M · %" (`count`, `draw/layout.ts:52`) já conta só folhas: pula `children.length > 0`,
  interrompidas fora do total. No print, "1 de 3" está certo (folhas: "Enviar ajuste…" ✓, "Ver print…"
  ◉, "Gravar plano" ○).
- O pai também não é contado no chip. O erro do "2 em andamento" vem de outro lugar: o chip conta toda
  folha **aberta**, iniciada (◉) ou pendente (○). Isso está em `hooks/render.tsx:252`
  (`active = flat(shown).filter(t => t.status === 'open' && t.children.length === 0 && …)`), e
  `activeLeaves` (`draw/layout.ts:437–451`) segue a mesma regra, como diz o próprio comentário
  ("◉ or ○ leaves"). No print as duas folhas abertas são "Ver print" ◉ e "Gravar plano" ○, daí o 2.
- Interrompidas (`x` de `count`) e "aguardando sessão" já são por folha/linha; nada a mudar.

## Decisão do usuário
- Ganha um chip novo, "N pendente(s)", para as folhas ○ não iniciadas (resposta: "Sim, chip de
  pendentes").

## Plano
1. Definir "em andamento" de uma folha: aberta, sem filhos e **desenhada como ◉**, ou seja, com o
   mesmo critério do tom `current` das linhas (`draw/layout.ts` ~773: `lit` de `current()`, por
   `startedAt`). O jeito mais seguro é reaproveitar a regra que pinta a linha, para o chip e o
   desenho nunca discordarem. Opções:
   - a) usar `t.startedAt !== undefined && t.endedAt === undefined` (como `timing`, linha 35); ou
   - b) contar pelas linhas: `lines` com `tone === 'current'` e nó folha (como já se faz com
     `tally`). Preferir b) se toda folha ◉ aparece como linha própria; se uma linha recolhida
     esconde folhas, usar a), que vale para subárvores dobradas.
   Implementar com a), conferindo que bate com o ◉ desenhado (o fallback de `current()` sem nenhum
   iniciado acende a primeira aberta: decidir que, sem `startedAt`, ela conta como pendente).
2. `hooks/render.tsx:252`: separar `active` (iniciadas) e `pending` (abertas sem `startedAt`), as
   duas só de folhas e excluindo as que aguardam sessão (`sentIds`/`sentTasks`), como hoje.
3. `chips` (`draw/svg.ts:390`): novo parâmetro `pending`, chip tom `open` (cinza, ○) com
   `plural(pending, 'pendente', 'pendentes')`, logo depois de "em andamento". Conferir que a largura
   da linha de chips quebra/encolhe como hoje (`headerSvg`, `wide`).
4. `activeLeaves` (`layout.ts:441`): passar a contar só folhas iniciadas e atualizar o comentário;
   ver quem chama (grep) e, se ele alimenta cartões/tooltip, criar a contagem de pendentes
   equivalente.
5. Terminal (`render.tsx` ~305–315): mesmo chip em texto.
6. Alt do cabeçalho (`render.tsx` ~289) já lista `list.map(c => c.text)`: herda o chip.
7. Sem testes nem docs (memória do projeto); validar a recarga do mod e entregar para a validação
   visual. Esperado no cenário do print: "1 em andamento · 1 pendente · 1 sessão ativa", "1 de 3".
