# Lote 02 (triagem C): contagem de asserções pelos helpers do kit e pelas funções do arquivo

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`.

## 1. O que cobre

- Achado "A contagem de asserções ignora helpers do kit que afirmam (esperarPalavra, esperarCartaSob) e
  os helpers locais; testes selados contam zero". Correção direta.

## 2. Causa confirmada na ponta

- Escrito: `scripts/selos.mjs:22`, `ASSERCOES = ['expect', 'esperarEstado', 'esperarCarta', 'linha',
  'antes']`. `antes` não existe no kit. Em `task-tree/tests/kit/leitura.ts` também afirmam (chamam
  `expect` ou lançam erro com o painel): `esperarPalavra` (linha 341), `esperarCartaSob` (355) e
  `linhaDoApp` (208).
- Escrito: `scripts/selos.mjs:61-68`: a conta soma só as chamadas com esses nomes dentro do corpo do
  `test(...)`; o que uma função de topo do próprio arquivo afirma (ex.: `semAndamento` e
  `terminarTurno` em `tests/durabilidade.test.ts:257-272`, `conferir` em `tests/golden.test.ts:21`) não
  entra.
- Medido pela triagem (não refeito aqui): 12 dos 239 selos com `assercoes: 0`.
- Dedução: um teste que afirma só por esses caminhos pode perder todas as afirmações com selo de
  refatoração, contra a trava "as asserções não podem diminuir" do `CLAUDE.md`.

## 3. O que muda (`scripts/selos.mjs`)

- A lista dos nomes que afirmam deixa de ser fixa: é `expect` mais toda função exportada de
  `task-tree/tests/kit/leitura.ts` cujo corpo chama `expect(` ou tem `throw` (lida com o mesmo
  `typescript` que o script já usa). Com o kit de hoje dá: `linhaDoApp`, `linha`, `esperarEstado`,
  `esperarPalavra`, `esperarCartaSob`, `esperarCarta` (e as que vierem). `antes` sai.
- A conta de um teste passa a somar, além das chamadas diretas, as afirmações de cada função de topo
  do próprio arquivo que o corpo chama (uma vez por chamada, com alcance por outras funções de topo;
  ciclo cortado). Ex.: `semAndamento(p)` vale 2.
- Trava nova na conferência: falha quando um helper exportado de `kit/leitura.ts` afirma e não está na
  lista derivada (não deve acontecer, a lista é derivada; a trava protege a derivação de regredir para
  lista fixa) e quando um selo `refatoracao` ou `novo` tem contagem menor que a de `HEAD` (já existe).
- Passada de regravação: um modo `--recontar` que regrava só o campo `assercoes` de cada selo cujo
  hash confere com o teste atual, sem tocar `tipo`, `data`, `motivo` nem `hash`. Recusa quando algum
  teste selado está com hash diferente (aí o caminho é selar). Roda uma vez neste lote.
- A regra "menos asserções sem decisão" (`conferir`, linhas 191-195) continua comparando com o
  `selos.json` da base; como este commit só aumenta contagens, ela passa.
- Painel: nada muda.

## 4. Impacto

Nenhum arquivo do mod.

## 5. Testes de verificação (`scripts/travas.test.mjs`)

- "um helper do kit que afirma conta como asserção": na montagem, o kit ganha um `export function
  esperarX(...) { expect(...) }` e o teste `um` troca um `expect` por `esperarX`; selar como
  refatoração é aceito (a contagem não cai). Falha hoje: a contagem cai e o selo é recusado.
- "tirar a única chamada a um helper do arquivo que afirma é perda de asserção": o arquivo de teste da
  montagem ganha uma função de topo com dois `expect`, chamada pelo teste; tirar a chamada e selar como
  refatoração é recusado. Falha hoje: a função de topo não conta, e o selo passa.
- "--recontar só mexe em assercoes": depois de mudar a lista (helper novo no kit, selado), `--recontar`
  muda o número e mantém tipo, data, motivo e hash; com um teste de hash diferente, recusa.
A montagem das travas usa um kit de uma linha (`export const x = 1`): os casos acima escrevem o kit de
que precisam e o selam com `--kit`.

## 6. Catálogo e selos

- Nenhum cenário novo.
- `regras/selos.json`: regravado por `node scripts/selos.mjs --recontar`, no mesmo commit. O diff
  esperado mexe só em linhas `"assercoes"` (os 12 que estavam em zero e os que chamam helpers do
  arquivo sobem). Conferir no diff que nenhuma outra linha mudou.
- `regras/README.md`, "Selo dos testes e do kit": trocar a lista entre parênteses ("`expect`,
  `esperarEstado`, `esperarCarta`, `linha`, `antes`") por "`expect`, os helpers de `tests/kit/leitura.ts`
  que afirmam e as funções do próprio arquivo que o teste chama", e citar o `--recontar`.

## 7. Documentação

Só o `regras/README.md` acima.

## 8. Golden

Não muda (os 4 testes de golden passam a contar as afirmações de `conferir`, só o número do selo).

## 9. Checklist do app

Nada.

## 10. Dependências e conflitos

- Depois do lote 01, antes de qualquer lote do mod: os selos novos dos lotes seguintes já saem com a
  contagem certa.
- `regras/selos.json` é o arquivo que todo lote das três triagens regrava: este commit precisa entrar
  com a árvore limpa (nenhum teste mudado sem selo), senão o `--recontar` recusa.
- O lote 31 (selo por alcance transitivo) mexe nas mesmas funções (`testesDe`): vem depois e reaproveita
  o alcance por funções de topo feito aqui.

## 11. Bloqueio

Nenhum.
