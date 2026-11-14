# Decisões do usuário sobre as pendências depois do PR 37

Registro da orquestradora "Orq - TaskTree". Só ela escreve aqui. Cada item cita as palavras do usuário.

## Pedido, 2026-11-13

> Envie esses 4 questionamentos usando askquestions, vamos decidir um a um.
> A implementação deve ser feita conforme combinamos

"Conforme combinamos" = o processo dos ajustes do painel nativo (`orq-decisoes-ajustes-nativo.local.md`):
planejador e implementador em agentes diferentes; planejar com Fable, esforço alto, só lendo o código;
implementar com Opus, esforço baixo; o implementador valida, regrava o golden se mudar e faz o commit
local; item por item; ao final, push e PR.

## 1. Carta para subagente parado antes de receber

- Hoje: a carta (✉) mandada a um subagente que é parado antes de receber fica azul "na fila" para sempre,
  com o relógio correndo.
- 2026-11-13, "Cinza \"não entregue\" (Recomendado)": a carta fica cinza "não entregue" e o relógio para,
  como na decisão de 2026-11-12 para a sessão destino arquivada (`envios.destino-arquivado-nao-entregue`).

## 2A. Aviso "Painel grande demais" e botão "Voltar"

- Hoje: com o corte dos blocos mais antigos acima de 600 KB (decisão de 2026-11-12), o aviso e o botão
  ficaram quase inalcançáveis, e o "Voltar" pode não fazer nada quando não há nada aberto.
- 2026-11-13, "Manter como rede (Recomendado)": ficam no código para o caso raro em que o corte não basta;
  garantir que o "Voltar" funcione quando aparecer.

## 2B. Histórico aberto e cortado pelo teto de linhas

- Hoje: quando o teto corta um histórico aberto, a linha que abre e fecha o histórico pode ser cortada
  junto, e não sobra onde clicar para fechá-lo.
- 2026-11-13, "Preservar a linha (Recomendado)": o corte sempre deixa visível a linha do histórico aberto.

## 3. Frase do lembrete em turno de aviso

- Sugestão do planejador do item 9 do PR 36: nas regras de uso do painel, dizer ao modelo que, num turno
  aberto por aviso automático ou por retorno de subagente, a tarefa parada com Esc só volta com start nela.
- 2026-11-13, "Acrescentar (Recomendado)".

## 4. Resto da auditoria

- 2026-11-13, "Triar os médios (Recomendado)": um agente separa os 105 achados médios de
  `auditoria-mod-task-tree.local.md` em correção direta de bug (entra sem pergunta, pela regra do
  projeto) e os que contrariam decisão do usuário (vão a ele um a um). Os baixos ficam para depois.

## Modelo dos planejadores, 2026-11-14

- "os subagentes que você estiver usando com Fable, mude para usar com Opus, esforço Alto. Faça a troca
  imediatamente". Os planejadores (e qualquer agente que era Fable) passam a Opus, esforço alto. Os
  implementadores seguem Opus, esforço baixo.
- A máquina foi desligada em 2026-11-14 com os dois planejadores (carta; histórico e aviso) sem plano e o
  implementador da frase do lembrete com o diff aplicado no clone, sem commit. Os três foram relançados.

## Modelo dos planejadores, 2026-11-14 (de novo)

- "mude os modelos dos subagentes de planejamento para fable, esforco alto". Desfaz a troca anterior para
  os planejadores: de agora em diante, planejador = Fable, esforço alto; implementador segue Opus,
  esforço baixo. Nenhum planejador estava rodando no momento da troca.

## Modelo dos planejadores, 2026-11-14 (terceira troca)

- "Mude a configuração dos agentes de planejamento para fable, esforço médio, a partir do próximo
  subagente que será lançado. Não precisa parar os que estiverem em execução". De agora em diante:
  planejador = Fable, esforço médio; implementador segue Opus, esforço baixo. Nenhum planejador rodava
  na hora da troca.
