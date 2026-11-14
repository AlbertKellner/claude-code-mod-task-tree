# Correção do achado alto 12: os limites de 400 linhas e 600 KB não se conciliam, e o botão de voltar não faz nada

Branch `fix/achados-altos-auditoria`, sobre o HEAD `ba8209a`. Só planejamento: nada foi editado no repositório.
Ensaios em cópias no scratchpad (`a12` = sem decisão, `a12a` = opção (a)), com `npm run check` verde nas duas.

## BLOQUEIO

A correção do defeito em si depende da pergunta 27 da auditoria, ainda sem resposta. Pergunta exata:

> Quando o desenho padrão (sem nada aberto por você) passa de 600 KB, o que o painel deve mostrar:
> (a) cortar os blocos mais antigos até caber, sem aviso (Recomendada), ou
> (b) manter o aviso e fazer o botão mostrar só o que está em andamento?

Por que é decisão: as duas saídas mudam regras registradas. A (a) reescreve `cabecalho.limite-de-linhas-do-desenho`
("400 linhas" passa a "400 linhas e 600 KB") e tira o aviso do caminho comum, que foi a saída combinada em
2026-11-04. A (b) cria um desenho novo, "só em andamento", depois de o usuário ter tirado as visões no mesmo dia
("deixe somente a visão resumida").

O que entra sem decisão vai num diff separado: `correcao-alto-12.diff`. A opção (a) já foi ensaiada e está em
`correcao-alto-12-opcao-a.diff`, com marcadores no lugar das palavras do usuário. Os dois diffs são alternativos,
não se somam: a opção (a) já traz o que o diff sem decisão traz, reescrito.

## Reprodução (no harness, pelo código atual)

- Um pedido de 1 + 8 + 64 + 320 linhas (o `grande('T', 8, 8, 5)` do teste), com todas as folhas iniciadas, o relógio
  avançado e 200 delas concluídas, sem nada aberto pela pessoa: o app desktop mostra "Painel grande demais".
  Apertar `back` deixa o desenho idêntico, porque `closeOpened` só fecha chaves `false` e não há nenhuma.
- Medidas no harness, a 60 colunas: 394 linhas com títulos curtos e sem tempo dão 478 a 508 KB. Com tempo e títulos
  longos, 393 linhas dão 659 KB. O app real chegou a cerca de 950 KB (DESENVOLVIMENTO.md, "20 MB avaliado e desfeito").
- Com mais de 400 linhas, `limitRows` corta o bloco antigo inteiro e o desenho cai para cerca de 11 KB. Por isso o
  aviso só aparece na faixa "até 400 linhas, mais de 600 KB".

## Parte sem decisão: `correcao-alto-12.diff`

Cobre a regra que já existe, sem mudar o comportamento. `cabecalho.aviso-de-painel-grande-volta` estava em
`checklist` com um motivo desatualizado ("o aviso só aparece acima de 20 MB"). Com o limite em 600 KB, o harness
alcança o aviso.

Arquivos:
1. `task-tree/tests/cabecalho.test.ts`, com um teste novo no fim e uma linha `import { PROPS } from './kit/ambiente'`
   (import à parte, para não mexer nas linhas que os outros testes usam). Nenhum arquivo do kit muda.
   - Funções auxiliares locais: `noApp($)` monta o painel desktop, diz se ele virou o aviso e o tamanho, e aperta `back`.
   - `// Regra: cabecalho.aviso-de-painel-grande-volta`, teste `o aviso de painel grande, depois de abrir "+N pedidos
     anteriores", volta ao painel com eles fechados` (timeout de 15 s, como os outros testes grandes; roda em ~0,6 s).
   - Roteiro: `host(on, [])`. "Pedido um" é `grande('U', 8, 8, 5)` com `LONGO` nos títulos; as folhas são iniciadas,
     o relógio avança 65 s, tudo é concluído e o turno termina. Depois vem "Pedido dois" (Plano pequeno) com start em
     p1. Asserções:
     - no desktop, com o histórico fechado, não há aviso;
     - `comHistorico($, 1)` abre o histórico e o aviso aparece (659 KB, 7% acima do limite);
     - `back` tira o aviso;
     - no terminal, "+1 pedidos anteriores" aparece com ▸, U0 não aparece e "Pequeno um" está em andamento.
     São 6 asserções.
2. `regras/cabecalho.md`, em `cabecalho.aviso-de-painel-grande-volta`: `Estado: checklist (… 20 MB)` passa a
   `Estado: coberto`. A regra continua a mesma, sem `Reescrito:`.
3. `regras/selos.json`, com o selo `novo` do teste, feito por:
   `npm run regras:selar -- 'task-tree/tests/cabecalho.test.ts::o aviso de painel grande, depois de abrir "+N pedidos anteriores", volta ao painel com eles fechados' --tipo novo --motivo "…"`

Resultados:
- Impacto: `npm run impacto -- task-tree/tests/cabecalho.test.ts regras/cabecalho.md` não toca arquivo do mod, não
  afeta cenário, não entra no golden e não leva nada ao checklist.
- Check em `a12`: regras, travas, selos, os dois validate, tsc, plugin test (192 aprovados, 0 falhas) e regressão
  (191 testes de HEAD, 0 falhas), tudo ok.
- `testes:alterados`: nenhum teste existente mudou; um teste é novo.
- `git apply --check` sobre o HEAD atual passa.
- Checklist do app: o clique real em "Voltar à visualização anterior" e a pintura do aviso. O harness aperta pela
  chave e não vê nenhum dos dois.

Atenção: se o usuário escolher (a), este teste deixa de valer, porque o histórico aberto passa a ser cortado sem
aviso. Por isso o diff da opção (a) não o traz. Aplicar este diff antes da resposta obriga a uma reescrita como
decisão depois.

## Parte que depende da decisão

### Se a resposta for (a), ensaiada em `correcao-alto-12-opcao-a.diff`

1. `task-tree/draw/layout.ts`:
   - `limitRows(rows, max = MAX_ROWS)`;
   - `layout(model, choices, now, ownId, maxRows = MAX_ROWS)`, que passa o `maxRows` ao `limitRows`;
   - sem nenhuma outra mudança de lógica.
2. `task-tree/hooks/render.tsx`:
   - a IIFE do desenho vira `const draw = async (maxRows: number) => { … }`, com
     `layout(model, chosen, now, knownId(), maxRows)` dentro;
   - `MAX_ROWS` entra no import de `../draw/layout`;
   - depois do primeiro `draw(MAX_ROWS)`, até 4 novas tentativas enquanto `drawn.size > DRAW_LIMIT`, com
     `draw(floor(rows * DRAW_LIMIT * 0,95 / size))`;
   - o cabeçalho é recalculado a cada tentativa, então segue somando o desenhado (`cabecalho.numeros-somam-o-desenhado`);
   - o aviso continua como último recurso;
   - o terminal, bem abaixo de 600 KB, não muda.
3. `regras/cabecalho.md`:
   - `cabecalho.limite-de-linhas-do-desenho` muda o título e o Dado/Então para "400 linhas e 600 KB … o aviso não
     aparece" e ganha `Reescrito: <data>, decisão do usuário ("<palavras dele>")`, que desfaz o aviso como saída do
     desenho padrão (2026-11-04), e `Código: hooks/render.tsx`;
   - `cabecalho.aviso-de-painel-grande-volta` fica em `checklist (com o corte por tamanho, o aviso só aparece se uma
     linha sozinha passar de 600 KB; o harness não chega lá)`.
4. `task-tree/tests/cabecalho.test.ts`, com dois testes novos, `// Regra: cabecalho.limite-de-linhas-do-desenho`.
   As funções auxiliares locais são `noApp` (aviso, bytes, alts dos Svg) e `pedidoPesado`.
   - `sem nada aberto, um desenho acima de 600 KB perde os pedidos mais antigos até caber, sem aviso`. Uma folha do
     pedido um segue aberta e os dois pedidos ficam à vista. Esperado: sem aviso, até 600 KB, a linha
     "+N linhas anteriores" e "Pequeno um" no desktop; o terminal, inteiro.
   - `com "+N pedidos anteriores" aberto, o desenho acima de 600 KB também corta os mais antigos, sem aviso`.
   - Os dois falham no código atual (aparece o aviso) e passam com a correção. Os testes que já existem para
     `limite-de-linhas-do-desenho` (no terminal) continuam iguais.
5. Selos: `node scripts/selos.mjs --novos --motivo "…"` faz 2 selos `novo`. Nenhum teste selado muda e o golden fica
   igual (os 4 cenários passam).
6. Antes do commit, trocar os marcadores pelas palavras e pela data do usuário: o `Reescrito:` em
   `regras/cabecalho.md` e o comentário de `render.tsx` ("the person, <AAAA-MM-DD>: …").

Resultados:
- Check em `a12a`: tudo ok, com 193 aprovados, 0 falhas e regressão 191/0.
- `testes:alterados`: nenhum teste existente mudou; dois são novos.
- Impacto: `npm run impacto -- task-tree/hooks/render.tsx task-tree/draw/layout.ts` (o núcleo) afeta todos os
  cenários e entra nos 4 cenários do golden, que não mudaram.

Riscos e ajustes:
- Custo: um desenho grande demais é refeito de 2 a 5 vezes, e com uma tarefa rodando isso acontece a cada tique de 1 s
  do relógio. Melhoria opcional: lembrar o último `maxRows` que coube e começar por ele.
- O corte é o do `limitRows`: quando o último pedido sozinho passa do limite, o fim dele sai em "+N linhas". As
  tarefas em andamento que estiverem no fim podem sair também, e o mesmo já acontece hoje com 400 linhas. Se isso
  pesar ("eu quero ver as tarefas em andamento"), vira uma pergunta à parte. Não está no escopo deste achado.
- DESENVOLVIMENTO.md, linhas 1049 a 1051 (o texto sobre "≡ (/task-tree resumida)" e o "só se 400 linhas passarem
  disso"): corrigir no mesmo commit se o usuário quiser manter o "Como é hoje" (pergunta pendente da auditoria).

Checklist do app para (a):
- uma sessão grande (orquestradora) mostra o painel cortado com "+N linhas anteriores", sem aviso e sem travar;
- `/task-tree` mostra um desenho de até 600 KB;
- nos dois temas, a linha de contagem aparece no topo.

### Se a resposta for (b), não ensaiada

- Manter o aviso.
- `closeOpened`, sem nada aberto pela pessoa, liga uma marca de sessão (uma chave nova em `collapsed`, por exemplo
  `sec:busy`) que faz `layout` desenhar só os níveis 1 com folha em andamento (◉), seus pais e seus cartões vivos.
- A marca sai quando o desenho volta a caber, ou com um clique numa linha nova, "Mostrar tudo".
- Cenário novo em `cabecalho.md` com a origem na resposta, `cabecalho.aviso-de-painel-grande-volta` reescrito
  ("sem nada aberto, mostra só o que está em andamento") e o teste de `correcao-alto-12.diff` mantido, mais um teste
  para o caso sem nada aberto.
- Muda `hooks/render.tsx`, `draw/layout.ts` (o filtro) e `state/durability.ts`, se a chave nova exigir uma linha nele.

## Observação do ensaio

Na cópia, o `claude plugin validate` não gerou `task-tree/.claude-plugin/types/` e o tsc falhou por isso. Copiei a
pasta do clone (ela é ignorada pelo git). No clone isso não acontece.
