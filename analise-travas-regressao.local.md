# Travas contra regressão (desenho para a Implementação)

Base: branch `test/regressivos-automacao-testes`, topo `e51ffec`. Nada foi editado no repositório.

Para conhecer o formato da saída, rodei a suíte numa cópia de `HEAD`, feita com `git archive` no scratchpad: 46 testes, cerca de 10 s, uma linha `(pass|fail) <nome> [ms]` por teste, agrupadas por arquivo.

## Essencial

A proposta aprovada fica de pé, com três ajustes que a tornam mais forte e mais barata:

1. **A trava principal é rodar os testes de `HEAD` contra o código novo** ("testes antigos, código novo").
   - Se um teste antigo falha com o código da mudança, o comportamento protegido mudou. O check só aceita isso se o teste e o cenário dele foram **reescritos por decisão do usuário** (selo de tipo `decisao`, com `Reescrito:` no catálogo).
   - Isso pega exatamente "ajustar o teste para passar". Custa cerca de 10 s e é feito numa cópia temporária (`git archive` + cópia do código), **sem tocar** na pasta do clone, sem worktree, stash nem troca de branch.
   - Substitui o `--baseline` manual, que vira automático.
2. **O selo usa o compilador TypeScript que já está instalado** (`node_modules/typescript`): acha cada `test(...)`, reimprime o corpo sem comentários e com espaços normalizados, faz o hash e conta as asserções.
   - O **kit** (`tests/kit/*.ts`) também é selado: um `esperarEstado` enfraquecido mudaria todos os testes sem tocar em nenhum.
3. **O hook de pré-commit roda o check sobre o que está sendo commitado** (o índice, copiado com `git checkout-index` para uma pasta temporária), não sobre a pasta de trabalho. Assim a edição em curso de outra sessão na mesma pasta não faz o commit passar nem falhar por engano.

O `impacto` (mapa arquivo↔cenário) e o diff bonito do `testes:alterados` podem ficar **para depois**. O essencial cabe em 4 commits.

Dúvidas para o usuário no fim; a principal é se aceita o tipo de selo `refatoracao`, para mudanças de teste sem mudança de regra.

## 1. O que existe (lido)

- `scripts/regras.mjs`: catálogo × comentários `// Regra:` (ids, estados, ligações).
- `scripts/testes.mjs`: etapas regras → validate ×2 → tsc (aviso) → `plugin test`; `rodar` com `stdio: 'inherit'`.
- `package.json`: só `check`; `typescript` 5.9.3 instalado.
- `regras/*.md`: 77 cenários, 41 cobertos (arvore 5, envios 8, fumaca 1, lembretes 5, pedidos 8, perguntas 6, turnos 8).
- `CLAUDE.md`: fluxo, testes, BDD, recarga, checklist, release. Ainda não tem as regras de "teste existente só muda com decisão".
- `tar.exe` do Windows está disponível (bsdtar), e o `git archive | tar -x` funcionou.

## 2. As travas em detalhe

### 2.1 Selo dos testes e do kit (`regras/selos.json`, conferido em `scripts/selos.mjs`)

**O que é um teste selado:** todo `test(...)` que cita pelo menos uma regra `coberto`. Hoje são todos os 46.

**Extração** (TypeScript, sem parser próprio):
- `ts.createSourceFile(arquivo, texto, Latest, true)`.
- Visitar `CallExpression` cujo `expression` é o identificador `test`, com o primeiro argumento string literal (o nome) e o último argumento uma função (o corpo).
- O corpo é reimpresso com `ts.createPrinter({ removeComments: true }).printNode(EmitHint.Unspecified, corpo, sf)`. Isso já tira comentários e normaliza espaços, quebras e aspas do jeito do printer.
- Se o teste usa constantes de topo do arquivo (planos `A`, `B`, etc.), o hash inclui também o texto reimpresso das **declarações de topo** do arquivo que não são `test(...)` nem `import`.
  - Assim, mudar o plano `A` muda o selo dos testes que dependem dele.
  - Para não regravar todos os testes do arquivo por qualquer mudança no topo, o hash do teste inclui só as declarações cujos nomes aparecem no corpo (`ts.Identifier` usados).

**Hash:** `sha256` do texto reimpresso (corpo + declarações usadas), os 16 primeiros hexadecimais.

**Asserções contadas:**
- chamadas a `expect` (qualquer cadeia que comece em `expect(`);
- chamadas aos helpers de leitura que afirmam: `esperarEstado`, `esperarCarta`, `linha`, `antes`, mais os que vierem, numa lista no script, `ASSERCOES`.

**Kit:** cada arquivo de `tests/kit/` tem o seu selo, com o hash do arquivo inteiro reimpresso sem comentários.

**Formato de `regras/selos.json`:**
```json
{
  "testes": {
    "task-tree/tests/turnos.test.ts::Esc interrompe só a tarefa iniciada; as pendentes seguem pendentes": {
      "regras": ["turnos.esc-interrompe-so-a-iniciada"],
      "hash": "3f9c0a1b2c3d4e5f",
      "assercoes": 6,
      "tipo": "decisao",
      "data": "2026-10-27",
      "motivo": "decisão do usuário: pendentes nunca ✕"
    }
  },
  "kit": {
    "task-tree/tests/kit/leitura.ts": { "hash": "…", "tipo": "novo", "data": "2026-10-28", "motivo": "carta ✉" }
  }
}
```

**Tipos de selo:**
- `novo`: teste novo, ou o selo inicial;
- `decisao`: comportamento esperado mudou por decisão do usuário;
- `refatoracao`: o texto mudou sem mudar o que se afirma (dúvida 1).

**O check falha (etapa `selos`) quando:**
1. um teste selado tem hash diferente do selo: "o teste mudou sem selo novo";
2. um teste que cita regra coberta não tem selo: "teste novo sem selo";
3. um selo não tem teste (removido ou renomeado): "teste selado sumiu";
4. um arquivo do kit tem hash diferente do selo;
5. um selo de tipo `refatoracao` ou `novo` registra **menos** asserções que o selo anterior do mesmo teste. A comparação é com o `selos.json` de `HEAD`, lido com `git show HEAD:regras/selos.json`.

**Regravar** (`npm run regras:selar -- "<arquivo>::<nome>" --tipo decisao|refatoracao|novo --motivo "…"`, ou `--kit <arquivo>`, ou `--remover "<chave>"`):
- `decisao` exige que **cada** regra citada pelo teste tenha, no catálogo, uma linha `Reescrito: AAAA-MM-DD, <decisão do usuário>` com data **igual ou posterior** à do selo anterior. Sem isso, recusa, com a mensagem "reescreva o cenário no catálogo com a decisão do usuário antes de selar".
- `refatoracao` recusa se o número de asserções caiu.
- `--remover` exige `--tipo decisao` e o `Reescrito:` das regras do teste. Uma regra que perdeu o último teste já faz o `regras.mjs` falhar, se seguir `coberto`.
- `novo` só para chave que não existia no selo de `HEAD`.
- O script grava data, tipo e motivo. Selar é um passo explícito, que aparece no diff de `regras/selos.json`.

**Fronteira entre decisão e "ajustar para passar":**
- **Decisão:** o usuário mudou a regra. O cenário é reescrito no catálogo com `Reescrito: <data>, <palavras dele>`; o teste muda; selo `decisao`.
- **Refatoração:** muda a forma (um helper novo, outro nome de variável, outra ordem) e **nada do que se afirma**. As asserções não diminuem, e o teste antigo continua passando contra o código novo (2.2). Selo `refatoracao`.
- **Ajuste para passar:** o teste antigo falharia contra o código novo, mas o teste foi mudado sem decisão. A trava 2.2 pega: o teste antigo falha, e não há selo `decisao` daquele teste nesta mudança.

### 2.2 Testes antigos contra o código novo (etapa `regressao`, `scripts/regressao.mjs`)

Roda quando há diferença em `task-tree/` entre `HEAD` e o que está sendo verificado (o índice, no hook, ou a pasta de trabalho, no `npm run check`).

Passos:
1. Pasta temporária `os.tmpdir()/task-tree-regressao-<pid>`.
2. Copiar o **código novo**: `task-tree/` do que se verifica, **sem** `tests/`. No hook, de `git checkout-index`; no check manual, da pasta de trabalho, com `fs.cpSync` ignorando `tests/`, `.claude-plugin/types/` e `node_modules/`.
3. Copiar os **testes de `HEAD`**: `git archive HEAD task-tree/tests | tar -x -C <tmp>` (inclui o kit de `HEAD`).
4. `claude plugin test <tmp>/task-tree`, com a saída capturada (pipe), lida por `^\((pass|fail)\) (.+?) \[` e pelo cabeçalho do arquivo (`^tests[\\/](.+):$`).
5. Para cada `fail`:
   - se o teste tem, no selo de agora, um registro de tipo `decisao` com data de hoje e hash diferente do selo de `HEAD`, a mudança foi declarada: imprime "decisão: <regras> (<motivo>)" e **não** falha;
   - senão, imprime "REGRESSÃO OU DECISÃO NÃO REGISTRADA: <arquivo>::<nome> — regras <ids>" e **falha**.
6. Apaga a pasta temporária.

Não toca no clone: não usa worktree, stash nem checkout. A pasta temporária está fora do repositório e não é carregada pelo app.

**Custo:** cerca de 10 s a mais por check com mudança em `task-tree/`. Sem mudança, pula.

**Limite:** um teste **novo** não tem versão antiga. Ele é protegido a partir do commit seguinte, quando vira teste de `HEAD`.

### 2.3 `npm run testes:alterados` (`scripts/alterados.mjs`)

- **Base:**
  - `--desde HEAD`, o padrão: os testes da pasta de trabalho contra `HEAD`, para o relato antes do commit;
  - `--pr`: contra `git merge-base HEAD origin/main`, para o relato do PR. Se `origin/main` não existe localmente, usa `main`.
- **Saída:** para cada teste existente na base cujo hash mudou (mesma extração de 2.1):
  - `<arquivo>::<nome>`, as regras, o tipo e o motivo do selo novo;
  - "antes" e "depois" do corpo reimpresso, em linhas, com `-`/`+` (diff de linhas simples, LCS, em Node);
  - os testes removidos e os novos, só pelo nome.
- **Exit 0 sempre:** é relato, não trava. Quem trava é 2.1 e 2.2.
- O diff colorido e "bonito" pode ficar para depois; a lista com o diff simples basta.

### 2.4 `npm run impacto` (`scripts/impacto.mjs`, **pode ficar para depois**)

- Cada cenário ganha `Código: <arquivo>[, <arquivo>]`, relativo a `task-tree/`. Cada arquivo do catálogo pode ter, logo depois do `# Título`, uma linha `Código da área: …` que vale para todos os cenários dele sem `Código:` próprio.
- Arquivos **comuns** (`hooks/render.tsx`, `hooks/panel.ts`, `draw/layout.ts`, `draw/svg.ts`, `hooks/register.tsx`) ficam numa lista no script. Uma mudança neles imprime "toca o núcleo: todas as regras cobertas" e, além disso, os cenários `checklist` (visual).
- O script lê `git diff --name-only HEAD` (ou `--pr`) e imprime os cenários afetados, com os testes que os cobrem e os itens de checklist do app a validar.
- Exit 0 sempre (orientação).

**Mapeamento inicial** (conferido no código):

| Área | `Código da área:` | Exceções por cenário |
|---|---|---|
| arvore | `state/tasks.ts, hooks/tools.ts` | `arvore.pai-em-andamento-no-caminho-da-ultima-iniciada`: + `draw/layout.ts` (trail) |
| turnos | `draw/layout.ts, hooks/turn.ts, hooks/prompt-submit.ts` | `turnos.prompt-seguinte-retoma`: + `hooks/panel.ts` (wake) |
| pedidos | `hooks/tools.ts, state/tasks.ts, hooks/prompt-submit.ts` | `pedidos.uma-mensagem-um-pedido`, `pedidos.titulo-vem-do-request`: + `hooks/panel.ts` (openTurn) |
| perguntas | `hooks/tool-call.ts, hooks/panel.ts` | `perguntas.espera-sob-a-tarefa`: + `draw/layout.ts` |
| lembretes | `hooks/prompt-submit.ts, text/rules.ts, hooks/turn.ts` | — |
| envios | `hooks/tool-call.ts, hooks/sessions.ts, state/tasks.ts, hooks/panel.ts` | `envios.cor-por-estado`, `envios.esc-apos-entrega-imediata`, `envios.fila-nao-interrompe-no-fim-do-turno`: + `draw/layout.ts`, `draw/svg.ts` |
| fumaca | `hooks/register.tsx, hooks/tools.ts` | — |
| sessoes | `hooks/sessions.ts, io/host.ts, io/publish.ts, draw/layout.ts` | — |
| cabecalho | `hooks/render.tsx, draw/layout.ts, draw/svg.ts` | — |
| durabilidade | `state/durability.ts, hooks/panel.ts, io/publish.ts` | — |
| visual | `draw/svg.ts, draw/geometry.ts, draw/motion.ts, hooks/render.tsx` | — |

O `regras.mjs` passa a validar que os caminhos em `Código:` existem: um arquivo renomeado quebra o mapa e falha o check.

### 2.5 Hook de pré-commit (camada 2)

- `.githooks/pre-commit` (sh; o Git do Windows roda com o bash dele):
  ```sh
  #!/bin/sh
  # Trava contra regressão: o check sobre o que vai no commit (o índice), não sobre a pasta de trabalho.
  exec node scripts/testes.mjs --indice
  ```
- `package.json`: `"prepare": "git config core.hooksPath .githooks"`. Roda no `npm install` e vale só para este repositório.
- `scripts/testes.mjs --indice`:
  - `git checkout-index -a --prefix=<tmp>/` (o índice inteiro numa pasta temporária, com os testes e os selos que vão no commit);
  - roda as etapas com `cwd` na cópia: regras, selos, validate, tsc, plugin test, e a regressão contra `HEAD` com a cópia como "código novo";
  - apaga a cópia.
  - É o que impede que a edição não commitada de outra sessão na mesma pasta interfira.
- **Fora do hook:** `git commit --no-verify` pula tudo. A garantia real contra isso é o CI (tarefa 10), com o mesmo `npm run check`.

### 2.6 CI (tarefa 10 do plano: registrar, implementar depois)

- `.github/workflows/test.yml` em `pull_request` para `main`: Node, instalação do Claude Code na versão fixada e `npm ci && npm run check -- --pr`.
- No CI, a regressão compara com a base do PR (`merge-base`), não com `HEAD`.
- Torná-lo obrigatório no GitHub é configuração do usuário.

## 3. Textos

### 3.1 Acréscimos ao `CLAUDE.md`

Nova seção, depois de "BDD: o catálogo de regras":
```markdown
## Travas contra regressão

O que já funcionava continua funcionando: um teste existente só muda quando o usuário decide mudar
a regra que ele protege.

- Teste existente coberto por regra só muda com decisão do usuário registrada no catálogo: o
  cenário ganha `Reescrito: AAAA-MM-DD, <palavras dele>`, e o teste é selado como decisão
  (`npm run regras:selar -- "<arquivo>::<nome>" --tipo decisao --motivo "…"`).
- Mudar a forma de um teste sem mudar o que ele afirma é refatoração (`--tipo refatoracao`): as
  asserções não podem diminuir e o teste antigo precisa continuar passando.
- Regressão se corrige no código, nunca no teste. Se a mudança precisa alterar um comportamento
  protegido e não há decisão do usuário, pare e pergunte.
- O `npm run check` falha quando: um teste selado mudou sem selo novo; um teste coberto perdeu
  asserções; um arquivo do kit mudou sem selo; ou um teste de `HEAD` falha contra o código novo
  sem decisão registrada ("testes antigos, código novo").
- O hook de pré-commit (`.githooks/`, ativado pelo `npm install`) roda o check sobre o que vai no
  commit. Não use `--no-verify`.
- A análise traz a matriz de impacto (`npm run impacto`): cenários e testes afetados pelos arquivos
  que a mudança toca e os itens do checklist do app.
- O relato da implementação cola a saída de `npm run testes:alterados` e o resumo do check.
```
Em "Como executar", acrescentar as etapas `selos` (depois de `regras`) e `regressao` (depois de `plugin test`), com uma linha cada, e os comandos `npm run regras:selar`, `npm run testes:alterados` e `npm run impacto`.

### 3.2 Modelos em `regras/README.md` (nova seção "Modelos")

**Brief da Análise:**
```markdown
### Brief para a Implementação
- Pedido e decisão do usuário (palavras dele, data).
- Cenários: novos / reescritos (com `Reescrito:`) / sem mudança que protegem a área.
- Matriz de impacto (`npm run impacto`): arquivos → cenários → testes; itens do checklist do app.
- Testes existentes que vão mudar, e por quê (decisão de quem, quando). Nenhum outro pode mudar.
- Arquivos a escrever, de uma vez; commit sugerido.
- O que o usuário valida no app.
```

**Relato da Implementação:**
```markdown
### Relato
- Commit: <hash> <título>.
- `npm run check`: <resumo das etapas>.
- `npm run testes:alterados`: <saída colada; "nenhum" se nenhum teste existente mudou>.
- Selos regravados: <chave, tipo, motivo>.
- Regressão (testes antigos × código novo): <ok | lista com a decisão de cada um>.
- Não verificado / para o checklist do app: <itens>.
```

## 4. Limites honestos

Garantido por código (falha o check ou o commit):
- teste coberto alterado sem selo;
- asserções a menos;
- kit alterado sem selo;
- teste coberto removido;
- teste antigo que falha contra o código novo sem selo de decisão;
- regra coberta sem teste.

**Não** garantido (é orientação):
- Que o `Reescrito:` reflita uma decisão **real** do usuário. Uma sessão pode escrever a linha e selar. Fica visível no diff do catálogo e do `selos.json`, no relato (`testes:alterados`) e na revisão do usuário, mas o código não sabe distinguir.
- `--no-verify` pula o hook. O CI cobre quando existir.
- Testes novos só são protegidos a partir do commit seguinte.
- O que o harness não vê (pintura, cliques, recarga real) continua no checklist do app.
- A refatoração de um teste que troca uma asserção forte por uma fraca, mantendo a contagem e passando contra o código novo, escapa à contagem. O diff do `testes:alterados` mostra; a revisão pega.

## 5. Testes das próprias travas

`scripts/travas.test.mjs` (`node --test`, sem dependências), rodado como etapa `travas` do check (cerca de 1 s):
- Cria um repositório git temporário (`git init` em `os.tmpdir()`) com um catálogo mínimo (duas regras), um `task-tree/tests/exemplo.test.ts` com dois testes e um `kit/leitura.ts`. Faz um commit e sela tudo (`novo`).
- Casos:
  1. Mudar o corpo de um teste sem selar → `selos` falha com "o teste mudou sem selo novo".
  2. Tirar um `expect` e selar como `refatoracao` → o `selar` recusa.
  3. Selar como `decisao` sem `Reescrito:` → recusa; com `Reescrito:` → aceita, e `selos` passa.
  4. Remover um teste selado → `selos` falha; `--remover` sem decisão → recusa.
  5. Mudar o kit sem selar → falha.
  6. Comentários e espaços mudados → **não** falha (normalização).
  7. Mudar uma constante de topo usada pelo teste → falha; uma não usada → não falha.
- A regressão (2.2) depende do binário do Claude Code e não entra no `node --test`. Ela tem um **teste de fumaça manual**, descrito no relato da implementação:
  - numa cópia no scratchpad, mudar uma linha do código do mod que quebre um teste;
  - rodar `node scripts/regressao.mjs --raiz <cópia>`;
  - conferir a mensagem "REGRESSÃO OU DECISÃO NÃO REGISTRADA" e o exit 1.

## 6. Riscos

- **Recarga do clone:** nenhuma mudança em `task-tree/` além do selo. `selos.json` e os scripts ficam fora do mod; `.githooks/` e `package.json` também. A cópia temporária da regressão fica fora do repositório.
- **Tempo do commit:** com o hook, o commit leva o check inteiro (validate + tsc + testes + regressão, cerca de 30–40 s). Se pesar, a regressão pode rodar só quando há mudança em `task-tree/` (já é assim).
- **Hook em Windows:** o `core.hooksPath` vale para qualquer cliente git deste repositório (app, terminal, IDE). Um git sem `sh` (raro) não roda o hook.
- **Outras sessões na mesma pasta:** o hook usa o índice, mas o índice também é compartilhado. Um `git add` de outra sessão entraria no commit e no check. Isso já é regra (cada sessão commita só os seus arquivos com `git commit -- <caminhos>`). Observação: `git commit -- <caminhos>` usa um índice temporário só com esses caminhos, e o hook vê exatamente esse índice.
- **Formato da saída do `plugin test`:** a leitura por regex depende dele. Se uma versão nova do binário mudar, a regressão não acha os testes e deve **falhar** ("saída irreconhecível"), não passar.
- **Selagem inicial:** o primeiro commit sela os 46 testes e o kit com tipo `novo`. Isso é declarar o estado atual como a linha de base.

## 7. Dúvidas para o usuário

1. **Selo de refatoração:** aceita que um teste mude de **forma** sem decisão sua (por exemplo, trocar a leitura por um helper novo), desde que as asserções não diminuam e o teste antigo continue passando contra o código novo? Recomendado: sim. Sem isso, toda melhoria do kit exigiria uma "decisão" sua.
2. **Testes novos selados à mão** (`--tipo novo`), em vez de selados sozinhos pelo check? Recomendado: à mão. Torna explícito o que entra na linha de base e impede apagar e recriar um teste com outro nome para fugir da trava.
3. **O hook pode rodar o check inteiro** (30–40 s por commit)? Recomendado: sim, com a regressão só quando `task-tree/` muda.
4. **A matriz de impacto (`npm run impacto`) agora ou depois?** Recomendado: depois. O check já roda todos os testes; o mapa só orienta a análise e o checklist.

## 8. Commits e brief para a Implementação

Na branch `test/regressivos-automacao-testes`, depois de `e51ffec`. Commits locais, em ordem; cada um com `npm run check` verde. Nenhum arquivo do mod (`task-tree/` fora de `tests/`) é editado.

1. **Selo** — `test(regras): selo dos testes e do kit (selos.json) conferido no check`
   - `scripts/selos.mjs`: extração com TypeScript, conferência e `--selar`;
   - `scripts/testes.mjs`: etapa `selos` depois de `regras`;
   - `package.json`: script `regras:selar`;
   - `regras/selos.json`: selagem inicial dos 46 testes e do kit, tipo `novo`, motivo "linha de base";
   - `scripts/travas.test.mjs`: casos 1 a 7 de 5, mais a etapa `travas` no `testes.mjs`;
   - `regras/README.md`: formato do `Reescrito:` e do selo.
2. **Testes antigos contra o código novo** — `test(regras): testes de HEAD contra o código novo barram regressão sem decisão`
   - `scripts/regressao.mjs` e a etapa `regressao` no `testes.mjs` (só com diferença em `task-tree/`);
   - fumaça manual descrita no relato.
3. **Hook e relato** — `chore: hook de pré-commit no índice e testes:alterados`
   - `.githooks/pre-commit`;
   - `package.json` com `prepare` e `testes:alterados`;
   - `scripts/testes.mjs --indice` (`checkout-index`);
   - `scripts/alterados.mjs`.
4. **Texto** — `docs: travas contra regressão no CLAUDE.md e modelos de brief e relato`
   - `CLAUDE.md` (seção 3.1) e `regras/README.md` (modelos, seção 3.2).

Depois (dúvida 4 e tarefa 10): `scripts/impacto.mjs`, com as linhas `Código:` e `Código da área:` no catálogo (mapa da seção 2.4); o CI `test.yml`.

Cuidados:
- Escrever os arquivos de cada commit de uma vez.
- Rodar `npm install` uma vez depois do commit 3, para ativar o hook, e confirmar com um commit de teste que o hook roda. Pode ser o próprio commit 4.
- A regressão e o hook usam pastas em `os.tmpdir()`: nunca worktree, stash ou checkout na pasta do clone.

O usuário valida:
- lendo o `CLAUDE.md` (seção nova) e os modelos;
- pela saída do `npm run check`, com as etapas `travas`, `selos` e `regressao`;
- pela fumaça no relato: um teste alterado de propósito barrado, e uma mudança de código que quebra um teste antigo barrada como "REGRESSÃO OU DECISÃO NÃO REGISTRADA".
