# Tarefa 10: CI no GitHub Actions (análise, sem implementar)

Base: `888db51`. Nada foi editado no repositório. Fiz um teste local, numa pasta do scratchpad, com o pacote npm do Claude Code.

## Essencial

- **O binário existe no npm e roda sem login.** `@anthropic-ai/claude-code@2.1.308` é a mesma versão do app (a tag `stable` do npm; `latest` é 2.1.312).
  - Instalei no scratchpad e, numa cópia de `HEAD` com a configuração vazia (`CLAUDE_CONFIG_DIR` numa pasta nova, sem `ANTHROPIC_API_KEY`):
    - `claude plugin validate . --strict` e `claude plugin validate task-tree --strict`: "Validation passed";
    - `claude plugin test task-tree`: **105 pass, 0 fail, ~17 s**.
  - **Nenhum segredo é necessário.**
- **Os scripts precisam de um modo "base do PR" antes do workflow.** Hoje as travas comparam com `HEAD` e liberam decisões e goldens "de hoje" (`selos.mjs` `liberaGolden`, `regressao.mjs`). Na CI de um PR:
  - o checkout é o merge do PR, então `HEAD` já contém a mudança e a etapa `regressao` diria "nada a comparar";
  - o "de hoje" falha no dia seguinte.
  - **Solução:** `--base <ref>` em `testes.mjs`, `regressao.mjs`, `selos.mjs` e `alterados.mjs`.
    - Os testes da **base** rodam contra o código do PR.
    - A comparação de asserções usa os selos da base.
    - A liberação vale para o teste ou cenário cujo selo de **decisão/golden mudou no PR** (o hash difere do da base), em vez de "selado hoje".
- **Workflow:** `.github/workflows/test.yml`.
  - Dispara em `pull_request` para `main` e por `workflow_dispatch`.
  - `ubuntu-latest`, Node 24, `npm ci`, Claude Code fixado em `2.1.308` e `npm run check -- --base <merge-base>`.
  - `permissions: contents: read`; concorrência por PR com cancelamento; cache do npm.
  - O hook não roda na CI, e a CI roda **todas** as etapas (nada é pulado).
- **Fora do repositório** (só com pedido do usuário): exigir o check no `main` (branch protection). O Actions já roda neste repositório: o `release.yml` existe.
- **Não dá para rodar Actions aqui.** A validação local é rodar o mesmo `npm run check -- --base origin/main` com `CLAUDE_BIN` apontando para o binário do npm, mais o `actionlint` (pelo scoop, no escopo do usuário). A primeira execução real só acontece com o push, que está proibido por enquanto.
- O MCP `github` está com o token rejeitado (401). Isso não afeta a CI; afeta só criar ou atualizar PR por ele (o `gh` CLI é separado). Registrado.

## 1. O que o check precisa

| Item | Local hoje | Na CI |
|---|---|---|
| Binário | `claude.exe` do app (`binario.mjs`: `CLAUDE_BIN`, senão `%APPDATA%\Claude\claude-code\<versão>`, senão `claude` no PATH) | `npm install -g @anthropic-ai/claude-code@2.1.308` e `CLAUDE_BIN=$(which claude)`. **Confirmado:** o pacote traz `plugin validate` e `plugin test` |
| Login / API key | o app está logado | **Não precisa:** o `validate` e o `test` passaram com a configuração vazia e sem chave (a doc oficial diz "sem sessão, login ou rede" para o `plugin test`) |
| Node | v24.14.1 | `actions/setup-node` com `node-version: 24` |
| TypeScript | `npm install` (devDependency) | `npm ci` (há `package-lock.json`) |
| Tipos gerados (`.claude-plugin/types/`) | o `validate` gera | igual: o `validate` vem antes do `tsc` |
| Hook (`prepare` → `core.hooksPath`) | ativo | inofensivo na CI: o `npm ci` roda o `prepare`, mas ninguém commita |
| Atualização automática | — | `DISABLE_AUTOUPDATER: 1` no ambiente, por segurança |

## 2. Etapas na CI

Todas, sem pular nada (o `mudou.mjs` só vale no hook):
1. `regras`;
2. `travas` (17 s; testa os scripts num git temporário; precisa do `git` configurado com nome e e-mail para os commits dele, então definir `user.name`/`user.email` no job);
3. `selos`;
4. os dois `validate`;
5. `tsc` (bloqueia);
6. `plugin test` (~17 s);
7. `regressao` (~17 s, com `--base`).

O golden roda dentro do `plugin test`.

**Modo base (mudança necessária nos scripts, commit 1):**
- `--base <ref>` (ex.: `git merge-base origin/main HEAD`):
  - `regressao.mjs`: "há diferença" = `git diff --quiet <base> HEAD -- task-tree`; os testes e o kit vêm de `git show <base>:…`; o código é o de `HEAD`;
  - liberação de uma falha: o teste tem, em `HEAD`, selo `decisao` com hash **diferente** do selo na base (decidido neste PR), ou o cenário de golden tem selo `golden` com hash diferente do da base (aprovado neste PR). Sem olhar a data;
  - `selos.mjs`: a comparação "asserções não diminuem" e "novo só para chave que não existia" usa os selos da `<base>`;
  - `alterados.mjs`: já tem `--pr`; aceita `--base`, para o resumo no log da CI;
  - `testes.mjs`: repassa `--base` às etapas e roda tudo.
- Sem `--base`, tudo continua como hoje (o "de hoje" serve ao hook local).
- **Por que não é afrouxar:** a liberação exige que o PR **traga** o selo de decisão ou golden. O selo só se grava com o `Reescrito:` no catálogo (decisão) ou com as palavras e a data entre aspas (golden). Um PR que muda um teste sem decisão falha na CI exatamente como no hook.

**Critério de falha:** o mesmo do check. O job sai com o código do `testes.mjs`.

## 3. Workflow proposto

```yaml
name: Testes

on:
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

# Um check por PR; um push novo cancela o anterior.
concurrency:
  group: testes-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      CLAUDE_CODE_VERSION: 2.1.308   # a mesma do app; subir junto com o app
      DISABLE_AUTOUPDATER: 1
    steps:
      # O histórico inteiro: a regressão roda os testes da base do PR contra o código dele.
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - run: npm ci

      - name: Claude Code
        run: |
          npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"
          echo "CLAUDE_BIN=$(command -v claude)" >> "$GITHUB_ENV"
          claude --version

      # As travas fazem commits num git temporário.
      - run: |
          git config --global user.name "ci"
          git config --global user.email "ci@localhost"

      - name: Base de comparação
        id: base
        run: |
          if [ -n "${{ github.event.pull_request.base.sha }}" ]; then
            echo "ref=$(git merge-base "${{ github.event.pull_request.base.sha }}" HEAD)" >> "$GITHUB_OUTPUT"
          else
            git fetch origin main --depth=0 || true
            echo "ref=$(git merge-base origin/main HEAD)" >> "$GITHUB_OUTPUT"
          fi

      - name: npm run check
        run: npm run check -- --base "${{ steps.base.outputs.ref }}"

      - name: Testes alterados neste PR
        if: always()
        run: npm run testes:alterados -- --base "${{ steps.base.outputs.ref }}"
```

Observações:
- O `${{ github.event.pull_request.base.sha }}` entra num `run` como valor de contexto, sem texto do usuário, então não abre injeção. O título e o corpo do PR **não** são usados.
- Tempo esperado: ~2–3 min (instalação ~30 s, travas 17 s, validate, tsc ~10 s, test 17 s, regressão 17 s).

## 4. Golden e selos na CI

- A CI só **confere**; nunca grava. O golden e os selos aprovados vão no próprio PR (o `golden:aprovar` roda localmente, com as palavras do usuário).
- A aprovação "só com as palavras dele" continua garantida pelo que o selo exige no repositório (motivo com aspas e data; `Reescrito:` no catálogo).
- Um PR com o desenho mudado e sem golden aprovado falha no `plugin test` (`golden.test.ts`) e na `regressao`.

## 5. O que o usuário faz fora do repositório (só com pedido dele)

- **Branch protection** no `main` exigindo o check "Testes / check" e PR antes do merge. Faz na interface do GitHub ou pede.
- Nada de segredos: a CI não precisa de nenhum.
- O Actions já está ativo (o `release.yml` roda nos merges).

## 6. Riscos

- **Linux × Windows:** testei o pacote npm no Windows. No Ubuntu, o pacote baixa o binário da plataforma; o kit e os scripts já tratam `\` e `/` (o `host` do kit aceita os dois).
  - Risco residual: alguma diferença de caminho ou fim de linha nos scripts (o `.gitattributes` fixa LF nos goldens). Se o Ubuntu falhar, a saída é `runs-on: windows-latest` (mais lento) até corrigir.
- **A versão do binário:** a CI fixa 2.1.308; o app atualiza sozinho. Quando o app subir, subir `CLAUDE_CODE_VERSION` no mesmo PR (o `binario.mjs` local usa o mais novo do app). Uma diferença de versão pode mudar o kit ou o validate.
- **Tempo do kit (5 s por teste):** um runner lento pode estourar o limite em testes pesados (o limite de 400 linhas leva 2,5 s localmente). Monitorar a primeira execução; se estourar, o teste ganha `timeoutMs`, sem mudar asserção.
- **`--base` mal implementado** afrouxaria a regressão. O commit 1 traz casos novos nas `travas`:
  - PR que muda um teste sem decisão → falha;
  - com `Reescrito:` e selo de decisão no PR → passa;
  - golden mudado sem selo → falha.
- **Recarga do clone:** nada do mod muda; só `scripts/` e `.github/`.

## 7. Validar sem push

- `scoop install actionlint` (escopo do usuário) e `actionlint .github/workflows/test.yml`: sintaxe e expressões.
- **Ensaio local do job:** `CLAUDE_BIN=<binário do npm 2.1.308>` e `npm run check -- --base origin/main` (ou `--base 9980131`, o começo da branch) na pasta do repositório. É o mesmo comando da CI.
- `act` (rodar Actions em Docker) não é viável sem Docker e admin. Fica de fora.
- A prova real é o primeiro PR depois do push. O PR #26 já existe; o push dele é decisão do usuário.

## 8. Dúvidas para o usuário (decisões de produto)

1. **Sistema do runner:** Ubuntu (recomendado: mais rápido e barato; o pacote npm roda nele) ou Windows, igual à sua máquina?
2. **Versão do Claude Code na CI:** fixa (2.1.308), subida à mão junto com o app (recomendado: reproduzível), ou a tag `stable` do npm, que muda sozinha?
3. **Quando roda:** só em PR para o `main` e manualmente (recomendado), ou também em todo push de qualquer branch?
4. **Exigir o check para o merge no `main`** (branch protection): ativar, ou deixar só informativo? Ativar é você, ou alguém a seu pedido, na interface do GitHub.

## 9. Brief para a Implementação (depois das respostas)

Na branch `test/regressivos-automacao-testes`, depois de `888db51`. Dois commits locais. **Sem push** (o workflow só roda depois do push, que é decisão do usuário).

1. `fix(regras): modo --base para a CI (testes da base contra o código do PR; liberação por selo trazido no PR)`
   - `scripts/regressao.mjs`, `scripts/selos.mjs`, `scripts/testes.mjs` e `scripts/alterados.mjs`, conforme a seção 2;
   - sem `--base`, comportamento idêntico ao de hoje;
   - `scripts/travas.test.mjs`: os três casos de `--base` da seção 6;
   - `npm run check` verde, e também `npm run check -- --base 9980131` verde na branch atual (o ensaio da CI).
2. `ci: workflow de testes no PR (mesmo npm run check, Claude Code fixado)`
   - `.github/workflows/test.yml` (seção 3, com as respostas 1–3 aplicadas);
   - `CLAUDE.md`, seção curta "CI": o que roda, a versão fixada e quando subir, o `--base`, e que a branch protection é do usuário;
   - `actionlint` sem erro.

O relato traz:
- a saída do ensaio local (`--base`) e do `actionlint`;
- a versão do binário usada no ensaio;
- o que só o primeiro PR vai provar.
