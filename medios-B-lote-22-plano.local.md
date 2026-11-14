# Lote 22: o pedido único acima do limite mostra o trecho da tarefa em andamento

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão). Só `draw/layout.ts` muda.

## 1. O que cobre

- Achado: "Corte de linhas: … no bloco único o corte guarda o começo, não a tarefa em andamento" (a
  metade de decisão; a metade direta é o lote 21).
- Decisão 31 (B), 2026-11-14: "Trecho da em andamento (Recomendado)". Texto da opção: "'+N linhas
  anteriores' antes e '+N linhas' depois; os chips e a faixa voltam a refletir o trabalho em curso. Muda
  o desenho aprovado em 2026-10-22." Nota da orquestradora: "muda o desenho aprovado em 2026-10-22".

## 2. Causa confirmada na ponta

`draw/layout.ts:745-763` (`limitRows`, o caso em que o último bloco sozinho passa do limite): o bloco é
desenhado do começo até o limite (`block.slice(0, k)`, mais as linhas guardadas do histórico aberto) e
fecha com "+N linhas". Se a tarefa em andamento está depois do corte, a linha dela não é desenhada; como
o cabeçalho conta o que as linhas desenhadas representam (`hooks/render.tsx:279-296`), o chip "em
andamento" fica em 0 e a faixa diz "aguardando" com trabalho em curso. Escrito no código. O desenho
aprovado: 2026-10-22, "Sim, com o corte" (`cabecalho.limite-de-linhas-do-desenho`: "desenhado até o
limite e fecha com '+N linhas' no fim dele").

## 3. O que muda

`draw/layout.ts`, `limitRows`, só no caso do último bloco maior que o limite:

- A tarefa em andamento do bloco é a primeira linha dele marcada em andamento por conta própria (a marca
  `active` da linha, que `rows` já calcula em `:1149` e ninguém lia).
- Se não há nenhuma, ou a primeira já cai dentro do trecho que o corte de hoje desenha (o começo), nada
  muda: o começo e "+N linhas" no fim.
- Se a primeira está depois do corte, o desenho do bloco passa a ser, nesta ordem:
  1. as linhas de cima da janela que são pais dela (a linha do pedido, o nível 1, o pai), para a árvore
     fazer sentido: as mais próximas acima, menos profundas, até a profundidade 0 (a mesma busca que as
     linhas do histórico aberto já usam, `:731-737`);
  2. uma linha "+N linhas anteriores", com as linhas do bloco puladas antes da janela (sem contar os
     pais desenhados), na profundidade 1, com chave própria (diferente da de "+N linhas anteriores" dos
     blocos antigos, que segue existindo quando há blocos antes);
  3. a janela: um trecho contínuo do bloco que contém a tarefa em andamento, começando até um quarto do
     espaço antes dela (para se ver o que veio logo antes) e seguindo até o espaço acabar;
  4. "+N linhas", com o que sobrou depois, quando sobrou.
- O total de linhas segue dentro do limite pedido (o de 400 ou o menor, do corte por tamanho). As linhas
  guardadas do histórico aberto seguem guardadas. As duas linhas de contagem levam quantas linhas
  representam (`cut`), como hoje.
- A cauda reservada do lote 21 continua depois de tudo.

No painel: num pedido de 500 tarefas com a 493ª em andamento, o painel mostra o pedido, os pais dela,
"+N linhas anteriores", o trecho em volta dela e "+N linhas"; o chip "1 em andamento" e a faixa âmbar
voltam.

## 4. Impacto

`npm run impacto -- task-tree/draw/layout.ts`: 110 cenários. Golden pelo mapa: os quatro; nenhum passa do
limite: o desenho não muda.

## 5. Testes

Novo, em `tests/cabecalho.test.ts` (com o `grande` do arquivo e `{ timeoutMs: 15000 }`):

1. "num pedido grande demais, com a tarefa em andamento depois do corte, o painel mostra o trecho dela".
   Cenário `cabecalho.limite-de-linhas-do-desenho`. Roteiro: `fixar`; pedido; `plan($, grande('T', 8, 8,
   7))` (521 linhas); `start($, ['7.4.3'])` (a linha 493 do pedido). Afirma: no máximo 400 linhas
   desenhadas; a linha "T7.4.3" está no painel, em andamento; as linhas "T7", "T7.4" e a do pedido
   também; existe uma linha que casa com `^\+\d+ linhas anteriores$` e a última linha desenhada casa com
   `\+\d+ linhas$`; `cabecalho(p).chips.andamento` igual a 1; pelo app, o estado geral "em andamento".
   Falha hoje: "T7.4.3" não é desenhada e o chip é 0.
2. "com a tarefa em andamento dentro do começo, o corte segue guardando o começo". Mesmo cenário. Roteiro
   igual com `start($, ['0.0.3'])`. Afirma: "T0.0.3" em andamento no painel; nenhuma linha "linhas
   anteriores"; a última linha "+N linhas". Passa hoje (fixa o lado que não muda).

Testes existentes: os de `:203-215` e `:339-352` (pedido grande sem tarefa em andamento) não mudam.

## 6. Catálogo e selos

`regras/cabecalho.md`, `cabecalho.limite-de-linhas-do-desenho`: no Então, trocar "se o último pedido
sozinho passa do limite, ele é desenhado até o limite e fecha com '+N linhas' no fim dele" por "se o
último pedido sozinho passa do limite, ele é desenhado até o limite e fecha com '+N linhas' no fim dele;
se a tarefa em andamento dele está depois desse corte, é desenhado o trecho onde ela está, com os pais
dela, '+N linhas anteriores' antes e '+N linhas' depois, e os chips e a faixa contam o trabalho em
curso". Linha nova: `Reescrito: 2026-11-14, decisão do usuário ("Trecho da em andamento (Recomendado)");
muda, para o pedido com a tarefa em andamento depois do corte, o desenho aprovado em 2026-10-22 ("Sim,
com o corte"). Os testes existentes deste cenário não mudam.`

Selos (`novo`):

    npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::num pedido grande demais, com a tarefa em andamento depois do corte, o painel mostra o trecho dela" --tipo novo --motivo "decisão do usuário, 2026-11-14: Trecho da em andamento (Recomendado)"
    npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::com a tarefa em andamento dentro do começo, o corte segue guardando o começo" --tipo novo --motivo "decisão do usuário, 2026-11-14: Trecho da em andamento (Recomendado)"

## 7. Documentação

`DESENVOLVIMENTO.md`: nas passagens de `limitRows` (as mesmas do lote 21), a janela da tarefa em
andamento, com as palavras e a data. O comentário acima de `MAX_ROWS`. `CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Num plano real muito grande (ou num painel que passa de 600 KB), com uma tarefa em andamento no fim: ela
aparece, com "+N linhas anteriores" acima do trecho, e as guias da árvore fazem sentido com os pais
desenhados acima. Conferir nos dois temas que as duas linhas de contagem não se confundem com tarefas.

## 10. Dependências e conflitos

- Depois do lote 21 (mesma função; a cauda reservada) e do lote 12 (os chips somados). O lote 16 (faixa
  durante o turno) não conflita.
- Triagem A, decisão 2 ("Inicia a 1ª subtarefa (Recomendado)", start num pai aberto): muda qual folha
  fica em andamento; este lote lê a marca da linha, qualquer que seja a folha.
- Triagem C, decisão 43 ("Ampliar o golden"): se C quiser um cenário de golden com o corte, ele grava o
  desenho deste lote.

## 11. Bloqueio

Nenhum. Escolhas do planejador dentro da opção: com mais de uma tarefa em andamento, a janela segue a
primeira delas na ordem do painel; os pais da janela são desenhados acima dela; a janela começa um pouco
antes da tarefa (até um quarto do espaço).
