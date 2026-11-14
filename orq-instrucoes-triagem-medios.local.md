# Instruções comuns à triagem dos achados médios da auditoria

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-13. Só ela escreve aqui.

Decisão do usuário, 2026-11-13, "Triar os médios (Recomendado)": separar os achados de severidade média
da auditoria em correção direta de bug (entra sem pergunta, pela regra do projeto: "Bug achado é
corrigido e relatado depois, sem pedir permissão") e os que contrariam decisão do usuário ou são escolha
de produto (vão a ele, um a um). Os de severidade baixa ficam para depois: não os trie.

## Fontes

- A auditoria: `auditoria-mod-task-tree.local.md` (nesta pasta), seções "# Achados por área". Você trata
  só os achados com "Severidade:** média" das áreas que o seu prompt indica. A seção "## Perguntas ao
  usuário" (linhas 124-260) traz perguntas já formuladas para alguns achados: use-as.
- A auditoria foi feita ANTES de dois PRs já mesclados no `main`: o PR 36 (os 13 achados altos, mais
  "subagente sem fim" e "cartão do subagente neto") e o PR 37 (o painel do app desktop passou a
  componentes nativos `Box`/`Text`/`Button`, com `Svg` só nos ícones de estado, no anel e na barra do
  cabeçalho; `draw/geometry.ts` foi apagado e o desenho SVG antigo removido). Decisões já tomadas:
  `orq-decisoes-altos.local.md`, `orq-decisoes-ajustes-nativo.local.md` e `orq-decisoes-pendencias.local.md`.
- O código atual: `<repo>`, branch
  `fix/pendencias-auditoria`, ponta `1f9e8c1` (igual ao `main`). O catálogo `regras/` traz a origem de
  cada regra (decisões do usuário com data e palavras dele).

## O que você pode e não pode fazer

- Só lê: arquivos, Grep, Glob, `git log`/`git show`/`git diff` de leitura e `npm run impacto -- <arquivos>`.
- Não cria cópia, não roda testes, check nem scripts que escrevam, não escreve código, diff nem trechos
  para colar. Não abra a pasta `descartados\`. O repositório é carregado a quente em todas as sessões:
  não escreva nele. O único arquivo que você escreve é o seu, indicado no prompt.

## Para cada achado médio da sua área

Confira contra o código de hoje (arquivo e linha) e classifique:
- **Resolvido ou obsoleto:** já corrigido pelo PR 36 ou 37, ou o código que ele cita não existe mais.
  Diga por quê, com a prova (arquivo, linha ou commit).
- **Correção direta:** bug de pé, cuja correção não contraria nenhuma decisão registrada do usuário.
  Diga o comportamento errado, em termos do painel, a correção em uma ou duas frases (sem código), os
  arquivos tocados e o tamanho (pequeno, médio, grande).
- **Decisão do usuário:** a correção contraria uma decisão registrada (cite o cenário e a origem) ou é
  escolha de produto. Escreva a pergunta exata, autossuficiente (o usuário lê só a pergunta), e 2 a 3
  opções com a recomendada primeiro e marcada "(Recomendado)", cada uma dizendo o efeito no painel.
- **Não confirmado:** o caminho não se reproduz pela leitura. Diga o que faltou.

Achados que são a mesma causa ficam juntos. No fim do arquivo, a lista das correções diretas agrupadas
em lotes que podem ir num mesmo commit, na ordem sugerida, e a lista das perguntas.

Português, sem códigos internos de relatório (descreva o achado pelo título, não por número).

## Entrega

Resposta final: comece, em até 400 caracteres, com a contagem por classe (resolvidos, correção direta,
decisão, não confirmados) e o caminho do arquivo.
