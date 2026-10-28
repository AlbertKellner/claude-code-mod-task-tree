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

Origem: decisão do usuário, 2026-10-27 (desfaz "reaproveitar o interrompida", 2026-10-24); commit d57807e.
Estado: coberto
```

- **id**: `<área>.<frase-curta-em-kebab>`, estável, sem códigos numéricos.
- **Título**: uma frase com a regra.
- **Dado/Quando/Então**: em português, no que se vê no painel ou nos textos ao modelo, sem nomes de função.
- **Origem**: "decisão do usuário, AAAA-MM-DD", com as palavras dele entre aspas quando houver, ou
  "regra do painel", mais o commit que a implementou. Sem confirmação, "a confirmar".
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
`checklist`; ou um `test(` não tem `// Regra:` acima.

## Selo dos testes e do kit

`regras/selos.json` guarda, para cada teste que cita uma regra `coberto`, o hash do corpo (sem
comentários nem espaços, com as declarações de topo que ele usa) e o número de asserções (`expect`,
`esperarEstado`, `esperarCarta`, `linha`, `antes`). Cada arquivo de `tests/kit/` tem o seu hash.

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
node scripts/selos.mjs --novos --motivo "…"   # sela como "novo" os testes e o kit ainda sem selo
```

A etapa `selos` do `npm run check` falha quando: um teste selado mudou sem selo novo; um teste
coberto não tem selo; um teste selado sumiu; um arquivo do kit mudou sem selo; ou um selo
`refatoracao`/`novo` tem menos asserções que o de `HEAD`. A etapa `travas` testa essas regras num
repositório temporário.

## Modelos

Brief da análise:

```markdown
### Brief para a Implementação
- Pedido e decisão do usuário (palavras dele, data).
- Cenários: novos / reescritos (com `Reescrito:`) / sem mudança que protegem a área.
- Impacto: arquivos → cenários → testes; itens do checklist do app.
- Testes existentes que vão mudar, e por quê (decisão de quem, quando). Nenhum outro pode mudar.
- Arquivos a escrever, de uma vez; commit sugerido.
- O que o usuário valida no app.
```

Relato da implementação:

```markdown
### Relato
- Commit: <hash> <título>.
- `npm run check`: <resumo das etapas>.
- `npm run testes:alterados`: <saída colada; "nenhum" se nenhum teste existente mudou>.
- Selos regravados: <chave, tipo, motivo>.
- Regressão (testes antigos × código novo): <ok | lista com a decisão de cada um>.
- Não verificado / para o checklist do app: <itens>.
```
