# correcao-regressao · fase 6, parte A, item 4 — publicar só quando muda

Sessão `correcao-regressao`. Branch `perf/fase-6-desempenho`, sobre `9e22f89` (item 3). 2026-10-22.

## O que mudou

- `task-tree/io/publish.ts`:
  - `waitFile`: o `home` (USERPROFILE/HOME) é pedido ao host uma vez por módulo (variável `home`); antes,
    a cada leitura e escrita de arquivo (6 `env.get` por poll no caso real).
  - `publishWait`: monta o corpo do arquivo sem `at`, `context.at` e `panes`, compara com o último
    publicado para aquele caminho (`lastPublished`, `Map` do módulo, chave = corpo + `percent`) e só
    grava quando muda. Só então pede `ui.panes` e o relógio. O arquivo gravado tem os mesmos campos na
    mesma ordem de antes. `waiting`, `context.percent`, `engine`, `renderError/drawSize/rows` e o
    painel continuam disparando publicação. Recarga do mod: a variável some e publica uma vez a mais.
- `task-tree/hooks/panel.ts`:
  - `showStatus`: `$.ui.status` só quando o texto muda (`lastStatus`, módulo; a primeira chamada sempre
    passa).
  - `saveLinks`: o registro `{children, sends, received, launches}` só vai ao store quando muda
    (`lastLinks`, módulo, comparado por JSON). `keptLinks` continua atualizado a cada chamada.
- `task-tree/state/durability.ts`: duas linhas novas na tabela (`lastPublished, lastLinks, lastStatus`
  e `home`, vivem no módulo).
- `task-tree/tests/publicado.test.ts`: describe novo "publicar só quando muda", 2 testes com um host que
  conta `fs.write`, `store.set`, `ui.status`, `env.get` e tem relógio móvel: (1) dois polls sem mudança
  (chamada genérica de ferramenta com a lista velha de 4 s) não gravam arquivo, store nem status, e não
  pedem o `home`; uma mudança no arquivo da filha grava de novo, com a mudança dentro; parado de novo,
  nada. (2) a mesma publicação pelo `/task-tree` com o relógio adiantado e o painel agora na frente não
  grava; uma pergunta (espera nova) grava.

## Medidas (bancada `run6.sh`, camada do kit, REAL, poll sem mudança, sem o hook de contagem)

| | Antes | Depois | Meta |
|---|---|---|---|
| bytes gravados por poll | 220 KB | 0 KB | 0 `fs.write` ✓ |
| `store.set` por poll | 1 | 0 | 0 ✓ |
| `env.get` por poll | 6 | 0 | |
| idas ao host fora do state | 20 | 8 | ≤ 12 ✓ |
| `ui.status` por poll | 1 | 0 | |
| `publishWait` | 1,3 ms | 0,9 ms | |
| `publishPanel` (com saveLinks) | 3,8 ms | 2,7 ms | |
| parede do poll | 24,5 ms | 23,1 ms | o que sobra é `update(children)`, 14–16 ms: item 5 |

Com o hook de contagem: idas ao host 43 → 31. O primeiro poll depois do mount ainda grava uma vez
(o estado da bancada muda nele); os seguintes, nada. Camada pura: nada muda (56/56 linhas iguais).
Âncoras do `patch6.mjs` adaptadas só na cópia do scratchpad (usage, fs.write).

## Testes

- **320 pass / 0 fail** em 2 rodadas (318 + 2 novos); `validate task-tree` ok (mesmas chamadas do
  engine, mesmos 15 reads/writes de estado).
- 0 `GOLDEN-NEW`, 0 `TEXTOS-NEW`; orçamento 11657 / 11775 / 47400 / 48162 igual.

## Commit sugerido

Arquivos: `task-tree/io/publish.ts`, `task-tree/hooks/panel.ts`, `task-tree/state/durability.ts`,
`task-tree/tests/publicado.test.ts`.
Mensagem: `perf(task-tree): publica o arquivo, as ligações e o status só quando mudam`

## Bugs encontrados

Nenhum.
