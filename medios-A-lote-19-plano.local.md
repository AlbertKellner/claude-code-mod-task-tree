# Lote 19: cartão da rodada largada: "substituída", cinza

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário).

## 1. O que cobre

- Achado "Cartão de rodada descartada é desenhado como "trabalhando" ou "parada" e conta como sessão no
  cabeçalho: a mesma filha aparece em dois cartões sem dizer qual vale" (a contagem no chip é a parte
  direta, no lote 16).
- Decisão 12, 2026-11-14: **"\"Substituída\", cinza (Recomendado)"**. A opção: "Com palavra própria,
  "substituída", em cinza e fora do chip de sessões: fica claro qual cartão vale; as tarefas dele seguem
  desenhadas e fora da contagem, como hoje."

## 2. Causa confirmada na ponta atual

Escrito no código, `draw/layout.ts`:
- `layout.ts:474` (`split`): todo cartão com tarefa aberta de uma sessão rodando sai `running`.
- `layout.ts:1249-1252` (`session`): o tom e a palavra do cartão vêm de `live`, `archived`, `settled` e
  `parked`; nenhum olha se o cartão é de uma rodada largada. Com a filha rodando, o cartão largado tem o
  busto âmbar e nenhuma palavra; com ela parada, diz "parada", igual ao cartão que vale.
- `layout.ts:156-161` (`discarded`): a rodada largada é o cartão que não é o da frente e ficou com tarefa
  aberta; ela já sai da contagem.

Regras registradas que a decisão toca: `sessoes.palavra-de-estado-do-cartao` (a lista de palavras,
2026-11-04) e `sessoes.um-cartao-por-mensagem` (2026-10-21), que não muda.

## 3. O que muda

`draw/layout.ts`, `types/index.d.ts` (um campo só de desenho em `Child`).

- `split` marca o cartão de rodada largada: a parte que veio **antes** da rodada da frente (pelo critério
  do lote 16) e ficou com tarefa aberta, de sessão não arquivada. Campo novo só de desenho (sugestão:
  `replaced?: boolean`), como `lead` e `part`.
  - A parte que veio depois da rodada da frente e ainda não começou (a mensagem nova que espera a vez)
    não é marcada: ela não foi largada.
  - O cartão da frente de uma sessão parada com Esc não é marcado: segue "parada"
    (`sessoes.filha-parada-com-esc-sem-pendente`).
- `session`, para o cartão marcado: a palavra é "substituída"; o tom é o do cartão parado (`paused`: busto
  cinza), também com a sessão rodando; sem negrito; sem `live` (fora do chip, já pelo lote 16) e sem
  `pending`. O anel de contexto, o modelo e o git seguem como nos outros cartões da sessão.
- As linhas de dentro do cartão não mudam (as tarefas seguem desenhadas como hoje, fora da contagem).
- `draw/desktop.tsx` não precisa mudar: a palavra do cartão já sai cinza quando não é "aguardando"
  (`desktop.tsx:211-216`), e o busto segue o tom (`sessionState`, `draw/svg.ts:140-141`).

Comportamento novo no painel: duas mensagens à mesma filha, de tarefas diferentes, e ela larga uma tarefa
aberta da primeira ao passar à segunda: o cartão da primeira mostra o busto cinza e a palavra
"substituída"; o da segunda segue como o cartão que vale (trabalhando, "parada", "concluída").

## 4. Impacto

`npm run impacto -- draw/layout.ts types/index.d.ts`: núcleo tocado: todos os 159 cenários cobertos.
Golden: os 4; ver 8.

## 5. Testes a escrever

`tests/sessoes.test.ts`, regra `sessoes.rodada-largada-diz-substituida` (nova):
1. **"o cartão da rodada largada diz "substituída", com a filha rodando e parada; o da rodada atual
   segue como o que vale"**. Roteiro: o de `duasRodadas`, escrito no teste para ter o `h` (a rodada 1 com
   "f1" concluída e "f1b" iniciada; a rodada 2 com "f2" iniciada).
   Afirma, com `const cs = p.filter(l => l.sessao && l.titulo === 'filha-um')`: `cs[0].texto` contém
   "substituída"; `cs[1].texto` não contém "substituída" nem "parada"; `cabecalho(p).chips.ativas` 1;
   "f1" e "f1b" seguem desenhadas no primeiro cartão. Depois `h.filha(K1).rodando = false` e `aviso`:
   `cs[0]` segue com "substituída" e sem "parada"; `cs[1]` contém "parada"; o total do cabeçalho segue 4.
   Falha hoje: o primeiro cartão não tem palavra com a filha rodando e diz "parada" com ela parada.

Testes existentes: nenhum muda (`sessoes.test.ts:203` e `:374` usam `duasRodadas` e afirmam contagem e
tarefas, não a palavra; os de `sessoes.palavra-de-estado-do-cartao` não têm rodada largada).

## 6. Catálogo e selos

`regras/sessoes.md`:

```markdown
### sessoes.rodada-largada-diz-substituida
O cartão da rodada que a filha largou diz "substituída", em cinza.

- Dado duas mensagens à mesma filha, de tarefas diferentes, e a filha larga uma tarefa aberta da primeira ao passar à segunda
- Quando o painel é desenhado, com a filha rodando ou parada
- Então o cartão da primeira mostra a palavra "substituída" e o busto cinza, sem contar como sessão ativa; as tarefas dele seguem desenhadas e fora da contagem (sessoes.rodada-descartada-fora-da-contagem); o cartão da rodada atual segue com o estado da filha; a rodada mais nova que ainda espera a vez não é "substituída"

Origem: decisão do usuário, 2026-11-14 ("\"Substituída\", cinza (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (dois cartões com o mesmo nome, sem dizer qual vale).
Código: draw/desktop.tsx, draw/svg.ts
Estado: coberto
```

`sessoes.palavra-de-estado-do-cartao`: a lista do "Então" ganha "substituída" (a rodada largada), com a
linha `Reescrito: 2026-11-14, decisão do usuário ("\"Substituída\", cinza (Recomendado)"): a palavra
"substituída". Os testes existentes não mudam.`

Selo:

```bash
npm run regras:selar -- "task-tree/tests/sessoes.test.ts::o cartão da rodada largada diz \"substituída\", com a filha rodando e parada; o da rodada atual segue como o que vale" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"\\\"Substituída\\\", cinza (Recomendado)\""
```

## 7. Documentação

`DESENVOLVIMENTO.md`: o trecho das palavras do cartão (~1305-1308) e o de `split`; o checklist do
`CLAUDE.md` ("sessões filhas reais (cartão, ✉ e entrega, filha parada e arquivada)") ganha "rodada
substituída".

## 8. Golden

Não muda: nenhum cenário do golden tem cartão dividido em rodadas. O desenho novo (palavra e busto
cinza num cartão de sessão rodando) não está no golden; a ampliação do golden é a decisão 43 da triagem
C.

## 9. Checklist do app

- Uma filha real com duas mensagens de tarefas diferentes, largando uma tarefa da primeira: o cartão
  antigo com o busto cinza e "substituída" em cinza, nos dois temas; o chip conta 1 sessão.

## 10. Dependências e conflitos

- Depois do lote 16 (a rodada da frente pelo tempo; o `live` só no cartão da frente) e do lote 17.
- Lote 09 acrescenta "falhou" e este "substituída" à mesma expressão da palavra do cartão
  (`layout.ts:1252`): ordem sugerida das palavras: "aguardando", (trabalhando: nenhuma), "arquivada",
  "substituída", "encerrada", "falhou", "parada", "concluída".
- Lote 20 (um cartão só para os turnos digitados) refaz as partes digitadas em `split`.
- Triagem B: "a mesma carta aparece em todos os cartões de rodada" mexe em `split`; decisão 30 (faixa com
  só a filha trabalhando) lê as linhas `live`. Triagem C: decisão 43 (ampliar o golden) pode incluir este
  cartão.

## 11. Bloqueio

Nenhum.
