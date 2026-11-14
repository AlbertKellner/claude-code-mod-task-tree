# Matriz de impacto (`npm run impacto`): análise

Base: o catálogo de `test/regressivos-automacao-testes` (o mesmo que foi a `main` no PR #26): 99 cenários, 86 cobertos. O clone está em `test/resumo-recarga-e-impacto`, onde a Implementação trabalha no resumo ↩. Li por `git show`. Nada foi editado.

## Essencial

- **O que é:**
  - cada arquivo do catálogo ganha uma linha `Código da área:` (os arquivos do mod que implementam a área);
  - um cenário pode ter `Código:` próprio, que **soma** à área;
  - `npm run impacto` lê o diff (pasta de trabalho contra `HEAD`, `--base <ref>` como a CI, ou arquivos passados à mão) e imprime: arquivos tocados → cenários afetados → testes que os cobrem → itens do checklist do app → cenários de golden.
  - É **orientação, nunca bloqueio**: sai sempre com 0.
- **O que o check valida:**
  - **falha** só quando um caminho em `Código:` ou `Código da área:` não existe (um arquivo renomeado quebra o mapa; é estável e barato);
  - **avisa**, sem falhar, quando um cenário coberto não tem área nem `Código:` próprio, ou quando um arquivo do mod não aparece em nenhum cenário;
  - nada que dependa de interpretação vira bloqueio.
- **Núcleo:** `hooks/register.tsx`, `hooks/render.tsx` e `types/index.d.ts` redesenham ou ligam tudo. Uma mudança neles diz "núcleo: todos os cenários cobertos; checklist visual inteiro; golden: 3 cenários", sem listar 86 linhas.
- **Preenchimento inicial pequeno:** 11 linhas `Código da área:` e cerca de 25 `Código:` de exceção (mapa abaixo, conferido no código). A granularidade é **arquivo**; por símbolo (`layout.ts#halt`) fica como evolução opcional (dúvida 2).
- **3 commits:**
  1. script, parser e testes nas `travas`;
  2. preenchimento do catálogo;
  3. `CLAUDE.md`, modelos de brief e relato, e a linha no log da CI.
- **Dúvidas:** 2 (seção 7).

## 1. Formato

No topo de cada `regras/<área>.md`, logo depois do título e da descrição:
```markdown
# Envios

As mensagens a outras sessões (✉).

Código da área: hooks/tool-call.ts, hooks/sessions.ts, hooks/panel.ts, state/tasks.ts
```
Num cenário, opcional, entre a Origem e o Estado:
```markdown
Origem: decisão do usuário, 2026-10-24 ("mantenha o ícone e troque somente a cor"); commit 8eb801c.
Código: draw/layout.ts, draw/svg.ts
Estado: coberto
```
- Os caminhos são relativos a `task-tree/`, separados por vírgula.
- O efetivo de um cenário é a área mais o próprio `Código:`.
- `Código:` é a primeira linha do cenário com esse prefixo; uma segunda é erro.

## 2. O que muda no `scripts/regras.mjs`

- O parser lê `Código da área:` (uma por arquivo, antes do primeiro `###`) e `Código:` (por cenário).
- Valida:
  - **falha:** caminho inexistente sob `task-tree/`; `Código:` repetido no mesmo cenário; `Código da área:` repetido;
  - **aviso** (impresso, sem falhar): cenário `coberto` sem código efetivo; arquivo `.ts`/`.tsx` do mod (fora de `tests/` e `.claude-plugin/`) que nenhum cenário cita nem é do núcleo.
- Exporta `lerCatalogo()` (ids, estados, código efetivo, arquivo), para o `impacto.mjs` não duplicar o parser.
- O resumo ganha uma linha: `mapa: 86 cobertos com código, N avisos`.

## 3. `scripts/impacto.mjs`

Uso:
```
npm run impacto                      # pasta de trabalho + índice contra HEAD
npm run impacto -- --base <ref>      # contra a base (CI, PR): git diff --name-only <ref>...HEAD
npm run impacto -- <arquivo>…        # arquivos à mão (a Análise, antes de implementar)
```

Saída (exit 0 sempre):
```
Arquivos do mod tocados: hooks/turn.ts
Cenários afetados (3):
  durabilidade.fim-do-turno-sobrevive-ao-reinicio   coberto   tests/durabilidade.test.ts: 2 testes
  lembretes.replanejar-apos-esc-pessoa              coberto   tests/lembretes.test.ts: 1 teste
  turnos.subagente-que-termina-interrompe           coberto   tests/turnos.test.ts: 1 teste
Checklist do app: nenhum
Golden: nenhum cenário
Fora do mapa: nenhum
```
- **Núcleo** tocado: "núcleo: todos os 86 cenários cobertos (o check roda todos); checklist do app: <a lista dos 13>; golden: principal, filha trabalhando, envios".
- Arquivos fora de `task-tree/` (scripts, regras, testes) não entram no impacto. Um teste alterado aparece pelo `testes:alterados`.
- Golden: os cenários `visual.desenho-*` têm `Código:` (svg, geometry, render, layout); tocar um desses lista o golden.
- **Não roda testes:** o check roda todos. O impacto diz o que **ler, citar e validar no app**.

## 4. Mapa inicial (conferido no código)

| Área | `Código da área:` | `Código:` de exceção (soma) |
|---|---|---|
| arvore | `state/tasks.ts, hooks/tools.ts` | `pai-em-andamento-no-caminho-da-ultima-iniciada`, `sem-start-nada-acende`: `draw/layout.ts` (trail, current); `done-sem-summary-e-varias-sem-start`: `text/rules.ts` |
| cabecalho | `draw/layout.ts, draw/svg.ts` | `resumida-*` (2): `hooks/panel.ts` (startsWork, joinWork, openInSight); `titulo-*` (2): `state/tasks.ts` (startedSeq) |
| durabilidade | `state/durability.ts, hooks/panel.ts, hooks/session-start.ts` | `formatos-antigos-do-publicado`: `io/publish.ts, io/host.ts`; `fim-do-turno-sobrevive-ao-reinicio`, `resumo-do-done-na-recarga`: `hooks/turn.ts`; `ligacoes-com-lista-parcial-do-host`: `hooks/sessions.ts, io/host.ts`; `resumo-do-done-na-recarga`: `hooks/tools.ts` |
| envios | `hooks/tool-call.ts, hooks/sessions.ts, hooks/panel.ts, state/tasks.ts` | `cor-por-estado`, `esc-apos-entrega-imediata`, `fila-nao-interrompe-no-fim-do-turno`: `draw/layout.ts, draw/svg.ts`; `nivel1-recebido-mostra-carta`: `hooks/prompt-submit.ts, draw/layout.ts` |
| lembretes | `hooks/prompt-submit.ts, text/rules.ts, hooks/turn.ts` | `primeira-chamada-sem-plano`: `hooks/tool-call.ts` |
| pedidos | `hooks/tools.ts, state/tasks.ts, hooks/prompt-submit.ts, hooks/panel.ts` | `resumida-mantem-anteriores-com-algo-aberto`: `draw/layout.ts` |
| perguntas | `hooks/tool-call.ts, hooks/panel.ts, draw/layout.ts` | `permissao-espera`: `hooks/permission.ts` |
| sessoes | `hooks/sessions.ts, io/host.ts, io/publish.ts, draw/layout.ts` | `busto-so-no-pai`, `pasta-sem-git`, `toks-e-repo-branch-no-cartao`: `draw/svg.ts`; `cartao-sob-a-tarefa-de-origem`: `hooks/panel.ts` (sendAnchor, usedAnchors) |
| turnos | `draw/layout.ts, hooks/turn.ts, hooks/panel.ts, hooks/prompt-submit.ts` | `subagente-que-termina-interrompe`: `hooks/tool-call.ts` |
| visual | `draw/svg.ts, draw/geometry.ts, draw/motion.ts` | `desenho-*` (3), `golden-gera-desenho`: `draw/layout.ts` |
| fumaca | `hooks/tools.ts` | — |

- Núcleo (no script, não no catálogo): `hooks/register.tsx`, `hooks/render.tsx`, `types/index.d.ts`.
- Sem cenário: `io/log.ts` (só log), `io/git.ts` (vai a `sessoes.pasta-sem-git` e `toks-e-repo-branch-no-cartao` como exceção), `hooks/command.ts` (vai a `cabecalho.resumida-*`, pela troca de visão).
- O aviso "fora do mapa" pega o que sobrar.

**Amostra** (`regras/turnos.md`, topo e um cenário):
```markdown
# Turnos

O fim do turno, o Esc e o turno seguinte.

Código da área: draw/layout.ts, hooks/turn.ts, hooks/panel.ts, hooks/prompt-submit.ts

### turnos.subagente-que-termina-interrompe
…
Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Código: hooks/tool-call.ts
Estado: coberto
```

## 5. Onde entra no fluxo

- **Análise:** o brief traz a seção "Matriz de impacto" com a saída de `npm run impacto -- <arquivos que a mudança vai tocar>`.
- **Implementação:** o relato traz `npm run impacto` sobre o diff real, junto com `testes:alterados`. Divergência entre o previsto e o real se explica.
- **Usuário:** a linha "Checklist do app" diz o que validar no app depois do commit.
- **CI:** um passo informativo, `npm run impacto -- --base <ref>`, depois do check (`if: always()`), só no log.
- **`CLAUDE.md`:** em "Travas contra regressão", trocar o item da matriz de impacto pela forma concreta. Em "Como executar", acrescentar o comando. Em `regras/README.md`, documentar o formato (`Código da área:`, `Código:`) e atualizar os modelos de brief e de relato.
- **Regra nova de manutenção** (no README do catálogo): quem cria um cenário ou um arquivo do mod atualiza o mapa. O check avisa, não bloqueia.

## 6. Riscos

- **Mapa desatualizado:** um arquivo movido falha o check (caminho inexistente), e o erro é fácil de corrigir. Uma função movida de arquivo não é detectada. O aviso "fora do mapa" pega arquivo novo, mas não função nova, por isso a granularidade por arquivo, mais robusta.
- **Falso conforto:** o impacto não substitui o check (que roda todos os testes) nem o golden. Deixar isso claro na saída ("o check roda todos").
- **Núcleo grande:** se `layout.ts` e `panel.ts` fossem núcleo, toda mudança diria "tudo". Por isso eles entram por área, e o núcleo fica pequeno.
- **Concorrência de arquivos:** o preenchimento toca `regras/*.md`, que a Implementação também mexe no resumo ↩ (`regras/durabilidade.md`, `regras/turnos.md`). Fazer os commits do impacto **depois** do commit do resumo, na mesma branch, ou em sequência combinada pela orquestradora.
- **Hook e CI:** o parser novo roda na etapa `regras` (ms) e não pesa. O `impacto` não entra no hook.

## 7. Dúvidas para o usuário

1. **O check deve só avisar** quando um cenário coberto fica sem código, falhando apenas em caminho inexistente (recomendado: não vira mais um bloqueio frágil)? Ou deve falhar também?
2. **Granularidade:** por arquivo (recomendado agora), ou também por função (`draw/layout.ts#halt`), mais precisa porém mais trabalhosa de manter? Por função poderia vir depois, lendo os trechos do diff.

## 8. Commits e brief para a Implementação (depois do commit do resumo ↩)

Na branch atual do trabalho (`test/resumo-recarga-e-impacto`). Commits locais. Sem push.

1. `feat(regras): matriz de impacto (Código da área / Código no catálogo; npm run impacto)`
   - `scripts/regras.mjs`: o parser e a validação da seção 2; `lerCatalogo()` exportada;
   - `scripts/impacto.mjs` (seção 3); `package.json` com `impacto`;
   - `scripts/travas.test.mjs`, casos novos:
     - caminho inexistente em `Código:` falha;
     - cenário coberto sem código só avisa;
     - o impacto lista o cenário de um arquivo tocado;
     - núcleo tocado devolve "todos";
   - sem o catálogo preenchido, o check passa, com avisos.
2. `docs(regras): mapa de código por área e por cenário`: as 11 linhas `Código da área:` e as exceções da seção 4; o check verde com **0 avisos**.
3. `docs: matriz de impacto no fluxo`:
   - `CLAUDE.md` (Como executar; Travas);
   - `regras/README.md` (o formato, os modelos de brief e relato, a manutenção do mapa);
   - `.github/workflows/test.yml` com o passo informativo `npm run impacto -- --base`.

O relato traz a saída de `npm run impacto -- hooks/turn.ts` (exemplo) e de `npm run check`. O usuário valida lendo um arquivo do catálogo (por exemplo, `regras/turnos.md`) e a saída do impacto.
