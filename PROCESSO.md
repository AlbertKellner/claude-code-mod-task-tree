# Processo de trabalho neste repositório

Decisão do usuário, 2026-11-14: o modo de trabalho fica neste repositório, não no `CLAUDE.md` global ("Aprovado").

Este arquivo diz COMO o trabalho é conduzido. O QUE o painel faz está no catálogo `regras/`; como
rodar e o que o check exige está no `CLAUDE.md`. Onde houver divergência, vale o `CLAUDE.md`.

## 1. Papéis

- **Orquestradora:** a sessão em que o usuário pede. Pergunta, registra as decisões, lança os agentes,
  confere cada commit (`git log`, `git status`) e relata. Não escreve código nem planos.
- **Planejador:** um agente por assunto. Só lê o código e escreve o plano. Não cria cópia, não roda
  testes, não escreve código nem diff. Pode rodar `npm run impacto -- <arquivos>`.
- **Implementador:** outro agente, nunca o mesmo que planejou. Escreve o código e os testes a partir do
  plano, valida e faz o commit local.
- Modelo e esforço de cada papel são escolhidos pelo usuário a cada rodada: a orquestradora confirma no
  início e registra cada troca. Uma troca vale a partir do próximo agente lançado.

## 2. Ordem de uma mudança

1. **Análise ou triagem**, quando há muitos achados: cada um vira "resolvido", "correção direta",
   "decisão do usuário" ou "não confirmado", conferido contra o código de hoje.
2. **Perguntas ao usuário** (seção 3), antes de qualquer plano que dependa delas.
3. **Plano**, um arquivo por lote, gravado assim que o lote fica pronto (nunca tudo no fim: um agente
   que trava não pode levar o trabalho junto), mais um índice dos lotes.
4. **Implementação**, um lote por vez (seção 4).
5. **Push e PR** só quando o usuário liberar ou quando o pedido já os incluir.

## 3. Perguntas e decisões

- Perguntas pelo `AskUserQuestion`, até 4 por vez, numeradas ("5/48").
- Cada pergunta se lê sozinha: diz o que acontece hoje, com um exemplo do painel, e o que cada opção
  muda. A recomendada vem primeiro, marcada "(Recomendado)". "Como hoje" é sempre uma opção.
- Resposta sem escolha, ou mensagem no lugar da resposta: não agir; perguntar de novo depois.
- Toda resposta é registrada na hora, com as palavras do usuário e a data, num arquivo de decisões.
  Esse arquivo é a fonte dos `Reescrito:` do catálogo e dos motivos dos selos.
- Interpretação própria de um agente que não contraria decisão registrada segue e é relatada. A que
  contraria, ou que derruba um teste protegido, para o lote e vira pergunta.
- A pergunta com os próximos passos só sai quando o desenvolvimento terminou, não há agente rodando e o
  passo seguinte depende do usuário.

## 4. Implementação de um lote

1. Árvore limpa e branch certa; se não, parar e relatar.
2. Cópia própria no scratchpad (`git clone` local da ponta). O clone real recarrega o mod a cada
   arquivo salvo, em todas as sessões.
3. Na cópia: os testes novos primeiro, com a prova de que falham no código de hoje pelo motivo do plano.
4. Na cópia: código, cenários, documentação e selos; `npm run check` inteiro.
5. Tudo ao clone de uma vez (`git diff --binary` e `git apply`).
6. No clone: `npm run testes:alterados` e `npm run impacto`, e o commit. O check não é repetido à mão:
   o hook de pré-commit roda as mesmas etapas. Exceção: quando o golden foi regravado no clone.
7. Commit só dos arquivos do lote (`git commit -F <msg> -- <caminhos>`), um por decisão do usuário; um
   lote de correções diretas pode ir num commit só. Nunca `git add -A`, nunca `--no-verify`, sem push.
8. O relato abre com o essencial em até 400 caracteres: hashes, check, prova na base, golden e o que
   ficou de fora. Depois, o que foi adaptado ou decidido fora do plano.

Um agente pode receber até três lotes em sequência, com o check verde entre eles. Se um lote falhar ou
tiver bloqueio, ele para nesse lote, guarda o patch parcial e relata.

## 5. Paralelismo

- Planejadores e triagens só leem: rodam em paralelo.
- Implementadores do mod rodam um por vez: todo lote grava em `regras/selos.json`, e quase todos tocam
  os mesmos arquivos de `task-tree/hooks/`.
- Lotes que só tocam `scripts/`, `.github/` e documentação podem ir numa trilha paralela, sempre pela
  cópia, passando pelo clone só para aplicar e fazer o commit.
- Dois agentes nunca rodam testes ao mesmo tempo (os testes têm 5 s cada). Antes de qualquer comando que
  rode testes, inclusive o commit, pega-se uma trava (uma pasta criada com `mkdir`), solta no mesmo
  comando de shell.
- Worktrees só a pedido do usuário.

## 6. Golden e testes protegidos

- O golden só é regravado com as palavras do usuário, entre aspas e com a data. Quando ele responde
  "validar só no fim", o implementador regrava citando essa resposta e o usuário vê tudo no app antes do
  merge.
- Teste existente só muda com decisão registrada: `Reescrito:` no cenário e selo de decisão.
- Regressão se corrige no código, nunca no teste.

## 7. Agentes que param ou somem

- Antes de relançar um agente que parece morto (máquina desligada, sessão reaberta, aviso de travamento),
  conferir o que ele deixou: arquivos de plano, `git log`, `git status` e a cópia dele. Um agente pode
  sobreviver ao desligamento e terminar depois.
- Se o agente antigo aparecer depois de relançado, parar o duplicado antes que ele escreva.
- Trabalho parcial de um agente descartado vai para `descartados\`, e nenhum outro agente o lê.
- Agente parado há muito tempo sem relato: conferir, não esperar.

## 8. Notas de trabalho

- Ficam fora do repositório, na pasta irmã `<repositório>-notas`, em arquivos `.local.md`, um autor por
  arquivo.
- Guardam o que envelhece: briefs, planos, triagens, decisões da rodada e relatos longos. Este arquivo
  guarda só o que vale para as próximas rodadas.

## 9. Curadoria deste arquivo

- Muda por PR, com a decisão do usuário citada (palavras e data), como o catálogo `regras/`.
- Uma regra por item; antes de acrescentar, procurar o item que já cobre o assunto e atualizá-lo.
- Regra desfeita sai do arquivo, não fica ao lado da nova.
- Ao fim de cada rodada grande, uma passada: o que foi decidido sobre o modo de trabalho entra, o que
  caducou sai.

## O que ficou fora, de propósito

- Estado do trabalho (lotes feitos, hashes, estimativas): fica nas notas.
- Regras de como o modelo usa o painel: ficam em `task-tree/text/rules.ts`.
- Caminhos desta máquina, contas e preferências pessoais: ficam na memória local ou no `CLAUDE.md`
  global do usuário.
