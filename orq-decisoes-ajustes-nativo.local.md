# Decisões do usuário sobre os 4 ajustes do painel nativo (PR 37)

Registro da orquestradora "Orq - TaskTree". Cada item cita as palavras do usuário e a data.

## Pedido, 2026-11-13

> quero que você faca do zero o planejamento e a implementacao dos 4 itens, em subagentes separados.
> planeje com fable alto e implemente com opus baixo. a sessão de implantacao tambem deve validar os
> resultados.
> faça item por item. ao final dos 4, faça push e abra pr

Antes, no mesmo dia: "o planejamento e a implementacao devem ser feitas em agentes diferentes";
"Implementador escreve o código (Recomendado)".

## Respostas às dúvidas, 2026-11-13

- Golden: "Validar só no fim (Recomendado)". O pedido vale como aprovação: o implementador regrava o
  golden com `--motivo "\"Validar só no fim (Recomendado)\", 2026-11-13"` e faz o commit de cada ajuste
  sem parar; o usuário vê os 4 no app no fim, antes do merge.
- Planejamento: "Os 3 primeiros em paralelo". Os planejadores dos ajustes 1, 2 e 3 rodam juntos, a
  partir de `22ad5de`; o do 4 espera os planos do 1 e do 3. O implementador adapta cada plano ao código
  que já mudou.
- PR: "Atualizar o PR 37 (Recomendado)". Push na `feat/painel-nativo`; título, descrição e labels
  atualizados.
- Cabeçalho: "Sim, junto do cartão (Recomendado)". O cabeçalho entra no ajuste 1, com o mesmo fundo e
  a mesma borda do cartão.
- Planejador: "Só lê o código (Recomendado)". Sem cópia e sem executar nada além de leitura e
  `npm run impacto`. O que precisa de execução fica descrito para o implementador.
- Commit: "O implementador (Recomendado)". Ele valida, regrava o golden e faz o commit local; a
  orquestradora confere o commit antes de liberar o próximo ajuste.

## Ajuste 2 (margem esquerda), 2026-11-13

- À pergunta "No app, agora, o lado esquerdo do painel aparece cortado como no print?", o usuário
  respondeu com um print do painel e as palavras "está assim". No print, o cabeçalho, a faixa de
  estado, o ▸ e os ícones do primeiro nível aparecem inteiros: o corte era do print anterior.
- Efeito: o ajuste 2 sai da lista (era a opção "Só no print"). O plano fica em
  `ajuste-2-margem-plano.local.md`, sem implementação.

## Ajuste 4 (contraste por nível e espaço), 2026-11-13

- Altura de cada linha: "1,4" (o planejador propunha 1,4; o padrão da pergunta era 1,3).
- Espaço entre o ícone e o título: "Não, fica como está (Recomendado)". Sai o item da meia coluna a mais.
- Folga dentro do cartão: "nos 4 lados" (resposta livre dele). O respiro cresce em cima, embaixo, à
  esquerda e à direita.

## Validação, 2026-11-13

- O usuário validou os ajustes no app, na ponta `edad945`: "validado".
