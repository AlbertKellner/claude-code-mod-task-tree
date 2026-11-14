# Lote 06: total da sessão inteira na linha "+N pedidos anteriores"

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão).

## 1. O que cobre

- Achado: "'Sessão inteira: a de b' não tem mais onde aparecer no desktop".
- Decisão 28 (B), 2026-11-14: "Na linha +N (Recomendado)". Texto da opção: "a linha passa a dizer, por
  exemplo, '+4 pedidos anteriores · sessão inteira: 5 de 5', só quando o total difere do mostrado."
- Parte direta do mesmo achado: os comentários e o `DESENVOLVIMENTO.md` que ainda dizem "tooltip".

## 2. Causa confirmada na ponta

- `hooks/render.tsx:292`: `whole` é "sessão inteira: a de b" quando a conta da sessão difere da
  desenhada, senão vazio. No terminal ele vai depois do cabeçalho (`:333`); no desktop só entra no texto
  alternativo da barra (`:311`) e é passado a `desktopHead` (`:312`), que não o desenha
  (`draw/head.tsx:15-18`, o comentário do tipo `Head` diz "it is in `alt` already").
- A linha "+N pedidos anteriores" é feita em `draw/layout.ts:1446-1454` (chave `sec:turns` no painel
  principal; nos cartões, a chave tem o prefixo do cartão), sem nada à direita.
- No desktop, uma linha de seção desenha a palavra da direita (`meta`) quando ela existe
  (`draw/desktop.tsx:346-354`); no terminal, `rightText` a põe depois do título (`hooks/render.tsx:132`).
- Restos de "tooltip": `hooks/render.tsx:215`, `:220` e `:278`.

Escrito no código.

## 3. O que muda

- `hooks/render.tsx`, dentro de `paint`: depois de calcular `whole`, quando ele não é vazio, a linha do
  painel principal com a chave exata `sec:turns` recebe `whole` como a palavra da direita (`meta`), e o
  desenho (desktop e terminal) usa as linhas assim. O título da linha não muda ("+N pedidos
  anteriores"): só ganha, na mesma linha, "sessão inteira: a de b".
- Motivo de usar a palavra da direita e não o título: 20 asserções de testes cobertos leem o título
  exato da linha (`titulo === '+1 pedidos anteriores'`, `/ pedidos anteriores$/`, e o `comHistorico` do
  kit a acha pelo título para abri-la). Com a palavra da direita nenhum deles muda, e a linha diz o
  total, como a decisão pede. No terminal fica "+4 pedidos anteriores  sessão inteira: 5 de 5"; no
  desktop, o título à esquerda e "sessão inteira: 5 de 5" à direita, na letra pequena das outras
  palavras de estado.
- Só a linha do painel principal; a de dentro de um cartão de filha não (o total é desta sessão).
- Aberta a linha (os pedidos anteriores desenhados), o desenhado costuma igualar a sessão inteira: sem
  diferença, nada é escrito.
- O texto alternativo da barra e o "(sessão inteira: a de b)" do cabeçalho do terminal seguem como hoje.
- Comentários de `hooks/render.tsx` (`:215`, `:220`, `:278`): "tooltip" vira "o texto alternativo da
  barra e a linha '+N pedidos anteriores'". `draw/head.tsx`: só o comentário do tipo `Head` (o `whole`
  vai também na linha do histórico); nenhum desenho muda ali.

## 4. Impacto

`npm run impacto -- task-tree/hooks/render.tsx task-tree/draw/head.tsx`: todos os cenários
(`hooks/render.tsx` é do núcleo). Golden pelo mapa: os quatro cenários; nenhum tem "+N pedidos
anteriores" (o `principal` tem dois pedidos, os dois no trabalho), então o desenho não muda.

## 5. Testes

Novos, em `tests/cabecalho.test.ts`:

1. "com pedidos escondidos, a linha '+N pedidos anteriores' diz o total da sessão inteira". Cenário novo
   `cabecalho.sessao-inteira-na-linha-do-historico`. Roteiro: o mesmo do teste de `:152-171` (cinco
   pedidos concluídos; o painel mostra o último e "+4 pedidos anteriores"). Afirma, pelo terminal:
   `linha(p, '+4 pedidos anteriores').texto` contém "sessão inteira: 5 de 5", e o título da linha segue
   "+4 pedidos anteriores". Pelo app (`noApp`): `linhaDoApp(d, '+4 pedidos anteriores').texto` contém
   "sessão inteira: 5 de 5". Falha hoje: a linha não diz o total.
2. "aberta a linha, com tudo desenhado, ela não repete o total". Mesmo cenário. Roteiro: o mesmo,
   abrindo a linha (`montar` e `recolher('+4 pedidos anteriores')`). Afirma: o cabeçalho conta 5 de 5 e
   a linha, agora aberta, não contém "sessão inteira". Passa hoje.

Testes existentes: nenhum muda (o título da linha e o cabeçalho do terminal ficam como estão).

## 6. Catálogo e selos

`regras/cabecalho.md`:

- Cenário novo `### cabecalho.sessao-inteira-na-linha-do-historico`
  - Título: "Com pedidos escondidos, a linha '+N pedidos anteriores' diz o total da sessão inteira."
  - Dado pedidos em "+N pedidos anteriores", com o cabeçalho contando só o que está à vista
  - Quando o painel é desenhado, no app desktop e no terminal
  - Então a linha "+N pedidos anteriores" traz, à direita, "sessão inteira: a de b"; só quando esse
    total difere do mostrado no cabeçalho; a linha de dentro de um cartão de filha não o traz
  - `Origem: decisão do usuário, 2026-11-14 ("Na linha +N (Recomendado)"), à pergunta "Quer ver esse
    total no app?" (no app desktop o total só existia no texto alternativo da barra).`
  - `Código: hooks/render.tsx, draw/desktop.tsx`
  - `Estado: coberto`
- `cabecalho.limites-de-linhas`: no Então, trocar "(a sessão inteira, só no texto alternativo da barra do
  cabeçalho)" por "(a sessão inteira, na própria linha '+N pedidos anteriores' e no texto alternativo da
  barra: cabecalho.sessao-inteira-na-linha-do-historico)". Linha nova: `Reescrito: 2026-11-14, decisão do
  usuário ("Na linha +N (Recomendado)"): o total da sessão inteira aparece na linha "+N pedidos
  anteriores". Os testes deste cenário não mudam.`

Selos:

    npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::com pedidos escondidos, a linha '+N pedidos anteriores' diz o total da sessão inteira" --tipo novo --motivo "decisão do usuário, 2026-11-14: Na linha +N (Recomendado)"
    npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::aberta a linha, com tudo desenhado, ela não repete o total" --tipo novo --motivo "decisão do usuário, 2026-11-14: Na linha +N (Recomendado)"

## 7. Documentação

`DESENVOLVIMENTO.md`: onde hoje se lê "o total da sessão inteira vai no `alt`" (seção "Desenho") e
"'Sessão inteira' fica só no tooltip" (seção "Só a visão resumida (2026-11-04)") e "sessão inteira: X de
Y no tooltip" (histórico do limite de linhas): acrescentar a decisão de 2026-11-14 (o total também na
linha "+N pedidos anteriores"); nas entradas de histórico, só a nota "(hoje: na linha do histórico e no
texto alternativo)". `CLAUDE.md`: no "Checklist do app", item do desenho nativo, acrescentar "o total da
sessão inteira na linha '+N pedidos anteriores'".

## 8. Golden

Não muda (nenhum cenário tem a linha).

## 9. Checklist do app

Numa sessão com pedidos escondidos: a linha "+N pedidos anteriores" mostra "sessão inteira: a de b" à
direita, legível nos dois temas e sem empurrar o ▸; num painel estreito, o título da linha não some (a
palavra da direita é que é cortada).

## 10. Dependências e conflitos

- Depois do lote 04 (a conta da sessão inteira numa função só) e do lote 05 (quem entra em "+N").
- Lotes 21 e 22 (corte de linhas): a linha `sec:turns` aberta é preservada pelo corte; a palavra da
  direita só existe com a linha fechada ou com diferença de total, e não muda a contagem de linhas.
- Triagem C, decisão 43 ("Ampliar o golden (Recomendado)"): se C criar um cenário de golden com pedidos
  escondidos, ele já nasce com a palavra na linha, se este lote vier antes.

## 11. Bloqueio

Nenhum. Leitura do planejador, sem bloquear: o exemplo da pergunta junta o total ao título com " · "; o
plano o põe na mesma linha, como a palavra da direita, para não mudar o título que 20 asserções cobertas
leem. Se o usuário quiser o texto colado ao título, é outro lote (muda o kit e esses testes, com selo de
decisão).
