# Lote 21: corte de linhas, o bloco pequeno do fim não esconde o pedido

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit. Só
`draw/layout.ts` muda.

## 1. O que cobre

Correção direta: "Corte de linhas: um bloco pequeno depois do pedido gigante esconde o pedido inteiro"
(a metade direta do achado; a outra metade, a janela do bloco único, é a decisão 31, lote 22). Aplica
`cabecalho.limite-de-linhas-do-desenho` ("se o último pedido sozinho passa do limite, ele é desenhado até
o limite").

A pendência da linha do histórico aberto (PR 38, `4127e4b`) já entrou: este lote parte do `limitRows` de
hoje, com as linhas guardadas do histórico aberto.

## 2. Causa confirmada na ponta

`draw/layout.ts:722-764` (`limitRows`):

- `:740`: o corte procura a primeira linha de profundidade 0, depois da primeira, a partir da qual o
  resto cabe no limite; tudo antes dela vira "+N linhas anteriores".
- Depois dos pedidos, o painel põe na profundidade 0 blocos que não são pedido: o aviso sem tarefa
  (`:1475`, na função `body`), os subagentes sem tarefa de origem (`:1480`), "+N cartões antigos de
  sessões" e os cartões soltos (`:1643-1645`).
- Com um pedido único maior que o limite seguido de um desses blocos, a primeira linha que serve é a do
  bloco pequeno: o pedido inteiro sai e o desenho fica "+N linhas anteriores" e o bloco. O cabeçalho
  conta só o que restou.
- O mesmo `limitRows` é chamado com um teto menor pelo corte por tamanho (`hooks/render.tsx:384-393`),
  então isso acontece com muito menos de 400 linhas.

Escrito no código.

## 3. O que muda

`draw/layout.ts`, `limitRows`:

- As linhas são separadas em duas partes: os pedidos (do começo até o fim do último bloco de pedido: a
  linha do histórico, as linhas de pedido e as tarefas soltas de painéis sem pedidos, com tudo o que
  pende delas) e a cauda (os blocos de profundidade 0 que vêm depois do último pedido: aviso sem tarefa,
  cartões de subagente sem tarefa, "+N cartões antigos de sessões", cartões soltos de sessão). O bloco
  é reconhecido pela chave da linha de profundidade 0 que o abre (as chaves já dizem o que a linha é:
  pedido, tarefa, seção, aviso, sessão, subagente, grupo).
- A cauda fica com espaço reservado: o corte de hoje é aplicado só à parte dos pedidos, com o limite
  menos o tamanho da cauda, e a cauda é juntada depois, inteira.
- Quando a cauda sozinha passa da metade do limite (um cartão solto enorme), ou o limite menos a cauda
  fica abaixo de 2, vale o corte de hoje sobre tudo (não há como reservar).
- Nada muda quando não há cauda, nem na regra das linhas do histórico aberto.

No painel: um plano de 500 tarefas mais um cartão solto (ou um aviso de permissão sem tarefa em
andamento) mostra o pedido até o limite, "+N linhas", e depois o cartão (ou o aviso). O cabeçalho conta
o que está desenhado do pedido.

## 4. Impacto

`npm run impacto -- task-tree/draw/layout.ts`: 110 cenários. Golden pelo mapa: os quatro; nenhum passa do
limite: o desenho não muda.

## 5. Testes

Novo, em `tests/cabecalho.test.ts` (usa o `grande` do arquivo; `{ timeoutMs: 15000 }` como os vizinhos):

1. "um aviso sem tarefa depois de um pedido grande demais não esconde o pedido". Cenário
   `cabecalho.limite-de-linhas-do-desenho`. Roteiro: `fixar`; `on('classic.PermissionRequest', () =>
   ({}))`; pedido; `plan($, grande('T', 8, 8, 7))` (521 linhas), sem start; `$.classic.
   PermissionRequest({ tool_name: 'Bash' })` (o aviso sem tarefa em andamento vai ao fim do painel, na
   profundidade 0). Afirma: no máximo 400 linhas desenhadas; a linha do pedido e "T0.0.0" estão no
   painel; há uma linha "+N linhas" (o resto do pedido); a última linha contém "Aguardando permissão:
   Bash"; nenhuma linha "linhas anteriores". Falha hoje: o painel é "+521 linhas anteriores" e o aviso.

Opcional, se couber no tempo do teste: o mesmo com um cartão solto de sessão (uma filha sem tarefa de
origem, trabalhando) no lugar do aviso.

Testes existentes: nenhum muda (`:203-235` e os do corte por tamanho não têm cauda).

## 6. Catálogo e selos

`regras/cabecalho.md`, `cabecalho.limite-de-linhas-do-desenho`: no Então, depois de "ele é desenhado até
o limite e fecha com '+N linhas' no fim dele", acrescentar "; o que vem depois do último pedido (aviso
sem tarefa, cartão solto, subagente sem tarefa de origem) segue desenhado, com o espaço dele reservado".
Linha nova: `Reescrito: 2026-11-14, texto: o bloco pequeno depois do último pedido não entra no lugar
dele (auditoria 2026-11-10); a regra não muda e os testes existentes não mudam.`

Selo:

    npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::um aviso sem tarefa depois de um pedido grande demais não esconde o pedido" --tipo novo --motivo "o corte reserva o espaço do que vem depois do último pedido"

## 7. Documentação

`DESENVOLVIMENTO.md`: nas duas passagens de `limitRows` (em "Desenho" e na seção "Corte por tamanho no
lugar do aviso (2026-11-12)"), uma frase sobre a cauda reservada. O comentário acima de `MAX_ROWS`
(`draw/layout.ts:712-720`). `CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Difícil de montar à mão; fica coberto pelo teste. Se houver uma sessão real com um plano enorme e um
cartão solto, conferir que o plano não some.

## 10. Dependências e conflitos

- Depois do PR 38 (já no `main`). Antes do lote 22, que reescreve o caso do pedido único dentro da mesma
  função.
- Lote 05 (quem entra em "+N pedidos anteriores") e lote 06 (a palavra da direita nessa linha): não
  mudam chaves nem profundidades; sem conflito de lógica.
- Triagem A, decisão 10/13 (cartão e carta criados antes do plan ficam "soltos no fim só até o primeiro
  plan do pedido"): cria mais blocos de cauda (profundidade 0, depois dos pedidos). Se A der a esses
  blocos uma chave nova, ela entra na lista de chaves de cauda deste lote; o implementador do lote que
  vier depois confere.
- Triagem A, decisão 11 ("Vira linha resumida", filha arquivada antiga): a linha resumida, se ficar na
  profundidade 0 depois dos pedidos, também é cauda.
- Triagem C, decisão 39 ("Pendurar na pendente (Recomendado)", pergunta com tarefa aberta mas nenhuma em
  andamento): se C pendurar também o aviso de permissão na tarefa pendente, o aviso do teste daqui deixa
  de ir ao fim do painel; nesse caso o teste usa o cartão solto de sessão (a variante opcional) como
  cauda.

## 11. Bloqueio

Nenhum.
