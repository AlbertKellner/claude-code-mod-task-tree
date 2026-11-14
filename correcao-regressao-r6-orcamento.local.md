# correcao-regressao · R6 — fixture do estado real + teste de orçamento

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Item 1 da fase 1 do
`docs/analises/04-plano-de-aprofundamento.md`. 2026-10-22.

## O que entrou

- `task-tree/tests/fixtures/orquestradora-real.ts` (494 KB): cópia de
  `docs/analises/medicoes/fixture-real.ts` com o cabeçalho reescrito (origem, conteúdo, como
  regenerar). Estado da orquestradora em 2026-10-21 23:46: 97 níveis 1, 70 pedidos, 5 filhas,
  arquivos das filhas (240 KB), títulos anonimizados. `export const REAL`.
- `task-tree/tests/orcamento.test.ts`: um teste. Monta o host como a bancada fazia (store com
  `session:`/`work:`/`view:`/`links:` da orquestradora, `list_sessions` com as 5 filhas, `fs.read`
  devolvendo os arquivos do fixture), roda `session.start`, espera 100 ms a leitura das filhas, e
  mede as 4 combinações superfície × visão (bodyColumns 100, 5 desenhos cada):
  - `size` = `JSON.stringify(ui.drawn()).length`;
  - `lines` = linhas do painel (terminal: filhos do Box raiz; desktop: `Svg` com `alt` não
    interativo);
  - `svgs` = todos os `Svg`, inclusive camadas de tooltip;
  - `ms` = mediana de parede mount+drawn.
  Afirma: não é o desenho de emergência nem erro; `lines > 10`; `size`, `lines`, `svgs` ≤
  baseline × 1,5; `ms < 500`. Imprime `ORCAMENTO …` no log do kit com os números medidos.

## Baseline (HEAD 6d79470, kit 2.1.308, 3 execuções)

| combinação | size | lines | svgs | ms |
|---|---|---|---|---|
| terminal/summary | 11 657–11 671 | 29 | 0 | 17–20 |
| terminal/full | 11 775–11 789 | 30 | 0 | 14–15 |
| desktop/summary | 47 400–47 416 | 28 | 30 | 16–18 |
| desktop/full | 48 158–48 174 | 29 | 31 | 15–17 |

Variação de 14 bytes entre execuções (texto de tempo decorrido). Baseline gravada com o máximo
observado.

## Divergência com o relatório

O `04` (item 1 da fase 1, premissa P3) fala em baseline "completa ≈100 KB, resumida ≈29 KB". Com
este fixture as duas visões medem quase o mesmo (47 vs 48 KB no desktop, 29 vs 30 linhas): o limite
de 3 pedidos corta o desenho antes de a visão fazer diferença. Os 100/29 KB foram medidos pela
implementação noutro estado (ou antes do limite de pedidos). Os números do `05` (REAL: 46–47 KB,
27–28 linhas) batem com os daqui.

## Como medir de novo / refazer a baseline

```
# só este teste, numa cópia sem a suíte grande
B=<pasta temporária>; cp -r task-tree $B/task-tree; rm $B/task-tree/tests/task-tree.test.ts
cd $B && <claude.exe do app> plugin test task-tree | grep ORCAMENTO
```
Binário do app: `%APPDATA%\Claude\claude-code\2.1.308\c17a819afb40\claude.exe` (o `claude` do
PATH é 2.1.300).

## Limites do que o teste vê (R10)

- `size` é o JSON da árvore que o kit devolve, não o `drawSize` do módulo (JSX antes da
  serialização); proporcional, não igual. `/task-tree` (que diz o `drawSize`) não é chamável pelo kit.
- Não mede pintura, célula real, moldura interativa nem limite do pane (pergunta 3 do `04`).
- `ms` inclui o kit; limite largo (500 ms) só pega salto de ordem de grandeza.
