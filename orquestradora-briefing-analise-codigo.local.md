# Briefing: análise completa do código do task-tree

Autor: sessão principal (orquestradora). Destinatária: sessão `analise-codigo`
(Fable, esforço alto). Data: 2026-10-24.

## Pedido do usuário (palavras dele)

> Analisar todo o código do task-tree, verificando se existem dúvidas, inconsistências,
> ambiguidades, omissões, indefinições ou fluxos não mapeados.
> Use a pasta DocsAnaliseCodigo para gravar os documentos auxiliares da analise e para
> gerar um relatório executivo.
> A sessão filha está autorizada a abrir o workflow para realizar essa tarefa.

Sessão pedida: "Sessão de Análise: Fable, Ultracode". Ultracode = usar a tool `Workflow`
(orquestração multiagente) como padrão para o trabalho substantivo; carregue a skill
`workflow-authoring` antes de escrever o script.

## Decisões já tomadas pelo usuário (não perguntar de novo)

1. Pasta de saída: `<notas>\DocsAnaliseCodigo\`
   (fora do repositório, já criada, nada é versionado).
2. Escopo: código **e** regras. Inclui a lógica em `task-tree/` (draw, hooks, io, state) e as
   regras de uso do painel que o plugin injeta no contexto das sessões (`task-tree/text/rules.ts`,
   `hooks/prompt-submit.ts`, `hooks/session-start.ts`, `hooks/tool-call.ts`), procurando
   contradições entre o que as regras pedem e o que o código faz.
3. Relatório: cada achado com severidade, evidência (`arquivo:linha`) **e proposta de correção**,
   sem implementar nada.
4. Só esta sessão agora; Implementação e Governança serão abertas depois, pelo usuário.

## Frente e limites

- Frente: `analise-codigo`, tipo análise, só leitura do código. Repositório
  `<repo>`, branch `fix/task-tree-serie-9`
  (limpa; HEAD `a507825`, merge do PR #20).
- Proibido: alterar qualquer arquivo do repositório, commit, push, trocar de branch, rodar testes
  ou build. Só escrever dentro de `DocsAnaliseCodigo` e no seu arquivo de notas.
- Fontes: os 32 arquivos em `task-tree/` (~29 mil linhas de .ts/.tsx/.d.ts, boa parte em
  `.claude-plugin/types/*.d.ts`, que são tipos do kit e servem só de referência da API), mais
  `task-tree/DESENVOLVIMENTO.md`, `task-tree/hooks/hooks.json`, `task-tree/.claude-plugin/plugin.json`.
- Contexto útil: o painel é redesenhado em SVG por linha; o app recria os SVGs a cada redesenho e
  reconstrói o painel ~2×/s sozinho; animações são quadros desenhados pelo mod (100 ms, 500 ms total);
  filhas publicam estado em `~/.claude/task-tree-waits/<id>.json` e a mãe lê a cada 3 s
  (`hooks/sessions.ts`, `io/publish.ts`, `io/host.ts`); visão resumida em `draw/layout.ts`;
  leitura de git em `io/git.ts`. Planos de ajustes anteriores estão na pasta de notas
  (`analise-task-tree-*.local.md`), úteis para saber o que já foi decidido.

## Dimensões a cobrir (mínimo)

- Fluxos de estado das tarefas (plan/start/done, replanejamento, reabertura, ids curtos/ambíguos,
  agentes e sessões filhas, rodadas descartadas, interrompidas) e seus casos não tratados.
- Sincronização entre sessões (publicação, polling, sessões paradas/abortadas, mensagens ✉,
  divergência conhecida: painel mostrou "na fila" quando o app disse entregue).
- Desenho: geometria, layout, visão resumida, animações, cores por tema, contagens do topo.
- Hooks e regras: o que o texto pede às sessões vs. o que as tools aceitam; mensagens de erro;
  casos omissos.
- Durabilidade/estado (`state/durability.ts`, `state/tasks.ts`), log, git.
- Observação conhecida: o log mostrou desenhos de 7 e 30 linhas alternados (duas instâncias do painel?).

## Entregáveis em `DocsAnaliseCodigo`

- Documentos auxiliares por dimensão (um `.md` cada), com os achados brutos e a verificação.
- `relatorio-executivo.md`: sumário, método (workflow usado, nº de agentes, verificação
  adversarial), achados ordenados por severidade com evidência e proposta, dúvidas abertas para o
  usuário, fluxos não mapeados. Em português, sem códigos internos de relatório (descrever o item,
  não "R1/H6").

## Fim do turno

Encerre com relato cujos primeiros ~400 caracteres digam: o que foi entregue, caminho do
relatório, nº de achados por severidade, o que não foi verificado. Seu arquivo de notas:
`claude-code-mod-task-tree-notas\analise-codigo-task-tree.local.md`. Não termine com pergunta ao
usuário; dúvidas vão para a seção "dúvidas abertas" do relatório.
