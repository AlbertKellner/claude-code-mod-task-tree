# Lote 31 (triagem C): selo por alcance transitivo e fixtures seladas

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos relativos ao repositório.

## 1. O que cobre

- Achado "O selo do teste não cobre o que ele usa por tabela: declarações de topo indiretas e arquivos
  importados fora do kit (fixtures)". Correção direta. Por último, das três triagens: muda o hash de
  quase todos os testes selados.

## 2. Causa confirmada na ponta

- Escrito, `scripts/selos.mjs:53` e `70`: o hash de um teste leva o corpo e as declarações de topo
  cujos nomes aparecem **no corpo**; o que essas declarações usam (outra constante, outra função do
  arquivo) fica fora.
- Escrito, `scripts/selos.mjs:114-122` (`extrair`): só `*.test.ts` e `tests/kit/` são selados;
  `task-tree/tests/fixtures/publicados.ts` não entra em selo nenhum.
- Escrito, `scripts/regressao.mjs:53-58`: a regressão copia `task-tree/tests` inteiro do commit de
  comparação, fixture incluída.
- Dedução: tirar dois formatos da fixture faz o teste dos "8 formatos"
  (`tests/durabilidade.test.ts:234-251`) conferir 6 com o mesmo hash; `selos`, `plugin test` e
  `regressao` passam sem selo e sem decisão. O mesmo com uma declaração alcançada só por outra (ex.:
  `terminarTurno` usa `A`, `semAndamento` e `temPainel` no mesmo arquivo).

## 3. O que muda

`scripts/selos.mjs`:
- `testesDe`: o conjunto de declarações que entra no hash é fechado por alcance: as que o corpo cita,
  as que essas citam, e assim até não crescer (o lote 02 já percorre as funções de topo para contar
  asserções; aqui o mesmo percurso vale para o hash, com constantes e tipos também).
- `extrair`: todo arquivo `.ts`/`.tsx` de `task-tree/tests` que não é teste, não é do kit e não é o
  golden (`tests/golden/`) é selado pelo arquivo inteiro, como o kit (hoje: `tests/fixtures/`). Fica
  na mesma seção `kit` do `selos.json` (a chave é o caminho) e usa o mesmo comando `--kit <arquivo>`.
- Versão do algoritmo do hash: um campo de topo no `selos.json` (`algoritmo`, 2 a partir daqui). Na
  conferência, quando a versão do arquivo difere da versão do `selos.json` da base, as comparações de
  hash **com a base** (as do lote 03: tipo `novo` com hash diferente, decisão sem `Reescrito:`) são
  puladas naquele commit; as comparações com os arquivos atuais valem sempre.
- Modo de migração `--migrar`: para cada teste selado, calcula o hash pelo algoritmo antigo e pelo
  novo; se o selo guardado é o antigo, grava o novo mantendo `tipo`, `data`, `motivo`, `regras` e
  `assercoes`; se o selo não bate com o antigo (teste mudado sem selo), recusa tudo e lista. Grava
  `algoritmo: 2` e sela como `novo` os arquivos de apoio que ainda não têm selo. Roda uma vez, neste
  commit.

`task-tree/tests/durabilidade.test.ts`, no teste dos formatos: uma afirmação a mais, o número de
formatos da fixture (8). É acréscimo de asserção: selo de refatoração.

Painel: nada muda.

## 4. Impacto

Nenhum arquivo do mod.

## 5. Testes de verificação (`scripts/travas.test.mjs`)

- "mudar uma constante usada só por outra declaração do teste falha": o arquivo da montagem ganha uma
  função de topo que usa a constante `B` e é chamada pelo teste `um`; mudar `B` faz a conferência
  acusar o teste. Falha hoje: o caso existente "mudar uma constante de topo usada pelo teste falha;
  uma não usada, não" mostra que `B` não conta.
- "mudar uma fixture sem selar falha": a montagem ganha `task-tree/tests/fixtures/x.ts`, importada
  pelo teste; mudar o arquivo acusa "o kit mudou sem selo novo" (ou a mensagem equivalente para
  apoio); selar com `--kit` resolve. Falha hoje.
- "--migrar regrava o hash e mantém tipo, data e motivo": a montagem selada pelo algoritmo antigo
  (um `selos.json` escrito à mão com os hashes antigos, ou gerado por uma função exportada do
  algoritmo antigo) migra; com um teste mudado antes, recusa.
- "com o algoritmo da base diferente, a conferência não acusa os hashes migrados; com o mesmo, acusa".
- O caso existente "mudar uma constante de topo usada pelo teste falha; uma não usada, não" continua
  valendo como está.

## 6. Catálogo e selos

- Nenhum cenário novo.
- Comandos, nesta ordem, com a árvore limpa (nenhum teste mudado sem selo):
  1. `node scripts/selos.mjs --migrar`
  2. (depois de acrescentar a afirmação no teste dos formatos)
     `npm run regras:selar -- "task-tree/tests/durabilidade.test.ts::os 8 formatos do arquivo publicado: cada filha aparece, com as tarefas do formato" --tipo refatoracao --motivo "afirma o número de formatos da fixture"`
- O diff esperado de `regras/selos.json`: o campo `algoritmo`, o `hash` de quase todos os testes, a
  entrada nova de `task-tree/tests/fixtures/publicados.ts` na seção `kit`, e o selo do teste dos
  formatos. Nenhum `tipo`, `data` ou `motivo` muda fora desse último.
- `regras/README.md`, "Selo dos testes e do kit": o hash cobre o corpo e tudo o que ele alcança no
  arquivo; os arquivos de apoio de `tests/` (fixtures) são selados como o kit; o `--migrar` e o campo
  `algoritmo`.

## 7. Documentação

`regras/README.md` (acima) e a linha de "Travas contra regressão" do `CLAUDE.md` que fala do kit:
"um arquivo do kit **ou de apoio dos testes (fixtures)** mudou sem selo".

## 8. Golden

Não muda (o golden tem selo próprio, por cenário).

## 9. Checklist do app

Nada.

## 10. Dependências e conflitos

- Depois dos lotes 02 e 03 (mesmo script e mesmas travas).
- **Último commit de teste e selo da branch, das três triagens**: enquanto houver lote que mexa em
  teste, este espera. Um lote que entrar depois sela normalmente (já pelo algoritmo novo).
- Na CI com `--base` (hoje desligada), o PR desta rodada terá o algoritmo diferente do da base: as
  comparações de hash com a base ficam puladas para o PR inteiro. É um afrouxamento só desse PR; a
  etapa `regressao` (os testes da base contra o código novo) continua valendo.
- A sobra do achado resolvido dos testes de pedidos e sessões (uma fixture feita de um recorte de um
  arquivo real de `task-tree-waits`): se alguém a criar, nasce selada por este lote.

## 11. Bloqueio

Nenhum.
