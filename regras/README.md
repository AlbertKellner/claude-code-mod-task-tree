# Catálogo de regras (BDD)

Cada regra do painel é um cenário, num arquivo por área (o mesmo nome do arquivo de teste em
`task-tree/tests/`). Fica fora de `task-tree/` porque essa pasta é a que o marketplace publica.

## Formato

```markdown
### turnos.pendentes-seguem-pendentes
As pendentes seguem pendentes no fim do turno, na principal e nas filhas.

- Dado tarefas nunca iniciadas
- Quando o turno termina, normal ou com Esc
- Então elas seguem ○, nunca ✕, e o cabeçalho as conta

Origem: decisão do usuário, 2026-10-27 (desfaz "reaproveitar o interrompida", 2026-10-24); commit cd96021.
Estado: coberto
```

- **id**: `<área>.<frase-curta-em-kebab>`, estável, sem códigos numéricos.
- **Título**: uma frase com a regra.
- **Dado/Quando/Então**: em português, no que se vê no painel ou nos textos ao modelo, sem nomes de função.
- **Origem**: "decisão do usuário, AAAA-MM-DD", com as palavras dele entre aspas quando houver, ou
  "regra do painel", mais o commit que a implementou. Sem confirmação, "a confirmar". Origem nova cita
  o PR (`#NN`); o hash do commit é opcional e tem de existir no `main`.
- **Estado**:
  - `coberto`: há teste que cita o id;
  - `pendente (<arquivo de teste>)`: deve virar teste;
  - `checklist (<motivo>)`: só o app mostra.

Quando uma decisão nova muda a regra, o cenário é reescrito com a origem nova, citando o que ela
desfaz, e ganha uma linha `Reescrito:` antes do `Estado:`:

```markdown
Reescrito: 2026-10-28, decisão do usuário ("palavras dele").
```

O histórico fica no git.

## Ligação com os testes

O teste cita a regra num comentário na linha logo acima do `test(...)`, com um ou mais ids:

```ts
// Regra: turnos.pendentes-seguem-pendentes, turnos.iniciada-aguarda-no-fim
test('fim do turno com uma tarefa iniciada: ela aguarda e as outras seguem pendentes', ...)
```

`scripts/regras.mjs`, a primeira etapa do `npm run check`, falha quando: um id se repete ou tem
formato inválido; um cenário não tem `Estado:` válido; um cenário `coberto` não é citado por
nenhum teste; um teste cita um id que não existe; um teste cita um cenário `pendente` ou
`checklist`; um `test(` não tem `// Regra:` acima; ou uma chave do state do mod não tem linha na
tabela de durabilidade (e vice-versa).

## Selo dos testes e do kit

`regras/selos.json` guarda, para cada teste que cita uma regra `coberto`, o hash do corpo (sem
comentários nem espaços, com tudo o que ele alcança no arquivo: as declarações de topo que ele cita, as
que essas citam, e assim por diante) e o número de asserções (`expect`, os helpers de
`tests/kit/leitura.ts` que afirmam e as funções do próprio arquivo que o teste chama).
Cada arquivo de `tests/kit/` tem o seu hash, e também cada arquivo de apoio dos testes (o que está em
`tests/` sem ser teste, kit nem golden; hoje, `tests/fixtures/`): fica na mesma seção `kit` e se sela
pelo mesmo `--kit <arquivo>`. O campo `algoritmo` diz a versão do cálculo do hash (2 desde o alcance por
tabela); quando ele muda, `node scripts/selos.mjs --migrar` regrava os hashes dos selos que conferem pelo
algoritmo anterior, sem mexer em tipo, data, motivo, regras e asserções (com algum teste mudado sem selo,
recusa tudo). Contra uma base selada por outro algoritmo, a etapa `selos` e a `regressao` recalculam o
hash dos testes da base pelo algoritmo atual, e a comparação com a base segue valendo. Quando a contagem muda sem o teste mudar (um helper do kit
passou a afirmar), `node scripts/selos.mjs --recontar` regrava só o campo `assercoes` dos selos que
conferem com o teste; com algum teste mudado sem selo, ele recusa.

```json
"task-tree/tests/turnos.test.ts::Esc interrompe só a tarefa iniciada; as pendentes seguem pendentes": {
  "regras": ["turnos.esc-interrompe-so-a-iniciada"],
  "hash": "3f9c0a1b2c3d4e5f",
  "assercoes": 6,
  "tipo": "decisao",
  "data": "2026-10-27",
  "motivo": "decisão do usuário: pendentes nunca ✕"
}
```

Tipos:
- `novo`: teste novo (só para chave que não existia em `HEAD`), ou a linha de base;
- `decisao`: o comportamento esperado mudou por decisão do usuário; cada regra do teste precisa de
  `Reescrito:` com data igual ou posterior à do selo anterior;
- `refatoracao`: a forma mudou e nada do que se afirma; as asserções não podem diminuir.

Selar é um passo explícito, que aparece no diff de `selos.json`:

```bash
npm run regras:selar -- "<arquivo>::<nome>" --tipo decisao|refatoracao|novo --motivo "…"
node scripts/selos.mjs --kit <arquivo> --tipo refatoracao --motivo "…"
node scripts/selos.mjs --remover "<arquivo>::<nome>" --tipo decisao --motivo "…"
node scripts/selos.mjs --renomear "<chave antiga>" --para "<chave nova>" --tipo refatoracao|decisao --motivo "…"
node scripts/selos.mjs --novos --motivo "…"   # sela como "novo" os testes e o kit ainda sem selo
```

`--remover` (exige `Reescrito:` em cada regra, com data igual ou posterior à do selo) apaga o selo e
grava a chave em `removidos` (regras, data, motivo, a data do `Reescrito:` usado, o hash que saiu e o
tipo). `--renomear` leva o selo para a chave nova e grava a antiga em `removidos` com `para`:
`refatoracao` só para renome puro (o hash do corpo é o mesmo), `decisao` para corpo mudado, com a
exigência do `Reescrito:`. A etapa `regressao` aceita a falha do teste de `HEAD` cuja chave entrou em
`removidos` como decisão hoje (na CI, no PR); um renome de refatoração não libera nada. Um teste
selado de `HEAD` que não aparece na saída do `plugin test` ("TESTE DE <ref> NÃO RODOU") conta como
falha, com as mesmas liberações; um `--base` que não é commit do repositório é erro.

A etapa `selos` do `npm run check` confere os selos contra os de `HEAD` (ou `--base`) e falha quando:
um teste selado mudou sem selo novo; um teste coberto não tem selo; um teste selado sumiu; um selo de
`HEAD` foi apagado sem registro em `removidos`; um selo `refatoracao`/`novo` tem menos asserções que o
de `HEAD`; um teste que já existia ganhou hash novo com tipo `novo`; um selo `decisao` com hash novo
não tem `Reescrito:` desde a data do selo de `HEAD` (decisão sem `Reescrito:`); as asserções do selo
são diferentes das contadas no teste; ou um cenário do golden (os previstos, com `tests/golden.test.ts`
no repositório, e os de `HEAD`) sumiu do desenho ou do selo. A etapa `travas` testa essas regras num
repositório temporário.

## Mapa de código (matriz de impacto)

No topo de cada arquivo, depois do título e da descrição, os arquivos do mod que implementam a área;
num cenário, opcional, entre a `Origem:` e o `Estado:`, os que ele soma à área:

```markdown
Código da área: hooks/tool-call.ts, hooks/sessions.ts, hooks/panel.ts, state/tasks.ts

Origem: …
Código: draw/layout.ts, draw/desktop.tsx
Estado: coberto
```

- Caminhos relativos a `task-tree/`, separados por vírgula; granularidade por arquivo.
- O código efetivo de um cenário é o da área mais o próprio `Código:` (um só por cenário).
- O núcleo (`hooks/register.tsx`, `hooks/render.tsx`, `types/index.d.ts`) vive em `scripts/regras.mjs`,
  não no catálogo: tocá-lo afeta todos os cenários.
- Manutenção: quem cria um cenário ou um arquivo do mod atualiza o mapa. A etapa `regras` falha com
  caminho inexistente e avisa, sem falhar, com cenário coberto sem código ou arquivo fora do mapa.
- `npm run impacto` lê o mapa: arquivos tocados → cenários → testes → checklist do app → golden.

## Modelos

Brief da análise:

```markdown
### Brief para a Implementação
- Pedido e decisão do usuário (palavras dele, data).
- Cenários: novos / reescritos (com `Reescrito:`) / sem mudança que protegem a área.
- Matriz de impacto: a saída de `npm run impacto -- <arquivos que a mudança vai tocar>`.
- Testes existentes que vão mudar, e por quê (decisão de quem, quando). Nenhum outro pode mudar.
- Arquivos a escrever, de uma vez; commit sugerido.
- O que o usuário valida no app.
```

Relato da implementação:

```markdown
### Relato
- Commit: <hash> <título>.
- Os dois comandos abaixo rodam depois do commit local: sem mudança fora de commit, comparam o
  último commit (a primeira linha da saída diz a base).
- `npm run check`: <resumo das etapas>.
- `npm run testes:alterados`: <saída colada; "nenhum" se nenhum teste existente mudou>.
- `npm run impacto`: <saída sobre o diff real; divergência do previsto no brief, explicada>.
- Selos regravados: <chave, tipo, motivo>.
- Regressão (testes antigos × código novo): <ok | lista com a decisão de cada um>.
- Não verificado / para o checklist do app: <itens>.
```
