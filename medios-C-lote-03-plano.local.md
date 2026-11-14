# Lote 03 (triagem C): selos conferidos contra `HEAD`, registro de remoção e renome de teste

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`.

## 1. O que cobre

Dois achados, a mesma peça (a triagem manda desenhar juntos); correção direta, um commit:
- "A etapa selos não compara o selos.json com o de HEAD: editar o arquivo à mão passa em todo o check".
- "Remover ou renomear um teste por decisão, junto com a mudança de código, não tem saída na regressão".

Fora da ordem da triagem (que punha as travas por último): os lotes de decisão que tiram ou renomeiam
teste junto com o código não passam no hook sem este.

## 2. Causa confirmada na ponta

- Escrito, `scripts/selos.mjs:174-204` (`conferir`): o `selos.json` da base só entra na conta de
  asserções (191-195), e essa conta usa o número gravado no selo, não o contado no teste; a linha 184
  só olha as chaves que restaram no arquivo, então chave apagada junto com o teste não aparece; o tipo
  trocado à mão não é conferido contra o `Reescrito:`; cenário de golden apagado junto com o selo não
  gera problema (196-202).
- Escrito, `scripts/selos.mjs:240-248`: `--remover` apaga o selo e não deixa registro.
- Escrito, `scripts/regressao.mjs:83-96`: a falha de um teste da base só passa com selo de decisão na
  mesma chave (`liberaTeste`, `selos.mjs:169-171`) ou golden aprovado. Teste removido ou renomeado não
  tem chave: cai em "REGRESSÃO OU DECISÃO NÃO REGISTRADA".
- Dedução: o fluxo do `CLAUDE.md` (cenário reescrito, teste e código no mesmo commit) fica sem saída
  além do `--no-verify`, que o `CLAUDE.md` proíbe.

## 3. O que muda

`regras/selos.json` ganha uma quarta seção, `removidos`, por chave de teste:
`{ regras, data, motivo, reescrito (a data do `Reescrito:` usado), hash (o do selo que saiu), para? (a
chave nova, num renome), tipo (decisao | refatoracao) }`. `lerSelos`, `selosDeHead` e `gravar` passam a
levar a seção (ordenada, como as outras).

`scripts/selos.mjs`:
- `--remover "<chave>" --tipo decisao --motivo "…"`: como hoje (exige `Reescrito:` em cada regra, com
  data igual ou posterior à do selo), e grava a entrada em `removidos`.
- `--renomear "<chave antiga>" --para "<chave nova>" --tipo refatoracao|decisao --motivo "…"`: leva o
  selo para a chave nova (que precisa existir nos testes). `refatoracao`: só quando o hash do corpo é
  o mesmo do selo antigo (renome puro); `decisao`: corpo mudado, com a exigência do `Reescrito:`. Grava
  a chave antiga em `removidos` com `para` e `tipo`.
- `conferir`, contra o `selos.json` da base (`HEAD`, ou `--base`):
  - chave da base que não está mais em `testes` exige entrada em `removidos` ("selo apagado sem
    registro: <chave>");
  - chave que existia na base com hash diferente e tipo `novo` é erro;
  - hash diferente com tipo `decisao`: cada regra do selo precisa de `Reescrito:` com data igual ou
    posterior à do selo da base (a mesma regra do `--selar`, agora também na conferência);
  - o número `assercoes` do selo tem de ser o contado no teste, e a queda (selo `refatoracao`/`novo`)
    compara o contado com o da base;
  - todo cenário do golden previsto (a lista `CENARIOS`, que passa de `scripts/golden.mjs` para
    `scripts/selos.mjs` e é reexportada lá, para não criar importação circular) e todo cenário de
    golden da base precisa existir em `tests/golden/desenho.ts` e em `selos.golden`.
- Função exportada `liberaRemovido(agora, base, chave, data)`: verdadeiro quando a chave está em
  `agora.removidos` com tipo `decisao`, não estava nos `removidos` da base, e a data é a de hoje (ou,
  com `data` indefinida, a CI: basta ter vindo no PR). Renome `refatoracao` não libera (o teste da base
  tem de continuar passando contra o código novo).

`scripts/regressao.mjs`: na lista das falhas, antes de acusar regressão, aceita a chave liberada por
`liberaRemovido` ("- removido por decisão: <chave> (<motivo>)", ou "- renomeado por decisão: <chave> →
<para>").

Painel: nada muda.

## 4. Impacto

Nenhum arquivo do mod.

## 5. Testes de verificação (`scripts/travas.test.mjs`)

Com a montagem que já existe (repositório temporário, dois testes selados):
- "apagar um teste e o selo dele à mão falha": tira o teste `dois` e a entrada dele do `selos.json`;
  a conferência acusa "selo apagado sem registro". Falha hoje: passa.
- "remover com decisão deixa registro, e a regressão libera": `Reescrito:` no cenário, `--remover`;
  a conferência passa, `removidos` tem a chave, e `liberaRemovido` responde verdadeiro com a data de
  hoje e falso com a de ontem (como os casos de `liberaTeste`, linhas 208-231 do arquivo).
- "trocar à mão o hash e o tipo não passa": muda o corpo do teste `um`, escreve à mão o hash novo com
  tipo `novo`: erro; com tipo `decisao` sem `Reescrito:`: erro; com `Reescrito:` de hoje: passa.
- "o número de asserções escrito à mão não vale": troca `assercoes` no arquivo para um número maior;
  a conferência acusa.
- "apagar um cenário do golden junto com o selo falha".
- "renomear um teste leva o selo": troca o nome do teste `um`, `--renomear … --tipo refatoracao`; a
  conferência passa; com o corpo também mudado, `refatoracao` é recusada.
- O caso existente "remover um teste selado falha, e o selo só sai com decisão" continua valendo (as
  mensagens que ele confere ficam).
Nenhum teste do mod muda.

## 6. Catálogo e selos

- Nenhum cenário.
- `regras/selos.json`: ganha `"removidos": {}` na primeira gravação. Conferir que o resto do diff é
  vazio.

## 7. Documentação

- `regras/README.md`, "Selo dos testes e do kit": os comandos `--remover` (o que grava) e `--renomear`;
  a lista do que a etapa `selos` falha ganha "selo apagado sem registro", "tipo `novo` em teste que já
  existia", "decisão sem `Reescrito:`", "asserções do selo diferentes das contadas" e "cenário do
  golden sumido".
- `CLAUDE.md`, "Travas contra regressão": uma linha: tirar ou renomear um teste por decisão do usuário
  usa `--remover` ou `--renomear`, que deixam o registro que a etapa `regressao` aceita; o hook passa
  no mesmo commit do código.

## 8. Golden

Não muda. A lista de cenários só troca de arquivo.

## 9. Checklist do app

Nada.

## 10. Dependências e conflitos

- Depois do lote 02 (mexem em `scripts/selos.mjs` e em `travas.test.mjs`).
- Antes do lote 16 daqui (tira o par de testes do recap) e de qualquer lote das triagens A e B que tire
  ou renomeie teste. Enquanto este não entra, o contorno é em dois commits: primeiro o cenário, o
  teste e o selo; depois o código.
- O lote 27 (golden ampliado) acrescenta cenários à lista `CENARIOS`, no lugar novo dela.
- O lote 31 (alcance transitivo) mexe em `testesDe` e `extrair`, não nas regras de conferência daqui.

## 11. Bloqueio

Nenhum.
