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
desfaz. O histórico fica no git.

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
