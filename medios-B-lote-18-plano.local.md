# Lote 18: o tempo do cabeçalho para no fim do turno

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão). O golden `principal` muda.

## 1. O que cobre

- Achado: "Tempo do cabeçalho segue contra 'agora' com o turno encerrado, mas o relógio de 1 s para".
- Decisão 25 (B), 2026-11-14: "Parar no fim do turno (Recomendado)". Texto da opção: "o cabeçalho mostra
  o tempo até o fim do turno; com sessão filha trabalhando ou carta na fila, segue contando com o
  relógio ligado."

## 2. Causa confirmada na ponta

- `hooks/render.tsx:282`: `headTime = sessionTime(shown, tally(r => r.live) > 0 || hasOpen(shown), now)`.
  Basta haver tarefa aberta entre as desenhadas (○ e ◷ seguem abertas depois do fim do turno) para o
  tempo ser medido até agora.
- `draw/layout.ts:613-621` (`sessionTime`): com o segundo argumento verdadeiro, vai do primeiro start (ou
  plan) até agora; senão, até o último fim.
- `hooks/sessions.ts:296-322` (`anyRunning` e `tick`): com o turno terminado, sem carta na fila e sem
  filha viva, o relógio de 1 s se cancela. O número do cabeçalho fica o do último desenho e salta no
  seguinte (uma hora depois, um clique numa dobra mostra 1:05:00).

Escrito no código. Não havia cenário de tempo em `regras/cabecalho.md`.

## 3. O que muda

`hooks/render.tsx` (e, se precisar, um argumento a mais em `sessionTime`, `draw/layout.ts`):

- O tempo do cabeçalho conta até agora só quando o relógio de 1 s também está ligado: turno em curso com
  algo aberto entre as tarefas desenhadas (como hoje); ou, com o turno terminado, sessão filha viva,
  carta na fila ou subagente vivo (os mesmos números dos chips, com o que as linhas recolhidas levam, do
  lote 12; o subagente vivo entra pelo lote 15, que liga o relógio para ele).
- Com o turno terminado e nada disso, o tempo vai até o fim do turno (o instante que `render` já lê,
  `ended`, `:236`) enquanto houver tarefa aberta à vista; com tudo fechado, até o último fim, como hoje.
- O tempo das linhas não muda neste lote (já para no fim do turno).

No painel: com o turno encerrado e tarefas ○ ou ◷, o tempo do cabeçalho fica parado no valor do fim do
turno, em qualquer redesenho; com filha trabalhando ou carta na fila, segue contando segundo a segundo;
na mensagem seguinte, volta a contar.

## 4. Impacto

`npm run impacto -- task-tree/hooks/render.tsx task-tree/draw/layout.ts`: todos os cenários (núcleo).
Golden pelo mapa: os quatro; muda o `principal` (seção 8).

## 5. Testes

Novos, em `tests/cabecalho.test.ts`. O tempo do cabeçalho é lido na linha do cabeçalho do terminal (o
relógio vem depois do "p%"); um ajudante local do arquivo de teste o extrai com uma expressão regular
(não é preciso mudar o kit).

1. "com o turno encerrado e tarefas abertas, o tempo do cabeçalho para no fim do turno". Cenário novo
   `cabecalho.tempo-para-no-fim-do-turno`. Roteiro: `fixar` com `relogio`; pedido; plan com "Um" e
   "Dois"; start em "Um"; `relogio.advance(5000)`; fim do turno; lê o tempo (0:05);
   `relogio.advance(3_600_000)`; lê de novo. Afirma: o mesmo 0:05 nas duas leituras. Depois `pedido` e
   `relogio.advance(1000)`: o tempo voltou a contar (maior que 0:05). Falha hoje: a segunda leitura dá
   1:00:05.
2. "com o turno encerrado e uma carta na fila (ou a filha trabalhando), o tempo do cabeçalho segue
   contando". Mesmo cenário. Roteiro: host com `local_x`; `responderEnvio`; plan; start; `envio` (fila);
   fim do turno; `relogio.advance(60_000)`. Afirma: o tempo do cabeçalho passou de 1:00. Passa hoje (fixa
   o lado que não muda).

Testes existentes: nenhum deve mudar além do golden `principal`. Se um teste coberto afirmar o tempo do
cabeçalho crescendo com o turno terminado, ele muda por esta decisão (cenário com `Reescrito: 2026-11-14,
decisão do usuário ("Parar no fim do turno (Recomendado)")`, selo `--tipo decisao`).

## 6. Catálogo e selos

`regras/cabecalho.md`, cenário novo:

- `### cabecalho.tempo-para-no-fim-do-turno`
- Título: "Com o turno encerrado, o tempo do cabeçalho para no fim do turno."
- Dado o turno encerrado e tarefas ainda abertas (○ ou ◷) à vista
- Quando o painel é redesenhado, logo depois ou horas depois
- Então o tempo do cabeçalho é o do fim do turno, como o das linhas; com sessão filha trabalhando, carta
  na fila ou subagente rodando, ele segue contando, com o relógio de 1 s ligado; na mensagem seguinte,
  volta a contar
- `Origem: decisão do usuário, 2026-11-14 ("Parar no fim do turno (Recomendado)").`
- `Código: hooks/render.tsx, hooks/sessions.ts`
- `Estado: coberto`

`regras/visual.md`, `visual.desenho-principal`: linha nova `Reescrito: 2026-11-14, decisão do usuário
("Parar no fim do turno (Recomendado)"): o tempo do cabeçalho do cenário para no fim do turno (0:01 no
lugar de 0:02); o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app
no fim.`

Selos:

    npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::com o turno encerrado e tarefas abertas, o tempo do cabeçalho para no fim do turno" --tipo novo --motivo "decisão do usuário, 2026-11-14: Parar no fim do turno (Recomendado)"
    npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::com o turno encerrado e uma carta na fila (ou a filha trabalhando), o tempo do cabeçalho segue contando" --tipo novo --motivo "decisão do usuário, 2026-11-14: Parar no fim do turno (Recomendado)"
    npm run golden:aprovar -- principal --motivo "\"Validar só no fim (Recomendado)\", 2026-11-14"

## 7. Documentação

`DESENVOLVIMENTO.md`: onde o tempo do cabeçalho é descrito (procurar `sessionTime` e "o da sessão
inteira"), a decisão com as palavras e a data. `CLAUDE.md`: no "Checklist do app", item do cabeçalho,
acrescentar "o tempo do cabeçalho parado com o turno encerrado".

## 8. Golden

Muda o `principal`: no cenário, o turno termina e o relógio anda 1 s antes do desenho; o tempo do
cabeçalho passa de 0:02 (até agora) para 0:01 (até o fim do turno), no texto do bloco de números e no
texto alternativo da barra. Os outros três não mudam (`filha` e `subagente` com o turno em curso;
`envios` com carta na fila, que mantém o relógio). O implementador confere que a diferença é só essa e
regrava com o motivo "Validar só no fim (Recomendado)".

## 9. Checklist do app

Deixar o turno terminar com tarefas abertas, esperar alguns minutos e clicar numa dobra: o tempo do
cabeçalho não salta. Com uma filha trabalhando, ele segue contando.

## 10. Dependências e conflitos

- Depois do lote 12 (os números somados com as linhas recolhidas) e do lote 15 (o relógio ligado com
  subagente vivo). Antes do lote 19, que muda a base do tempo e mexe na mesma linha de `render`.
- Triagem C, decisão 44 ("Do primeiro start (Recomendado)", base do tempo de pai e pedido; "pode mudar o
  golden principal"): os dois lotes regravam o golden `principal`; o segundo a entrar regrava de novo
  sobre o primeiro. Decisão 43 ("Ampliar o golden").
- Triagem A, decisão 17 ("Só o próprio", o relógio da linha não corre enquanto a filha trabalha): fala
  da linha da tarefa concluída com filha embaixo; o cabeçalho, por esta decisão, segue contando com a
  filha trabalhando. Não há conflito de regra, só de arquivo (`render.tsx`).

## 11. Bloqueio

Nenhum.
