# Correção do achado alto 11: linha "+N pedidos anteriores" fantasma no cartão de filha parada

Sem BLOQUEIO. O diff está pronto e foi ensaiado numa cópia sobre o HEAD 07c8b26. `npm run check` passou inteiro: 191 testes, regressão com 190 testes de HEAD e 0 falhas, golden sem mudança. Diff: `<notas>\correcao-alto-11.diff`. O `git apply --check` passou num clone novo e no repositório real, que continua limpo.

## O defeito, reproduzido

Três filhas paradas, cada uma com um turno só: K1 com um pai aberto e só pendente embaixo, K2 com uma folha iniciada, K3 com um pai aberto e parada com Esc. No HEAD, o teste novo falha assim:

```
   ├─ ◉ Um  ◍  0/2  0:00
   │     ◍ filha-um  parada
   │     ▸ +1 pedidos anteriores ⋯
   │     ○ Pai um  0/1
   │     └─ ○ Filho um
   ├─ ◉ Dois  ◍  0/2  0:01
   │     ◍ filha-dois  parada
   │     ▸ +1 pedidos anteriores ⋯
   │     ◷ Começada  0:00
   └─ ◉ Três  ◍  0/1  0:00
           ◍ filha-tres  parada
           ▸ +1 pedidos anteriores ⋯
           ○ Pai três  0/1
           └─ ○ Filho três
```

Causa:
- `trimToWork` (layout.ts:741-776) monta o painel do cartão com `panelOf(c)` e grava `tasks` (o `keep`) e `whole` com os mesmos objetos.
- Depois, `session()` (layout.ts:1175) chama `panelOf(c)` de novo sobre esse painel já cortado. O `halt` recria o objeto de todo pai aberto e de toda folha iniciada e aberta, mas só em `tasks`: o `whole` continua com os objetos da primeira passada.
- `body()` compara os dois por identidade (`!recentOnly.includes(t)`, layout.ts:1364). O resultado é `left = 1`, e a linha é desenhada sem nada escondido. Aberta, ela desenha `whole`, que tem o mesmo conteúdo.

Com uma folha só pendente, o `halt` devolve o mesmo objeto e a linha some. Com uma folha iniciada e Esc, a primeira passada já deixa ✕ e a segunda não recria. O pai aberto, com ou sem Esc, recria sempre.

O teste existente "filha parada: a iniciada aguarda e as pendentes seguem pendentes" já desenhava a linha fantasma, mas não a conferia.

## Decisões respeitadas (nenhuma muda)

- `cabecalho.limites-de-linhas` ("Os pedidos fora do trabalho viram '+N pedidos anteriores'"): a linha continua aparecendo quando um pedido da filha sai do desenho. O teste "o turno próprio da filha…" (`sessoes.test.ts:372`), que cita essa regra, segue verde.
- `cabecalho.historico-guarda-o-que-saiu` e `cabecalho.historico-abre-com-clique` (2026-11-04: "Ficam em '+N pedidos anteriores' (Recomendado)"; 2026-11-03: "Sim, fechado por padrão (Recomendado)"): nada muda no que a linha guarda nem em como ela abre.
- `visual.secao-sem-traco` (2026-11-09: "Tirar de todas (Recomendado)"): a pintura da seção não muda (`svg.ts` não é tocado).
- `sessoes.palavra-de-estado-do-cartao`, `sessoes.filha-parada-pendentes-seguem-pendentes` e `sessoes.filha-parada-com-esc-sem-pendente` (achado 10, marca `halted`): `halt`, `leftOpen`, `discarded` e `parked` não mudam. No teste, os três cartões dizem "parada" e K3, parada com Esc, sai da contagem ("Três 0/1"), como no achado 10.
- Nenhum teste selado muda, e o golden também não. `npm run testes:alterados` deu "Testes existentes alterados desde HEAD: nenhum".

## Passo a passo

1. `task-tree/draw/layout.ts`, em `body()`, por volta das linhas 1363-1388:
   - O que fica à vista passa a ser comparado por id: `const shown = new Set(recentOnly.map(t => t.id))`, `const out = whole.filter(t => !shown.has(t.id))` e `const left = new Set(out.map(t => t.turn ?? -1)).size`.
   - O `away` dos cartões soltos, no nível 0, passa a usar o mesmo `out`: `flat(out).map(t => t.id)`. Ali `drawn === recentOnly`, então o resultado não muda.
   - O comentário diz por que a comparação é por id.
   - Os ids de nível 1 são únicos no grupo: o `plan` renomeia com prefixo todo id reusado que não é replano (`tools.ts:67` e `79`).
   - Não muda o desenho com a linha aberta (`drawn = whole`), nem o `halt`, nem o `panelOf`.
   - Vale para todos os níveis, netas inclusive, porque `body()` é o mesmo em todos.
2. `task-tree/tests/sessoes.test.ts`: teste novo, logo depois do teste do achado 10 ("a filha parada com Esc sem pendente…"):
   - `// Regra: sessoes.cartao-parado-sem-pedidos-anteriores-a-mais`
   - `test('o cartão da filha parada não mostra "+N pedidos anteriores" sem nada fora do desenho')`
   - Montagem: três filhas (K1, K2 `local_2222…` e K3 `local_3333…`, declaradas dentro do teste), abertas de "Um", "Dois" e "Três" do plano A3. Todas param (`rodando=false`) e K3 recebe `aborted=true`.
   - O teste afirma: nenhuma linha com "pedidos anteriores"; o cartão de K1 com `['Pai um', 'Filho um']`, o de K2 com `['Começada']` e o de K3 com `['Pai três', 'Filho três']`; e "parada" nos três cartões.
   - No HEAD, o teste falha com o painel acima. Com a correção, passa.
3. `regras/sessoes.md`: cenário novo `sessoes.cartao-parado-sem-pedidos-anteriores-a-mais`, entre `filha-parada-com-esc-sem-pendente` e `rodada-descartada-fora-da-contagem-do-pai`, com estado `coberto` e `Código: draw/layout.ts`.
   - Origem: a auditoria de 2026-11-10, aplicando `cabecalho.limites-de-linhas` e `cabecalho.historico-guarda-o-que-saiu` sem mudar nenhuma das duas, no mesmo padrão do achado 10.
   - O cenário fica em `sessoes.md` porque o teste está em `sessoes.test.ts`: cada área tem o mesmo nome do arquivo de teste.
4. Selo: `npm run regras:selar -- 'task-tree/tests/sessoes.test.ts::o cartão da filha parada não mostra "+N pedidos anteriores" sem nada fora do desenho' --tipo novo --motivo "auditoria 2026-11-10, achado alto 11"`.
   - No diff, o selo tem a data 2026-11-11, o hash 248169b9efc52c6b e 4 asserções.
   - Se o nome ou o corpo do teste mudar, é preciso selar de novo.
5. Aplicar de uma vez, por causa da recarga a quente: `git apply <notas>\correcao-alto-11.diff` grava os 4 arquivos juntos.
   - Depois, rodar `npm run check` e fazer o commit local só destes caminhos: `regras/selos.json`, `regras/sessoes.md`, `task-tree/draw/layout.ts` e `task-tree/tests/sessoes.test.ts`.
   - Título sugerido: `fix(task-tree): cartão da filha parada sem "+N pedidos anteriores" fantasma`.

## Impacto

`npm run impacto -- task-tree/draw/layout.ts` deu o mesmo resultado que o diff real:
- 92 cenários afetados (toda a área de `layout.ts`). O check roda todos os testes.
- Golden: visual.desenho-principal, -cartao-filha, -envios e -subagente. O teste de golden passou sem mudança no desenho.
- Checklist do app listado pelo impacto: cabecalho.aviso-de-painel-grande-volta, subagentes.cartao-no-app, subagentes.lancados-juntos-no-app e ultracode.cor-e-corte. Nenhum deles muda com isto.
- O que muda de visual: o cartão de uma filha parada (normal ou com Esc) com pai aberto ou folha iniciada perde a linha "▸ +1 pedidos anteriores". Para validar no app, usar uma filha real parada à espera de sinal, como a "auditoria-mod" do print, nos dois temas.

## Saída do check (cópia, código novo)

```
ok regras · ok travas · ok selos · ok validate do marketplace · ok validate do mod · ok tsc · ok plugin test (191 pass, 0 fail) · ok regressao (190 testes de HEAD contra o código novo, 0 falharam)
```

Notas do ensaio:
- A cópia foi um clone no scratchpad. Copiei para ela o `node_modules` e `task-tree/.claude-plugin/types/` do repositório real, pelo mesmo motivo da nota do achado 10.
- O binário usado foi `%APPDATA%\Claude\claude-code\2.1.321\…\claude.exe`, o mais novo, que é o que o `binario.mjs` escolhe.

## Efeito lateral e relação com outros achados

- **Efeito lateral (não contradiz decisão, só para saber):**
  - Dentro de um cartão (nível > 0), um cartão de neta sem âncora só é desenhado com a linha de pedidos anteriores aberta (`cutHistory`, layout.ts:1566-1568).
  - Num cartão parado, a linha fantasma era, por acaso, um jeito de abrir e ver uma neta solta. Sem ela, esse cartão passa a se comportar como o de uma filha trabalhando ou concluída, que já não tinha a linha.
  - Isso é o achado médio "Cartão sem âncora some do painel quando a filha conclui, e sem a linha '+N pedidos anteriores' não há como vê-lo" (auditoria, por volta da linha 814), que continua em aberto e não depende disto.
  - Nenhum teste cobre esse caso, e `cabecalho.limite-de-cartoes-antigos` diz que, com a linha fechada, cartões parados sem origem não aparecem.
- **Achado 10:** independente. A marca `halted` e `leftOpen` não são tocados, e o teste novo fica logo depois do teste dele.
- **Pergunta 14 da auditoria** ("substituída") e **pergunta 15** ("Interrompida"): também não dependem disto. A correção não mexe na palavra nem na contagem do cartão.
