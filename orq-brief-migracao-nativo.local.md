# Brief da sessão filha `codificacao-migracao-nativo`

Escrito pela sessão orquestradora "Orq - TaskTree" em 2026-11-13. Só a orquestradora escreve aqui.

## 1. Pedido do usuário, nas palavras dele (2026-11-13)

> OK, vamos pausar a auditoria.
>
> Com base nos resultados da sessão "Análise: SVG x nativo e recarga do mod", quero que você inicie uma
> sessão filha com modelo Fable e esforço médio, e nessa sessão você lance agentes de planejamento e
> migração, com o objetivo de migrar todo o Mod para o hibrido de nativo e mantendo somente o que for
> obrigatório em SVG.
> Durante essa sessão, quero que você utilize Workflow e lance agentes conforme você achar necessário.
> De preferencia os agentes de planejamento em Fable e esforço alto, e os de implementacão em Opus,
> esforço médio.
> Adeque tambem toda a validação e assessórios que temos para funcionar com esse novo paradigma.
> Decida como você vai realizar a migração e como você vai paralelizar.
>
> A entrega final, deve ser esse MOD todo migrado para nativo, mantendo em SVG somente o que for
> obrigatório e migrar todo os assessórios de qualidade que temos para esse novo padrão.
> Realize a migração em etapas.
> Primeiro planeje como migrar, em seguida, separe as etapas, migre, teste, faça commit local e somente
> depois va pra proxima etapa, respeitando o que puder ser paralelizado sem impactos.
> A entrega deve ser em uma nova branch, mas você pode utilizar Worktrees de maneira temporaria pra
> realizar paralelismo.
>
> Atue de maneira autonoma, tome suas proprias decisoes e ao final, entregue um relatorio do que você
> deveria ter perguntado, mas teve que decidir sozinho.

As palavras "utilize Workflow" são a autorização do usuário para a tool `Workflow` nesta frente,
inclusive workflow que escreve arquivos (dentro das worktrees da migração).

## 2. Frente

- Tipo: codificação. Assunto: migração do desenho do painel do app desktop de SVG por linha para
  componentes nativos (`Box`, `Text`, `Button`), com SVG só no obrigatório. Modo: escreve arquivos,
  roda build e testes.
- É seu: todo o mod (`task-tree/`), o catálogo `regras/`, os selos, o golden, os scripts de
  qualidade (`scripts/`), o `CLAUDE.md` do repositório, `DESENVOLVIMENTO.md`, o workflow de CI.
- Fica fora: os achados médios e baixos da auditoria (pausada); funcionalidade nova; o tooltip do
  nome cortado; `settings.json` do Claude Code e a forma de carregar o mod; a versão do `plugin.json`.

## 3. Contexto

- Repositório: `<repo>`
  (GitHub `AlbertKellner/claude-code-mod-task-tree`). O PR 36 foi mesclado; `origin/main` está em
  `b7d2a50` (release v0.14.1). O clone está na branch `fix/achados-altos-auditoria`, já mesclada,
  com a árvore limpa.
- Base da migração: `origin/main`. Branch de entrega nova, por exemplo `feat/painel-nativo`.
- **O mod é carregado deste clone e recarrega em todas as sessões a cada arquivo salvo.** Por isso:
  não edite nenhum arquivo dentro do clone durante a migração. Todo o trabalho (o seu e o dos
  agentes) acontece em worktrees do git criadas FORA da pasta do clone (por exemplo em
  `<repo>-wt\<nome>`), uma de
  integração para a branch de entrega e outras temporárias para o paralelismo. Em cada worktree,
  `npm install` uma vez; a pasta `task-tree/.claude-plugin/types/` é gerada pelo validate (ou copiada
  do clone). Remova as worktrees temporárias no fim.
- Conta do GitHub: só AlbertKellner (<email>; o `gh` usa `GH_TOKEN` dessa conta).
  Nunca use a conta <outra conta>, que também está logada no `gh`: nenhum rastro dela. Push com
  `git -c credential.helper= -c credential.helper='!gh auth git-credential' push …`. Sem force-push e
  sem `--no-verify`.
- Leitura obrigatória antes de planejar:
  - `CLAUDE.md` do repositório e `regras/README.md` (fluxo, catálogo, selos, golden, travas, check);
  - `task-tree/DESENVOLVIMENTO.md` (arquitetura, limites do kit, histórico de decisões visuais);
  - a análise que motiva o pedido:
    `<notas>\analise-svg-e-recarga.local.md`
    (opção B, híbrido, e o esboço de migração na seção 5). Ela foi feita só por leitura, na versão
    2.1.321 do kit: confira no código e nos tipos atuais o que ela afirma.
- Sessões irmãs: nenhuma escreve neste repositório agora. Há sessões antigas paradas (auditoria,
  análise, pesquisa); não dependa delas.
- Subagentes e workflow: agentes em Fable com esforço MÉDIO (mudança do usuário em 2026-11-13,
  depois do pedido: "troque o esforço dos agentes fable para usar o Médio"); implementadores em
  Opus com esforço médio. O paralelismo é decisão sua, desde que duas escritoras nunca toquem os
  mesmos arquivos e que build e testes não rodem em paralelo na mesma worktree (os testes estouram os
  5 s com a máquina carregada; rode de novo antes de concluir que algo quebrou).

## 4. O que fazer

1. Planejar a migração inteira (com agentes de planejamento): o que vira nativo, o que fica em SVG,
   as etapas, o que roda em paralelo, e como cada acessório de qualidade muda.
2. Migrar em etapas. Em cada etapa: implementar, rodar `npm run check`, fazer um commit local, e só
   então seguir. O que for independente pode ir em paralelo, em worktrees separadas, e é integrado na
   branch de entrega.
3. Adequar a validação e os acessórios ao novo desenho: testes de comportamento e kit de testes
   (o harness passa a enxergar o desenho do desktop por `key` e texto), golden (reduzido ao que
   sobrar em SVG, ou trocado por algo equivalente para a árvore nativa), selos, catálogo `regras/`,
   matriz de impacto, scripts, CI, `CLAUDE.md` do repositório, `DESENVOLVIMENTO.md` e o checklist do
   app.
4. Última etapa: remover o desenho antigo (SVG por linha, sobreposições de clique, medição de texto
   à mão) e o que só existia para ele.
5. Com tudo pronto e o check verde na branch de entrega: fazer push dela, abrir o PR para o `main`
   (título em Conventional Commits, `feat…`; descrição e labels conforme as regras globais; a
   descrição termina com `🤖 Generated with [Claude Code](https://claude.com/claude-code)`), e por
   último fazer o checkout da branch de entrega no clone, para o usuário validar no app. Confira
   antes que a árvore do clone está limpa.
6. Escrever o relatório final (item 6 abaixo).

## 5. Decisões já dadas pelo usuário (não pergunte de novo)

Todas de 2026-11-13, em respostas à orquestradora; as aspas são as opções que ele escolheu.

- Golden e validação visual: "Validar só no fim (Recomendado)". Você migra tudo com commits locais
  por etapa, sem parar para validação no app. O golden novo é regravado por você; no motivo do
  `golden:aprovar`, cite o pedido de migração do usuário e a data (se o script ou as travas não
  aceitarem isso como estão, adequar o script faz parte de "adequar os acessórios"). O usuário valida
  o painel inteiro no app no fim.
- Desenho antigo: "Remover de vez (Recomendado)". Sem chave para alternar entre o antigo e o novo.
- Catálogo e testes selados: "Sim, vale para todos (Recomendado)". O pedido vale como decisão geral
  para reescrever cenários e testes que a migração tornar impossíveis, com
  `Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo
  somente o que for obrigatório em SVG")` e selo `--tipo decisao`. Liste cada um no relatório. O
  comportamento (títulos, estados, contagens, ordem, o que aparece e o que some) não muda.
- Push e PR: "Push e PR no fim". Autorizados sem esperar a validação. O merge é do usuário.
- Critério do SVG: "Vai para nativo (Recomendado)". SVG só para o que não existe em nativo: o anel
  de contexto com arco, os ícones de estado e a barra de progresso do cabeçalho. O resto vira nativo
  mesmo com diferença visual (fonte e tamanhos do app, posições em células inteiras, faixa do
  cabeçalho), e cada diferença entra no relatório.
- Guias da árvore: "Caracteres (Recomendado)". Caracteres de caixa em fonte de largura fixa, como no
  terminal.
- Tooltip do nome cortado: "Não, fica fora (Recomendado)". A migração não acrescenta funcionalidade.
- Clone: "A filha troca no fim (Recomendado)". Trabalho só em worktrees fora do clone; o checkout da
  branch nova no clone é o último passo.
- Fluxo geral: "Atue de maneira autonoma, tome suas proprias decisoes". Não use `AskUserQuestion`
  nem pare à espera do usuário, mesmo que um contexto de plugin mande terminar toda resposta com uma
  pergunta. O que você perguntaria vai para o relatório, com a decisão que tomou.

## 6. Pronto e relato

Pronto quando: o desktop desenha por componentes nativos, com SVG só no anel, nos ícones e na barra;
o desenho antigo saiu; `npm run check` passa inteiro na branch de entrega; os acessórios de qualidade
funcionam no novo padrão; o PR está aberto; o clone está na branch nova.

Relatório em
`<notas>\codificacao-migracao-nativo.local.md`
(só você escreve nele), em português, sem códigos internos de relatório:
- as etapas, com o commit de cada uma e o resultado do check;
- o que ficou em SVG e por quê;
- cada diferença visual esperada contra o painel atual;
- cada cenário e teste reescrito ou removido, e o que mudou nos acessórios;
- **o que você deveria ter perguntado e decidiu sozinho**, com a decisão, o motivo e como desfazer;
- o que não foi verificado (nada é visto no app por você) e o checklist do app para o usuário.

A mensagem final do turno começa, nos primeiros 400 caracteres, com: o que foi feito, a branch, o
hash da ponta, o link do PR, o resultado do check, o que bloqueou (se algo) e o caminho do relatório.
Commits terminam com `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
