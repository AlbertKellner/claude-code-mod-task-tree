# Lote 01 (triagem C): relato depois do commit local, `testes:alterados` e `impacto`

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos de script relativos ao repositório.

## 1. O que cobre

- Achado "npm run testes:alterados e npm run impacto comparam com HEAD: depois do commit local, que o
  fluxo manda fazer antes do relato, os dois respondem 'nenhum'". Correção direta, sem decisão.

## 2. Causa confirmada na ponta

- Escrito: `scripts/alterados.mjs:14` começa com `base = 'HEAD'` e só troca com `--base` ou `--pr`
  (linhas 15 a 21); a linha 39 imprime "a base do PR (<hash>)" para qualquer base que não seja `HEAD`,
  mesmo quando veio de `--base` sem ser PR.
- Escrito: `scripts/impacto.mjs:71-76`: sem arquivos soltos nem `--base`, a lista é `git diff
  --name-only HEAD` mais os não rastreados. Com a pasta de trabalho igual a `HEAD` (logo depois do
  commit local), a lista é vazia.
- Escrito: `CLAUDE.md` ("O relato da implementação cola a saída de `npm run testes:alterados`…") e o
  modelo de relato de `regras/README.md:127-135` começam pelo hash do commit e não dizem quando rodar.
- Dedução: como o fluxo do projeto manda o commit local antes do relato, o relato sai sempre "nenhum".

## 3. O que muda

- `scripts/mudou.mjs` (onde já vivem as leituras do git usadas pelo hook e pelas travas): uma função
  exportada que responde qual é a base do relato num repositório: `HEAD` quando o índice ou a pasta de
  trabalho diferem de `HEAD` (qualquer caminho rastreado, e os não rastreados fora do `.gitignore`), e
  o commit anterior (`HEAD~1`) quando não diferem; sem commit anterior, `HEAD`. Recebe o `env` como
  `alteradosNoIndice` já recebe (as travas rodam sem as variáveis `GIT_*`).
- `scripts/alterados.mjs`: sem `--base` nem `--pr`, usa essa função. A primeira linha da saída diz a
  base de verdade: "desde HEAD" (há mudança fora de commit), "do último commit (<hash curto> contra
  <hash curto do anterior>), porque não há mudança fora de commit", "desde a base do PR (<hash>)" só
  com `--pr`, e "desde <ref>" com `--base`. Quando a base é o commit anterior, o "depois" continua
  sendo a pasta de trabalho (igual a `HEAD`), então nada mais muda no script.
- `scripts/impacto.mjs`: sem arquivos soltos nem `--base`, quando a lista de `HEAD` contra a pasta de
  trabalho vem vazia, usa `git diff --name-only HEAD~1 HEAD` e acrescenta uma primeira linha dizendo
  isso ("Sem mudança fora de commit: impacto do último commit, <hash curto>"). `texto()` e `impacto()`
  não mudam; a linha a mais sai só na linha de comando.
- A CI não muda: ela passa `--base`.
- Comportamento do painel: nenhum. Só os scripts de relato.

## 4. Impacto

Nenhum arquivo do mod. `npm run impacto` não tem o que listar (scripts ficam fora do mapa).

## 5. Testes de verificação

Em `scripts/travas.test.mjs` (etapa `travas`, com a montagem de repositório temporário que já existe):
- "a base do relato é HEAD com mudança fora de commit e o commit anterior sem ela": na montagem
  (um commit "base"), sem mudança, a função responde `HEAD` (não há commit anterior); depois de mudar
  o corpo de um teste e commitar, responde o commit anterior; depois de mudar de novo sem commitar,
  responde `HEAD`. Falha hoje: a função não existe.
- "o impacto, sem mudança fora de commit, lista os arquivos do último commit": opcional, se a parte
  que escolhe a lista virar função exportada de `impacto.mjs`; se ficar só na linha de comando, basta
  o teste acima.
Nenhum teste do mod muda. Nenhum selo.

## 6. Catálogo e selos

Nenhum cenário (scripts de relato não têm cenário no catálogo). Nenhum comando de selo.

## 7. Documentação

- `regras/README.md`, modelo "Relato da implementação": uma linha depois de "Commit:": os dois
  comandos rodam depois do commit local e, sem mudança fora de commit, comparam o último commit (a
  primeira linha da saída diz a base).
- `CLAUDE.md`, seção "Como executar", onde cita `npm run testes:alterados`: acrescentar "(depois do
  commit local, compara o último commit)". Seção "Travas contra regressão", última linha: idem para o
  `npm run impacto` do relato.

## 8. Golden

Não muda.

## 9. Checklist do app

Nada.

## 10. Dependências e conflitos

- Primeiro lote da triagem C: melhora o relato de todos os lotes seguintes, das três triagens.
- Não roda em paralelo com lote do mod (todo lote do mod sela testes em `regras/selos.json`, e a etapa
  `travas` do hook roda quando `scripts/` muda).
- Conflito: nenhum com as triagens A e B (não tocam `scripts/`).

## 11. Bloqueio

Nenhum.
