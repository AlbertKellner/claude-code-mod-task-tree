# Briefing: pesquisar e documentar como fazer MODs do Claude Code

Autor: sessão principal (orquestradora). Destinatária: sessão `analise-docs-mods`
(Fable; o usuário ajustou o modelo/esforço na própria sessão). Data: 2026-10-24.

## Pedido do usuário (palavras dele)

> Pesquisar e documentar como fazer MODs para o Claude Code, que são as telas e painéis
> interativos usando recursos do próprio Claude Code, com animações, dados das sessões, e etc...
> Com o objetivo de documentar e auxiliar a criação de novas funcionalidades para a IDE do Claude
> Code e manutenção das que já existem (como a Task Tree, por exemplo)
> Use a pasta DocsDocumentacaoMods para gravar os documentos auxiliares da analise e para gerar um
> relatório executivo.
> A sessão filha está autorizada a abrir o workflow para realizar essa tarefa.

Sessão pedida: "Sessão de Análise: Fable, Ultracode". Ultracode = usar a tool `Workflow`
(orquestração multiagente) como padrão para o trabalho substantivo; carregue a skill
`workflow-authoring` antes de escrever o script.

## Ordem de execução (decisão do usuário)

Esta tarefa roda **em sequência**, depois da análise completa do código do task-tree, feita pela
sessão `analise-codigo` (id `local_cd0c6a43-9f07-44ce-a6c5-67210b0dbd3c`, saída em
`claude-code-mod-task-tree-notas\DocsAnaliseCodigo\`). Até receber o sinal, **não comece**: não
leia, não rode, não escreva; encerre o turno dizendo que está à espera, sem consultar em laço.
O sinal é uma mensagem (SendMessage) da sessão `analise-codigo` ou da principal dizendo que a
análise terminou e onde está o relatório. Ao recebê-lo, confira que
`DocsAnaliseCodigo\relatorio-executivo.md` existe e aproveite os achados dela como insumo (o que o
código do task-tree faz de errado ou de forma frágil também é lição para o guia).

## Decisões já tomadas pelo usuário (não perguntar de novo)

1. Pasta de saída: `<notas>\DocsDocumentacaoMods\`
   (fora do repositório, já criada; nada é versionado).
2. Fontes: **todas**. (a) Tipos do kit em `task-tree/.claude-plugin/types/claude-code/index.d.ts`,
   `claude-code-mcp/index.d.ts`, `claude-code-tools/index.d.ts`; (b) a skill `plugin-authoring` do
   Claude Code (carregue-a com a tool Skill; ela é a fonte oficial de como fazer um mod e de seus
   hooks); (c) o código do task-tree (`task-tree/draw`, `hooks`, `io`, `state`, `text`,
   `DESENVOLVIMENTO.md`, `hooks/hooks.json`, `.claude-plugin/plugin.json`) como exemplo real; (d)
   outros mods instalados na máquina, p.ex. savvy-progress e os plugins em
   `C:\Users\<usuario>\.claude\plugins\` (procure por `plugin.json` com hooks/render);
   (e) documentação oficial na web (docs do Claude Code sobre plugins, hooks, mods, tools
   registradas via MCP) e a skill/agente `claude-code-guide`, se ajudarem.
3. Formato: **guia + referência**: guia passo a passo (criar o plugin, registrar o painel,
   renderizar SVG, animar, ler dados de sessões e do turno, hooks, registrar tools, publicar estado
   entre sessões, recarga durante o desenvolvimento, depuração/log) mais referência da API (cada
   recurso do kit com assinatura, limites conhecidos e exemplo de código), e um relatório executivo
   com lacunas, dúvidas e recomendações. Exemplos tirados do task-tree devem citar `arquivo:linha`.

## Frente e limites

- Frente: `analise-docs-mods`, tipo pesquisa/documentação, só leitura do repositório
  `<repo>` (branch
  `fix/task-tree-serie-9`). Só escreve em `DocsDocumentacaoMods` e no seu arquivo de notas.
- Proibido: alterar arquivos do repositório, commit, push, trocar de branch, build, testes.
- Fatos já aprendidos no projeto que o guia deve registrar (com verificação nas fontes): o app recria
  todos os SVGs a cada redesenho e reconstrói o painel ~2×/s sozinho, então animações CSS/SMIL
  recomeçam; não há JS dentro do SVG nem acesso ao DOM; animações viáveis são quadros desenhados pelo
  mod via `invalidate` (task-tree usa 100 ms por quadro, 500 ms no total); as sessões filhas
  publicam estado em arquivos (`~/.claude/task-tree-waits/<id>.json`) lidos pela mãe por polling
  (3 s); tokens de cor do app (claro/escuro) usados pelo task-tree estão em `draw/svg.ts`;
  a pesquisa anterior sobre animação está em
  `claude-code-mod-task-tree-notas\pesquisa-animacao-svg.local.md`.
- Em português, sem códigos internos de relatório (descrever o item, não "R1/H6").

## Entregáveis em `DocsDocumentacaoMods`

- Documentos auxiliares por tema (um `.md` cada): levantamento de fontes, inventário da API do
  kit, padrões de renderização e animação, dados de sessão/turno e hooks, comunicação entre sessões,
  ciclo de desenvolvimento (recarga, log, depuração), lições do task-tree.
- `guia-mods-claude-code.md` (passo a passo) e `referencia-api-mods.md` (catálogo).
- `relatorio-executivo.md`: sumário, método (workflow, nº de agentes, verificação), o que está
  documentado com confiança, lacunas da API ou da documentação oficial, dúvidas abertas para o
  usuário, recomendações para manter o task-tree e criar mods novos.

## Fim do turno

Encerre com relato cujos primeiros ~400 caracteres digam: o que foi entregue, caminho do relatório
e do guia, o que não foi verificado. Seu arquivo de notas:
`claude-code-mod-task-tree-notas\analise-docs-mods-claude-code.local.md`. Não termine com pergunta
ao usuário; dúvidas vão para a seção "dúvidas abertas" do relatório.
