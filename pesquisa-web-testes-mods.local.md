# Pesquisa web: testes de mods/plugins do Claude Code (v2, 2026-10-27)

Legenda: [LIDO] = confirmado lendo a página (via subagente web-fetch). [RESUMO] = só resumo de busca ou resumo de modelo. [OPINIÃO] = inferência minha.

## A. Achado principal: existe harness oficial de teste de mods
Tudo [LIDO] salvo indicação.

### A1. `claude plugin test` (https://code.claude.com/docs/en/plugins/mods/test)
- Roda arquivos `*.test.ts` em qualquer pasta do plugin, a partir do diretório do mod. Sem sessão, login ou rede (https://code.claude.com/docs/en/plugins/cli-reference). Sai com 1 se algum teste falhar. Cada arquivo precisa de ao menos um `test()`. Limite de 5 s por teste (https://code.claude.com/docs/en/plugins/mods/reference).
- Import: `import { expect, test, mock, tier } from 'claude-code/testing'`.
- `test('nome', async ($, on) => {...})`: `$` age como o Claude Code e dispara eventos (`$.tool.call`, `$.command.run`, `$.prompt.submit`, `$.session.start`, `$.turn.complete`, `$.classic.*`); `on` registra stubs.
- Stubs: `{ value }` para chamadas da API (`store.get`, `fs.read`, `process.run`, `model.complete`...), `{ deny }` para falhar, `{ result }` para `tool.call`.
- Mocks: `mock.clock(on,{now})` (advance/set/settle/sleep), `mock.store`, `mock.env`, `mock.session` (v2.1.293+).
- Teste de UI: `$.ui.mount({...PANE, surface})` devolve handle com `press`, `input`, `select`, `find({key}|{type,text})`, `unmount()`.
- `expect`: toBe, toEqual, toMatch, toMatchObject, toContain, toBeDefined/Undefined, toThrow, `.not`.
- Regras: registrar todos os `on` antes da 1ª chamada a `$`; módulo recarregado a cada teste; `session.start` não roda sozinho; hook que chama `next(e)` em `ui.render` precisa de stub de `ui.render`.
- LIMITE IMPORTANTE: a página diz que o teste de desenho NÃO verifica como o app pinta a árvore; é para olhar o layout numa sessão real. Não há snapshot de UI nem de SVG; a verificação é por `find` de elementos.
- Exemplo oficial: `on('tool.call',()=>({result:'ok'})); await $.tool.call({tool:'Bash',command:'ls'}); const a = await $.command.run({command:'tally',args:''}); expect(a.text).toBe('...2 tool calls...')`.
- Não achei: `.test.tsx`, filtros/watch/cobertura do comando (remete a https://code.claude.com/docs/en/plugins/mods/reference#commands, não aberta).

### A2. `claude plugin validate` (https://code.claude.com/docs/en/plugins-reference)
- Valida manifesto e componentes (sintaxe/esquema, não comportamento, segundo https://code.claude.com/docs/en/plugin-evals). Saídas "Validation passed / passed with warnings / failed"; `--strict` transforma avisos em falha (para CI); `--json`; exit 0/1/2. Lista `hooks:` e `calls:` do mod antes de instalar (https://code.claude.com/docs/en/plugins/mods/overview).

### A3. `claude plugin eval` (https://code.claude.com/docs/en/plugin-evals; opções em /plugins/cli-reference)
- Roda casos de `evals/` com e sem o plugin (Δ); opções `--runs`, `--threshold` (padrão 1.0), `--model`, `--judge-model`, `--ablation`, `--max-cost-usd`, `--json`... Exige v2.1.269+ e gasta chamadas reais de modelo. `claude plugin eval init` cria casos. É teste de comportamento do modelo com o plugin, pouco útil para layout/regras determinísticas de um painel. [OPINIÃO]

## B. API do mod (https://code.claude.com/docs/en/plugins/mods/reference, https://code.claude.com/docs/en/plugins/mods/overview) [LIDO]
- `hooks/hooks.json` com `"modules": ["./register.js"]`; módulo exporta `register(on, options)`; `types/index.d.ts` declara `$.state`.
- Eventos: tool.call, tool.check, prompt.submit, turn.step, session.start, command.run, settings.read, ui.render/resolve/press/input/select/close/fault, plugin.register, engine.create, telemetry.log; hooks de settings como `classic.<Event>`.
- Namespaces `$`: ui (resolve, invalidate, open, close, panes, toast, notify, status, ask, blit), command, tool, agent, model, prompt, session, fs, store, state, clock, http, process, mcp.
- Render sites: Pane, AbovePrompt, Spinner, ToolUse, AskUserQuestion. Elementos: Box, Text, Button, Input, Select, Markdown, Code, Link, `Svg`, `Client`, `Raster`, `Image`.
- `Svg`: `source` até 131.072 caracteres, `alt`, `width`, `height`, `isInteractive`; só Desktop e VS Code. `Image`: PNG/RGBA até 2 MiB ou caminho, só terminal.
- Limites: hook 10 s por evento (50 ms em prompt.edit); árvore até 32 níveis, 20.000 elementos, 100.000 caracteres de texto; `$.ui.invalidate('ui.render')` 10/s (30/s terminal); store/fs 4 MiB.
- Hot reload: `claude --plugin-dir <dir>` recarrega ao salvar; `/reload-plugins`; `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` em sessões não interativas.
- Artigo oficial (https://claude.com/resources/articles/claude-code-mods): mods são funções TS ligadas a eventos, sem sandbox, primeiro mod carregado vê o evento primeiro. Mods built-in do repo oficial trazem módulo e testes (overview).
- Não achei: "status line" como API de mod (só `$.ui.status` listado e `subagentStatusLine` no manifesto, outra coisa). A página DeepWiki deu HTTP 429, não lida (continua [RESUMO]).

## C. Testes de hooks na comunidade
- [LIDO] karanb192/claude-code-hooks (https://github.com/karanb192/claude-code-hooks): `npm test` = `node --test tests/*.test.js plugins/**/tests/*.test.js`; Node >= 18; tests/ tem protect-secrets-dispatch, read-replay, regex-backtracking, test-discovery; testes por plugin em `plugins/<x>/tests/`. CI (.github/workflows/test.yml): ubuntu matrix Node 18/20/22 + job Windows para secrets. Não li o conteúdo dos arquivos de teste, então não sei como os payloads são carregados.
- [LIDO] "Hooks Test Suite" (https://mcpmarket.com/tools/skills/hooks-test-suite) é só listagem de skill de terceiros; sem arquivos/fixtures visíveis.
- A URL anterior do plugin-dev SKILL.md deu 404 em main; o `test-hook.sh` citado antes continua [RESUMO].
- Observação [OPINIÃO]: para mods, o harness oficial (A1) substitui os harnesses de hook em shell.

## D. Regressão visual
- [LIDO] Playwright Electron (https://playwright.dev/docs/api/class-electron): experimental, Electron v21+, `electronApp.firstWindow()` + `window.screenshot({path})`. A página não menciona `toHaveScreenshot`. Que funcione com janela Electron é inferência não verificada; exemplo concreto não achado (busca nas issues só trouxe PRs de dependabot).
- [LIDO] `toHaveScreenshot` (https://playwright.dev/docs/test-snapshots): baseline na 1ª execução, `--update-snapshots`; nome do arquivo inclui navegador e plataforma; aviso de que o render varia com SO, versão, hardware, headless; rodar no mesmo ambiente da baseline; `threshold` padrão 0.2, `maxDiffPixels`; `stylePath` para ocultar conteúdo volátil. `maxDiffPixelRatio` em https://playwright.dev/docs/api/class-snapshotassertions.
- [LIDO] Verify (.NET) (https://github.com/VerifyTests/Verify): `.received.` vs `.verified.`, aceitar promove; commitar `*.verified.*`, ignorar `*.received.*`; no Windows `core.autocrlf=true` faz arquivos aparecerem modificados e Verify rejeita CR (relevante aqui). Plugins de imagem: só [RESUMO].
- [LIDO] Jest (https://jestjs.io/docs/snapshot-testing): tratar snapshots como código, curtos e focados; "lute contra o hábito" de regenerar snapshot quando falha em vez de achar a causa; não incluir dados dependentes de plataforma ou não determinísticos. Visual por pixel é outra coisa.
- NÃO lido: resvg-js e sharp (rasterizar SVG); Storybook/Chromatic; ApprovalTests.
- [OPINIÃO] Dado A1 (harness não verifica pintura) e `Svg` ser só Desktop/VS Code: golden do TEXTO do SVG gerado (e da árvore passada ao `$.ui`) é determinístico e testável com `claude plugin test`; raster do app real fica para poucos casos manuais ou Playwright/Electron como prova de conceito.

## E. Regras de estado
- [LIDO] fast-check model-based (https://fast-check.dev/docs/advanced/model-based-testing/): `Command` com `check(model)`, `run(model, real)`, `toString()`; `fc.commands`; runners `modelRun`/`asyncModelRun`/`scheduledModelRun`; encolhe cenário falho; replay exige `seed`, `path` e `replayPath`; modelo não deve ser "cópia carbono" do sistema.
- [LIDO] XState test (https://stately.ai/docs/xstate-test): caminhos gerados do grafo da máquina (`getShortestPathPlans`, `getSimplePathPlans`, `testCoverage`), cada path vira cenário nomeado (BDD leve). Aviso: utilitários migraram para `@xstate/graph`, doc ainda "coming soon".
- [OPINIÃO] Event replay: gravar sequência de eventos e comparar estado final/árvore com golden; combina com `$.tool.call`/`$.prompt.submit` do harness oficial. Nenhum exemplo real achado nas fontes.

## F. Analogias de extensões de editor/CLI
- [LIDO] VS Code (https://code.visualstudio.com/api/working-with-extensions/testing-extension): testes de integração num Extension Development Host com `@vscode/test-cli`/`@vscode/test-electron` e Mocha; não menciona snapshots.
- Raycast: página inicial lida (https://developers.raycast.com/), sem guia de testes; não achado.
- Relatos de comunidade sobre goldens frágeis: NÃO achei (só o aviso do Jest e do Playwright acima).

## Ainda não achado
Conteúdo da DeepWiki (429); flags completas de `claude plugin test`; snapshot de UI/SVG no harness oficial (aparentemente inexistente); exemplo Electron + toHaveScreenshot; resvg/sharp/Chromatic/ApprovalTests; exemplos reais de event replay; relatos de dor com goldens.
