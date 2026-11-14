# docs-task-tree · fase 5 (DESENVOLVIMENTO.md reescrito a partir do código)

Sessão `docs-task-tree`, 2026-10-22. Branch `docs/fase-5-desenvolvimento` sobre a `main` `152da41`.

## O que foi feito

`task-tree/DESENVOLVIMENTO.md` (985 → 1 361 linhas, CRLF mantido; `git diff --stat`: +417 −18, as 18
remoções são só títulos que desceram um nível):

1. Intro mantida.
2. `## Como é hoje` (novo, ~370 linhas, escrito a partir do código em `152da41`): Módulos (um a um,
   com linhas de `wc -l`), Os 14 hooks (tabela: evento, filtro, função/arquivo, efeito), Fluxo de
   dados (`change`/`persist`; o `tool.call` genérico em handlers; o prompt; as sessões filhas em 4
   passos; relógios; publicação), Estado e durabilidade (as três camadas e a tabela `TABLE` inteira,
   com as duas linhas sobrando: `drawNow` e `breaksMemo` não têm mais variável), Arquivo publicado
   (versão 1: caminho, ordem das 16 chaves, regras de `parsePublished`, os 8 formatos do fixture),
   Textos para o modelo, Desenho (pipeline e os dois desenhos), Testes e como rodá-los (comandos, 13
   arquivos × contagem = 316, fixtures, goldens, baseline, regras, o kit), Limites do kit (7),
   O que só é verificável no app (9 itens).
3. `## Rodar o mod a partir do clone`: a seção local do usuário, byte a byte igual (conferido por diff).
4. `## Decisões (histórico)`: todo o texto anterior (de "Estrutura" a "Pendências"), na íntegra, com
   os títulos um nível abaixo e um parágrafo de abertura dizendo que os códigos R6/H3.2 são dos
   relatórios de `docs/analises/`.

## Conferência

- 506 identificadores entre crases na parte nova checados contra `task-tree/**/*.ts|tsx|json|mjs`:
  os 10 sem correspondência são nomes de arquivo com hífen e pseudo-código (`clamp(…)`, `hookOf()`).
- Nenhuma linha do texto antigo ausente no novo (script comparou linha a linha).
- Contagens batem: 14 hooks em `register.tsx`, 15 chaves de `$.state` no contrato, 14 em `panel.ts`,
  7 `$.state.get` em `publishPanel`, 12 cenários no golden do SVG, 23 textos no golden dos textos,
  8 formatos em `publicados.ts`, 316 testes (63+166+14+13+11+9+8+7+7+6+4+4+4).

## Não feito / limites

- Nada visual mudou: SVG não avisado.
- Testes não rodados por mim (só documentação; os 316 são da fase 4, etapa 3).
- As seções antigas seguem citando "no `register.tsx`" e os códigos de relatório: ficaram no
  histórico como estavam, de propósito ("sem apagar nada").
- Sem commit. `scripts/` e `docs/analises/` continuam sem versionar; a seção local do usuário está
  dentro do mesmo diff de `DESENVOLVIMENTO.md` (quem commitar decide com `git add -p` ou commita junto).
