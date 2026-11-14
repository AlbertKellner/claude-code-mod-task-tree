# Lote 03: o título do pedido é o do primeiro plan

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário).

## 1. O que cobre

- Achado "O request de qualquer plan renomeia o último turno, mesmo quando o plan não é o primeiro da
  mensagem ou vem depois de um aviso".
- Decisão 4, 2026-11-14: **"Não, vale o 1º (Recomendado)"**. A opção: "o pedido mantém o título que o
  primeiro plan deu; o seu pedido "Auditar o mod" não vira "Relato da auditoria" porque o modelo
  planejou a conferência do relato."

## 2. Causa confirmada na ponta atual

Escrito no código: `hooks/tools.ts:88-98`. Todo plan do loop principal com `request` não vazio troca o
`title` do último turno (`cur = { ...cur, title: request }`), sem saber se um plan anterior já o nomeou.
O último turno é o pedido aberto pela última mensagem que abre pedido; um aviso do app, um hand-back e a
mensagem no meio do turno não abrem turno (`hooks/prompt-submit.ts:81-137`), então o plan feito depois
deles renomeia o pedido em curso. Só o texto da mensagem no meio do turno pede "sem request"
(`text/rules.ts:140-141`); o código não garante.

Regra registrada: `pedidos.titulo-vem-do-request` cobre um request só; não diz qual vale com dois.

## 3. O que muda

`types/index.d.ts`, `hooks/tools.ts`, `text/rules.ts`.

- `Turn` ganha um campo opcional que diz que um plan já deu o título ao pedido (sugestão de nome:
  `named?: boolean`). Fica no state, no store e no arquivo publicado junto com o turno; leitores de
  versões antigas o ignoram (o arquivo passa `groups` como está).
- `planTool`: o `request` só troca o título quando o último turno ainda não tem a marca; ao trocar,
  grava a marca. Com a marca, o `request` é ignorado (o resto do plan segue igual). Sem turno nenhum
  (`cur === undefined`), o turno criado já nasce com a marca.
- O que conta como "primeiro": o primeiro plan do pedido que traz `request`. Um primeiro plan sem
  `request` deixa o título da mensagem, e o plan seguinte com `request` ainda nomeia (ele é o primeiro
  título dado).
- Pedido novo (mensagem que abre turno): o turno novo nasce sem a marca (`openTurn`,
  `hooks/panel.ts:172-190`, não muda), então o primeiro plan dele o nomeia.
- Turno gravado por versão anterior (sem o campo): o primeiro plan com `request` depois da atualização
  ainda pode renomear uma vez. Aceito.

Comportamento novo no painel: o grupo do pedido mantém o título do primeiro plan; um replano, ou o plan
feito depois do aviso de que uma filha terminou, com outro `request`, não muda a linha do pedido.

Textos ao modelo (`text/rules.ts`), texto exato:
- `RULES`, item do `request`: acrescentar ao fim "O título do pedido é o do primeiro plan: um `request`
  em outro plan da mesma mensagem não o troca."
- `TOOLS.plan`: acrescentar ao fim "Um request em outro plan do mesmo pedido não muda o título."
- `PROMPT.midTurn` não muda ("sem request: o pedido em curso mantém o título" passa a ser garantido).

## 4. Impacto

`npm run impacto -- hooks/tools.ts text/rules.ts types/index.d.ts`: `types/index.d.ts` é núcleo (todos os
159 cenários cobertos; o check roda todos). Sem o núcleo: `hooks/tools.ts` 31 cenários (pedidos 14,
arvore 9…), `text/rules.ts` 16 (lembretes 11…). Golden: os 4 cenários aparecem por causa do núcleo;
nenhum desenho muda (ver 8).

## 5. Testes a escrever

`tests/pedidos.test.ts`, regra `pedidos.titulo-vem-do-request`:
1. **"o request de outro plan do mesmo pedido não muda o título; o pedido seguinte ganha o seu"**.
   Roteiro: `const { relogio } = fixar(on)`; `pedido($, 'uma mensagem')`; `plan($, A, 'Auditar o mod')`;
   `plan($, B, 'Relato da auditoria')`. Afirma: há a linha "Auditar o mod", não há "Relato da
   auditoria", e "Plano B" está abaixo de "Auditar o mod" (índice maior, nível maior).
   Depois `fimDoTurno`; `aviso($)`; `plan($, [{ id: 'C', title: 'Plano C', children: [{ id: 'c1',
   title: 'Cê um' }] }], 'Conferir o relato')`: segue "Auditar o mod", sem "Conferir o relato".
   Depois `relogio.advance(1000)`; `pedido($, 'Pedido dois')`; `plan` de um nível 1 novo sem request e,
   em seguida, `plan` de outro nível 1 novo com `'Título dois'`: há a linha "Título dois" (o primeiro
   request do pedido novo vale) e "Auditar o mod" segue como estava (`comHistorico` se o pedido antigo
   tiver saído de vista; com "Plano A" e "Plano C" abertos ele fica à vista).
   Falha hoje: depois do segundo plan a linha do pedido vira "Relato da auditoria".

Testes existentes: nenhum muda (`grep` nos testes: só três chamam plan com request, uma vez cada:
`arvore.test.ts:23`, `golden.test.ts:40`, `pedidos.test.ts:15`).

## 6. Catálogo e selos

`regras/pedidos.md`, cenário reescrito:

```markdown
### pedidos.titulo-vem-do-request
O título do pedido vem do request do primeiro plan dele.

- Dado uma mensagem longa da pessoa
- Quando o modelo chama plan com request, e depois, no mesmo pedido (um replano, ou um plan depois de um aviso do app ou do relato de uma filha), outro plan com outro request
- Então a linha do pedido mostra o primeiro request, não o texto da mensagem nem o request do plan seguinte; o primeiro plan de um pedido novo dá o título dele

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Reescrito: 2026-11-14, decisão do usuário ("Não, vale o 1º (Recomendado)"); antes, o request de qualquer plan trocava o título. O teste existente não muda.
Estado: coberto
```

Selo:

```bash
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::o request de outro plan do mesmo pedido não muda o título; o pedido seguinte ganha o seu" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Não, vale o 1º (Recomendado)\""
```

## 7. Documentação

`DESENVOLVIMENTO.md`: na linha do `planTool` em "Os 14 hooks" (~109), dizer que o `request` só nomeia o
pedido uma vez (a marca no turno); entrada em "Decisões (histórico)". No comentário do tipo `Turn`
(`types/index.d.ts:47-57`), descrever o campo novo.

## 8. Golden

Não muda: o campo novo vive no turno, que não é desenhado; o cenário "principal" chama plan com request
uma vez por pedido. Se o check acusar mudança de desenho, é erro da implementação.

## 9. Checklist do app

Nada novo.

## 10. Dependências e conflitos

- Depois do lote 02 (mesma função, `planTool`; trechos diferentes).
- Lote 08 (pedido sem tarefa) mexe em `openTurn` e nos turnos sem tarefa: a marca deste lote vai no
  turno e não atrapalha.
- Triagem C: textos de `RULES` e `TOOLS.plan` (decisões 41 e 42 e as correções de texto) e o resultado
  do plan. Quem vier depois mantém as duas frases novas ou o sentido delas.
- Triagem B: nada em `planTool`.

## 11. Bloqueio

Nenhum.
