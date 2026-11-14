# Linha de chips do cabeçalho com altura fixa

Pedido: "mesmo que não mostre nada, esse espaço fique preenchido por um label vazio ou algo do tipo,
para evitar que as tarefas fiquem pulando quando o layout muda".

## Onde está
- Desktop: `headerSvg` (`draw/svg.ts:403`). A altura do cabeçalho depende do que ele mostra:
  `H = empty ? HEADER_H_EMPTY (44) : list.length > 0 ? HEADER_H_CHIPS (88) : HEADER_H (66)`
  (constantes em `draw/geometry.ts`). Sem chips, o SVG perde 22 px e toda a lista sobe; quando um
  chip aparece, ela desce. A linha divisória (`ln`, em `H − 0.5`) acompanha.
- O mesmo `headerSvg` serve às duas visões (resumida e completa), chamado em `hooks/render.tsx`
  (`const top = headerSvg(...)`). Corrigindo nele, as duas visões ficam certas.
- Terminal (`hooks/render.tsx` ~318–334): os chips já ficam na linha da barra (`<Text key="bar">`),
  que existe sempre. Ali nada pula, e não há o que mudar.

## Plano
1. `draw/svg.ts` `headerSvg`: com tarefas (`!empty`), usar sempre `H = HEADER_H_CHIPS`, haja chips
   ou não. A faixa dos chips (y 60–76) fica reservada e vazia: é o "label vazio", sem texto, para
   não poluir.
2. Estado vazio ("Nenhuma tarefa planejada"): também usar `HEADER_H_CHIPS`, para não pular quando o
   primeiro plano chega (de 44 para 88 px). O texto fica onde está, e o espaço abaixo fica livre.
3. `HEADER_H` (66) e `HEADER_H_EMPTY` (44) deixam de ser usados. Removê-los de `geometry.ts` e do
   import em `svg.ts`, ou deixar só `HEADER_H_CHIPS` renomeado como `HEADER_H`. Atualizar o
   comentário de `geometry.ts` ("its height by what it shows").
4. Nada mais depende da altura: `drawDesktop` usa `top.height`, e o hover do título (`W − 64`, 24
   px) e os ícones ≡/▤ são ancorados no topo.
5. Sem testes nem docs (memória do projeto). Validar a recarga do mod e fazer a validação visual
   nas duas visões, alternando de nada em andamento para 1 pendente ou 1 sessão ativa: a primeira
   linha de tarefa não deve mudar de altura.

Possível pergunta ao usuário (não feita, a recomendação é a do passo 2): no estado sem nenhuma tarefa
planejada, reservar a faixa também ou manter o cabeçalho baixo.
