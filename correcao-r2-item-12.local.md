# Correção do achado alto 12: desenho acima de 600 KB perde os blocos mais antigos em vez de virar o aviso

Diff pronto, sem bloqueio: `correcao-r2-item-12.diff` (nesta pasta), feito contra `b02a9a9` + itens 1 e 2.
`npm run check` na cópia: as 8 etapas ok, 199 testes aprovados, regressão 196 de HEAD com 0 falhas. Golden não muda.
Nada foi escrito no repositório real. Substitui `correcao-alto-12-opcao-a.diff`; não somar com ele nem com
`correcao-alto-12.diff`.

## Decisão do usuário

2026-11-12, palavras dele: "Cortar os mais antigos (Recomendado)". Acima de 600 KB o desenho padrão perde os blocos
mais antigos até caber, sem aviso, com "+N linhas anteriores" no topo; o aviso fica só como último recurso.

## Causa, confirmada no código (base `b02a9a9` + itens 1 e 2)

- `task-tree/draw/layout.ts`, `limitRows`: corta só por contagem (`MAX_ROWS` = 400). Nada olha o tamanho.
- `task-tree/hooks/render.tsx`, fim do `render`: mede o JSON do desenho e, acima de `DRAW_LIMIT` (600 KB), troca o
  painel inteiro pelo aviso "Painel grande demais", com o botão que chama `closeOpened`.
- `closeOpened` só fecha chaves marcadas `false` em `collapsed` (o que a pessoa abriu). Sem nada aberto, não muda nada,
  e o aviso volta igual.
- Os dois limites não se conciliam: 393 linhas de títulos longos com tempo dão 650 a 659 KB no harness, a 60 colunas
  (o app real chegou a cerca de 950 KB). Os três testes novos falham na base com o aviso na tela.

## O que mudou em relação ao diff ensaiado da opção (a)

O diff antigo aplicava limpo na base atual, mas foi refeito nestes pontos:

1. Erro do diff antigo: ele punha o `Reescrito:` e o `Código: hooks/render.tsx` também em
   `cabecalho.interrompida-fora-do-total`, cenário que não tem nada com isso. Saiu. Só
   `cabecalho.limite-de-linhas-do-desenho` ganha o `Reescrito:`.
2. Marcadores trocados pelas palavras e pela data do usuário, no catálogo e no comentário de `render.tsx`.
3. O laço de tentativas tinha teto de 4 e podia terminar no aviso com um corte possível ainda por tentar (linhas de
   tamanhos muito diferentes). Agora termina sempre: três tentativas pela média de bytes por linha e, depois, no máximo a
   metade das linhas, até 2. O aviso só sobra se um desenho de duas linhas ainda passar de 600 KB.
4. Cada tentativa relia o state inteiro (11 leituras com espera). Agora o `render` lê o state uma vez e só a parte sem
   leitura nem espera (layout, cabeçalho e desenho) é repetida, numa função `paint(maxRows)`. As tentativas passam a ser
   síncronas: nenhum outro desenho se intercala, e todas partem do mesmo estado.
5. Melhoria opcional incluída: o `maxRows` que coube fica lembrado (ver "Lembrar o corte que coube").
6. Um terceiro teste, para o caso mais comum na prática: um pedido só, grande demais.
7. `DESENVOLVIMENTO.md` corrigido no mesmo diff.

## Passos (arquivos do diff)

1. `task-tree/draw/layout.ts`
   - `limitRows(rows, max = MAX_ROWS)`: o mesmo corte, com o limite que vier. Para `max` de 2 ou mais, o resultado nunca
     passa de `max`.
   - As duas linhas de contagem ("+N linhas anteriores" e "+N linhas") ganham o campo `cut` (quantas linhas tiraram), e
     o tipo `Row` ganha `cut?: number`. O desenho não usa o campo: nenhum SVG muda.
   - `layout(model, choices, now, ownId, maxRows = MAX_ROWS)` repassa o `maxRows` ao `limitRows`. Nenhuma outra lógica muda.
2. `task-tree/hooks/render.tsx`
   - A função anônima que envolvia o desenho inteiro sai. As leituras do state ficam no corpo do `render`, e do
     `layout()` para baixo vira `const paint = (maxRows: number) => { … }`, sem `await` dentro. O corpo não foi
     reindentado (como já era), para o diff ficar pequeno.
   - `sized(maxRows)` pinta e mede (`drawn.size`).
   - Mapa de módulo `fitted` (chave: superfície e largura; valor: o `maxRows` que coube e as linhas que o painel tinha).
   - Sequência: pinta com o `maxRows` lembrado, ou com 400. Se havia lembrado e o desenho não coube ou o painel tem
     outras linhas, esquece e pinta de 400. Enquanto passar de 600 KB e o limite for maior que 2, pinta de novo com menos
     linhas. Coube com menos de 400: lembra. Ainda acima de 600 KB: o aviso, como hoje.
   - O cabeçalho é recalculado a cada pintura, então segue somando o que está desenhado
     (`cabecalho.numeros-somam-o-desenhado`).
3. `task-tree/hooks/panel.ts`: só o comentário de `DRAW_LIMIT` (dizia que acima do limite o painel mostra só o aviso).
   Se esse trecho colidir com outro item, pode ser deixado de fora sem efeito no comportamento.
4. `task-tree/DESENVOLVIMENTO.md`
   - "Como é hoje", seção "Desenho": a frase do `limitRows` e o item que dizia "um desenho acima de 600 KB vira uma
     linha de aviso" passam a descrever o corte por tamanho, a função `paint` e o `fitted`.
   - "Estado e durabilidade": `fitted` entra na lista de variáveis de módulo (sem linha na tabela; a recarga zera).
   - Seção nova no fim, "Corte por tamanho no lugar do aviso (2026-11-12)", com as palavras do usuário. O texto do
     histórico (os três limites e o texto antigo do aviso) fica como era, como as outras seções datadas fizeram.
5. `regras/cabecalho.md`, `regras/selos.json`, `task-tree/tests/cabecalho.test.ts`: abaixo.

## Cenários

- Reescrito: `cabecalho.limite-de-linhas-do-desenho`.
  - Título: "O desenho tem no máximo 400 linhas e 600 KB; o que passa vira uma linha de contagem."
  - Dado: "um painel com mais de 400 linhas, ou um desenho acima de 600 KB, com ou sem algo aberto pela pessoa".
  - Então: o mesmo de antes, mais "o aviso 'Painel grande demais' não aparece: ele fica só para o desenho que, reduzido
    a duas linhas, ainda passa de 600 KB".
  - `Reescrito: 2026-11-12, decisão do usuário ("Cortar os mais antigos (Recomendado)"); acima de 600 KB o desenho perde
    os blocos mais antigos até caber, sem aviso; desfaz o aviso como saída do desenho grande (2026-11-04), que fica só
    como último recurso.`
  - Ganha `Código: hooks/render.tsx`. Estado: segue `coberto`.
- Sem mudança de regra, só o motivo do estado: `cabecalho.aviso-de-painel-grande-volta` continua `checklist`. O motivo
  antigo estava errado ("o aviso só aparece acima de 20 MB"). O novo diz que, com o corte por tamanho, abrir
  "+N pedidos anteriores" não leva mais ao aviso, e que nem o harness nem uma sessão comum chegam a ele.
- Nenhum cenário novo. Nenhum outro cenário muda.

## Testes

Três testes novos em `task-tree/tests/cabecalho.test.ts`, todos `// Regra: cabecalho.limite-de-linhas-do-desenho`, com
`timeoutMs: 15000` como os outros testes grandes (rodam em cerca de 1 s cada). Nenhum teste existente muda e nenhum
arquivo do kit muda. Entra uma linha `import { PROPS } from './kit/ambiente'`, à parte, para não mexer nas linhas de
import que os outros testes usam.

Auxiliares locais do arquivo: `noApp($)` monta o painel do app desktop e devolve se virou o aviso, o tamanho, os textos
alternativos e as duas linhas de contagem; `pedidoPesado` faz um pedido de 1 + 8 + 64 + 320 linhas com títulos longos e
tempo (menos de 400 linhas, mais de 600 KB: o corte que os testes veem é o do tamanho); `pedidoPequeno` faz o pedido
dois.

1. `sem nada aberto, um desenho acima de 600 KB perde os pedidos mais antigos até caber, sem aviso` (7 asserções)
   - Dois pedidos à vista, sem a pessoa abrir nada.
   - No app: sem aviso, até 600 KB, a linha "+N linhas anteriores" e "Pequeno um" à vista.
   - Um segundo depois (o relógio redesenha): sem aviso, e a mesma linha "+N linhas anteriores".
   - No terminal, bem abaixo do limite, o desenho segue inteiro.
2. `com "+N pedidos anteriores" aberto, o desenho acima de 600 KB corta os mais antigos, sem aviso, e volta inteiro quando ela fecha` (7 asserções)
   - Com o histórico fechado, nada é cortado. Aberto: sem aviso, até 600 KB, "+N linhas anteriores" e "Pequeno um".
   - Fechado de novo: o corte some e o desenho volta inteiro. É o que protege o corte lembrado de ficar preso.
3. `um pedido só acima de 600 KB é desenhado até caber e fecha com "+N linhas", sem aviso` (6 asserções)
   - Sem aviso, até 600 KB, sem "+N linhas anteriores", a última linha é "+N linhas", e a primeira folha (U0.0.0) está lá.

Os três falham na base (o aviso aparece) e passam com a correção. Conferido rodando o arquivo com o `render.tsx` e o
`layout.ts` da base.

## Comandos de selo

O diff já traz os três selos em `regras/selos.json`. Se o arquivo colidir com outro item, aplicar o resto do diff
(`git apply --exclude=regras/selos.json …`) e selar de novo, no Git Bash, na raiz do repositório:

```bash
M='achado alto 12 da auditoria: acima de 600 KB o desenho perde os blocos mais antigos até caber (decisão do usuário, 2026-11-12: "Cortar os mais antigos (Recomendado)")'
npm run regras:selar -- 'task-tree/tests/cabecalho.test.ts::sem nada aberto, um desenho acima de 600 KB perde os pedidos mais antigos até caber, sem aviso' --tipo novo --motivo "$M"
npm run regras:selar -- 'task-tree/tests/cabecalho.test.ts::com "+N pedidos anteriores" aberto, o desenho acima de 600 KB corta os mais antigos, sem aviso, e volta inteiro quando ela fecha' --tipo novo --motivo "$M"
npm run regras:selar -- 'task-tree/tests/cabecalho.test.ts::um pedido só acima de 600 KB é desenhado até caber e fecha com "+N linhas", sem aviso' --tipo novo --motivo "$M"
```

Atalho, se não houver outro teste sem selo na árvore: `node scripts/selos.mjs --novos --motivo "$M"`.
Não há selo `decisao` nem `refatoracao` neste item, nem selo de kit.

## Resultado do check na cópia

`npm run check`, todas as etapas, binário 2.1.321:

```
ok    regras           (137 cobertas, 0 pendentes, 16 checklist; mapa: 137 cobertos com código, 0 avisos)
ok    travas           (19 de 19)
ok    selos            (199 testes, 3 arquivos do kit, 4 desenhos)
ok    validate do marketplace
ok    validate do mod
ok    tsc
ok    plugin test      (199 aprovados, 0 falhas, 15 arquivos)
ok    regressao        (196 testes de HEAD contra o código novo, 0 falharam)
```

Depois desse check só mudaram duas frases de texto (uma no catálogo, uma quebra de linha no `DESENVOLVIMENTO.md`); as
etapas `regras` e `selos` foram rodadas de novo e passaram.

`npm run testes:alterados`:

```
Testes existentes alterados desde HEAD: nenhum

Novos: task-tree/tests/cabecalho.test.ts::sem nada aberto, um desenho acima de 600 KB perde os pedidos mais antigos até caber, sem aviso | task-tree/tests/cabecalho.test.ts::com "+N pedidos anteriores" aberto, o desenho acima de 600 KB corta os mais antigos, sem aviso, e volta inteiro quando ela fecha | task-tree/tests/cabecalho.test.ts::um pedido só acima de 600 KB é desenhado até caber e fecha com "+N linhas", sem aviso
```

`git apply --check` do diff passa num clone novo da base (`b02a9a9` + itens 1 e 2) e também em `b02a9a9` puro. Aplicado
num clone novo, o resultado é idêntico à cópia do ensaio.

## Impacto

`npm run impacto` sobre o diff:

- Arquivos do mod tocados: `draw/layout.ts`, `hooks/panel.ts`, `hooks/render.tsx`.
- Núcleo tocado (`hooks/render.tsx`): todos os 141 cenários contam como afetados; o check roda todos.
- `cabecalho.limite-de-linhas-do-desenho`: 5 testes (2 que já existiam, 3 novos).
- Golden: os 4 cenários entram na lista (`visual.desenho-principal`, `-cartao-filha`, `-envios`, `-subagente`) e
  nenhum desenho mudou: `tests/golden.test.ts` passa sem `golden:aprovar`. Um painel abaixo de 600 KB é pintado uma vez,
  com as mesmas linhas de antes.
- Fora do mapa: nenhum.

## Lembrar o corte que coube (a melhoria opcional, incluída)

Sem ela, um painel grande demais seria pintado 2 vezes ou mais a cada tique de 1 s do relógio. Entrou porque ficou
pequena e não depende de nada que o validate restrinja: é um `Map` de módulo em `render.tsx`, sem `$`, sem chave de
state, sem escrita no render.

- Regra de uso: o `maxRows` lembrado só vale se o desenho feito com ele couber e o painel tiver o mesmo número de
  linhas de quando foi lembrado. Qualquer diferença recomeça de 400. A chave é a superfície mais a largura.
- Medidas no harness, com a contagem de pinturas numa cópia instrumentada (a instrumentação não está no diff):
  - três pedidos de cerca de 125 linhas à vista: a primeira vez pinta 2 vezes (375 linhas, 630 KB; depois 251 linhas,
    422 KB, com "+125 linhas anteriores"); cada tique seguinte, 1 vez;
  - um pedido só de 393 linhas: 650 KB, depois 344 linhas e 569 KB, com "+50 linhas" no fim; cada tique seguinte, 1 vez;
  - o terminal do mesmo painel (154 a 161 KB) é pintado 1 vez, inteiro, e não mexe no que o app lembrou;
  - outra largura: recomeça de 400 (2 pinturas) e lembra à parte;
  - uma pintura de 340 a 400 linhas pesadas levou de 15 a 60 ms nessa máquina, conforme a carga; a medição do tamanho,
    1 a 3 ms.
- Limite conhecido: com o mesmo número de linhas e linhas mais leves que antes, o corte lembrado continua valendo e pode
  tirar um pouco mais do que o necessário, até o painel mudar de linhas. Nunca mostra desenho acima do limite.

## Riscos

- O corte é por bloco inteiro (um pedido e o que pende dele), como o das 400 linhas. Com dois pedidos à vista e o mais
  antigo enorme, o antigo sai inteiro, mesmo com tarefa aberta nele (no ensaio: 397 linhas viraram 5, com "+393 linhas
  anteriores"). É a regra decidida ("blocos inteiros do começo"), e já era assim acima de 400 linhas.
- Com um pedido só, o que sai é o fim dele ("+N linhas"), onde podem estar as tarefas em andamento. Também já era assim
  com 400 linhas. Se pesar, vira pergunta à parte ao usuário; fora do escopo deste achado.
- A estimativa usa a média de bytes por linha. Com linhas de tamanhos muito diferentes, o corte pode tirar mais que o
  necessário (não faz tentativa para cima). Caso extremo testado à mão: um título de 700 KB numa folha reduz o desenho
  a 2 ou 3 linhas, sem aviso.
- O aviso e o botão "Voltar à visualização anterior" continuam no código, mas ficaram praticamente inalcançáveis: nem um
  título de 700 KB chega a eles, porque o desenho de duas linhas cabe. O botão segue sem efeito quando não há nada
  aberto. Tirar o aviso ou o botão seria desfazer a decisão de 2026-11-04 e não está no diff; se o usuário quiser, é
  pergunta nova.
- Com o histórico aberto e cortado, a linha "+N pedidos anteriores" (que fecha o histórico) é a primeira a sair, porque
  fica no topo. No app, a pessoa não tem onde clicar para fechar; o painel fica como se estivesse fechado, com
  "+N linhas anteriores" no lugar. Já era assim no corte das 400 linhas (o teste existente confirma). Antes desta
  mudança, o caso de 600 KB caía no aviso, cujo botão fechava o histórico.
- Quando o aviso aparece, `drawn.size` e `drawn.rows` (ditos pelo `/task-tree` e publicados) passam a ser os da última
  tentativa (2 linhas), não os do desenho inteiro.
- `hooks/render.tsx` é núcleo: a mudança de estrutura (leituras fora, `paint` síncrono) foi feita sem trocar a ordem de
  nenhuma instrução do caminho comum, e a regressão (196 testes de HEAD) passou.

## Checklist do app (validação visual do usuário, depois do commit local)

- Numa sessão grande (a orquestradora, por exemplo), o painel aparece cortado, com "+N linhas anteriores" no topo ou
  "+N linhas" no fim, sem o aviso "Painel grande demais" e sem travar.
- `/task-tree` diz "Desenho: N KB de 600 KB." com N abaixo de 600.
- Com uma tarefa rodando (relógio a cada segundo), o painel cortado não pisca nem muda de corte sozinho.
- Abrir "+N pedidos anteriores" numa sessão com histórico grande: o painel segue no ar, cortado, sem aviso.
- As linhas de contagem aparecem certas nos dois temas.
- Um painel comum (abaixo de 600 KB) fica igual ao de antes.

## Arquivos que o diff toca (para prever colisões)

| Arquivo | Onde |
|---|---|
| `regras/cabecalho.md` | `cabecalho.aviso-de-painel-grande-volta` (linha do `Estado:`) e `cabecalho.limite-de-linhas-do-desenho` |
| `regras/selos.json` | três chaves novas de `cabecalho.test.ts` (refazíveis pelos comandos acima) |
| `task-tree/DESENVOLVIMENTO.md` | "Estado e durabilidade" (lista de variáveis de módulo), "Desenho" (duas passagens) e uma seção nova no fim do arquivo |
| `task-tree/draw/layout.ts` | `limitRows` e o comentário de `MAX_ROWS`, o tipo `Row` (campo novo no fim), a assinatura e a última linha de `layout` |
| `task-tree/hooks/panel.ts` | só o comentário acima de `DRAW_LIMIT` (dispensável) |
| `task-tree/hooks/render.tsx` | import de `MAX_ROWS`, o mapa `fitted` depois de `closeOpened`, o começo do `render`, a linha do `layout()` e o trecho da medição do tamanho |
| `task-tree/tests/cabecalho.test.ts` | uma linha de import e os auxiliares e três testes no fim do arquivo |

Colisões prováveis com outros itens: `regras/selos.json`, o fim de `DESENVOLVIMENTO.md` (se outro item também
acrescentar seção datada) e o fim de `cabecalho.test.ts` (se outro item acrescentar teste ali).

## Para o implementador

- Os três arquivos do mod entram juntos (`git apply` do diff inteiro), para a recarga a quente não pegar estado
  intermediário; `npm run check` antes do commit.
- Commit sugerido: `fix(task-tree): desenho acima de 600 KB perde os blocos mais antigos em vez de virar o aviso`.
- O golden não muda: não rodar `golden:aprovar`.
- Ensaio: cópia no scratchpad desta sessão de planejamento, pasta `r2-item-12` (base `4dc3ed6`, que é `b02a9a9` mais o
  diff dos itens 1 e 2). A pasta `task-tree/.claude-plugin/types/` foi copiada do repositório real antes do check (só
  leitura dele; não conferi se o validate a geraria sozinho na cópia).
