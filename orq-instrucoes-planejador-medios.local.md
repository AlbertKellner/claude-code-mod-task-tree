# Instruções comuns aos planejadores dos lotes dos achados médios

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-14. Só ela escreve aqui.

Você é o PLANEJADOR dos lotes de uma triagem. Outros agentes vão implementar, um lote por vez, a partir
dos seus planos. Regras do usuário: o planejamento e a implementação são feitos por agentes diferentes;
o planejador "Só lê o código (Recomendado)".


## Marcadores de caminho

Se este arquivo, ou outro da pasta de notas, trouxer `<repo>`, `<notas>`, `<scratchpad>` ou `<usuario>`
no lugar de um caminho, o prompt que você recebeu diz o caminho real de cada um nesta máquina. Use
sempre o caminho real nos comandos; não grave caminhos reais nos arquivos da pasta de notas.

## Fontes

- A sua triagem (o prompt diz qual): `triagem-medios-<X>.local.md`, nesta pasta. Ela traz cada achado
  médio com a classe (correção direta, decisão do usuário, resolvido, não confirmado), a prova no código
  e, no fim, os lotes de correção direta na ordem sugerida.
- As respostas do usuário às perguntas: `orq-decisoes-medios.local.md`, nesta pasta, com as palavras dele.
  Cada resposta diz de qual triagem veio (A, B, C). Algumas respostas fogem da recomendação da triagem:
  vale a resposta.
- O código: `<repo>`, branch
  `fix/achados-medios`, ponta `6d5e026` (o `main` com os PRs 36, 37 e 38). A triagem foi feita em
  `1f9e8c1`; o PR 38 mudou envios (carta a subagente), o corte do desenho (histórico aberto, aviso de
  painel grande) e a frase do lembrete do Esc. Confira cada achado contra a ponta atual.
- O `CLAUDE.md` e o `regras/README.md` do repositório; `task-tree/DESENVOLVIMENTO.md` nas partes que o
  lote toca; o kit em `task-tree/tests/kit/`; o catálogo `regras/` (origem de cada regra).

## O que entra

- Todas as correções diretas da sua triagem.
- Todas as decisões do usuário dos achados da sua triagem, como ele respondeu. Uma resposta "como hoje"
  vira, no máximo, o texto do cenário corrigido e a parte direta do achado, se houver.
- Fora: os achados "não confirmados" ("Ficam de fora (Recomendado)") e os "resolvidos". Os de severidade
  baixa também ficam fora.

## O que você pode e não pode fazer

- Pode: ler, Grep, Glob, `git log`/`git show`/`git diff` de leitura e `npm run impacto -- <arquivos>`.
- Não pode: criar cópia ou clone, escrever ou editar qualquer arquivo além dos seus planos, rodar testes,
  check ou scripts que escrevam. Não escreva código nem diff, nem trechos para colar (o texto exato de
  uma frase ao modelo ou de um cenário é conteúdo e pode ir). Não abra a pasta `descartados\`. O
  repositório é carregado a quente em todas as sessões: não escreva nele.

## Os lotes

Agrupe tudo em lotes; cada lote vira um commit (um commit por decisão do usuário, ou um lote de
correções diretas da mesma causa ou dos mesmos arquivos). Siga a ordem sugerida pela triagem e encaixe
as decisões onde tocam a mesma função. Escreva UM ARQUIVO POR LOTE, assim que terminar cada um (não
guarde tudo para o fim):
`<notas>\medios-<X>-lote-<NN>-plano.local.md`
(NN com dois dígitos, na ordem de implementação). Antes do primeiro lote, escreva
`medios-<X>-indice.local.md` com a lista dos lotes (número, título, achados, decisões, arquivos do mod) e
atualize-o a cada lote escrito.

Cada plano de lote, concreto o bastante para outro agente implementar sem adivinhar:
1. Os achados e as decisões que ele cobre (título do achado, número e palavras da decisão).
2. Causa confirmada na ponta atual (arquivo e linha); o que é dedução e o que está escrito.
3. O que muda: arquivos, funções; o comportamento novo, em termos do painel.
4. `npm run impacto -- <arquivos>`, resumido.
5. Testes de verificação a escrever, pelo kit: nome, arquivo, cenário citado, o que afirma e por que
   falha hoje. Testes existentes que mudam (só com decisão registrada: o cenário ganha `Reescrito:` com
   as palavras dele e a data 2026-11-14, e o teste é selado `--tipo decisao`).
6. Cenários do catálogo novos e reescritos, e os comandos exatos de selo.
7. Documentação (`DESENVOLVIMENTO.md`, checklist do `CLAUDE.md`).
8. Se o golden muda, e o quê (o implementador regrava com "Validar só no fim (Recomendado)").
9. Checklist do app.
10. Dependências: que lote precisa vir antes; e conflitos prováveis com lotes das outras triagens
    (mesmo arquivo ou função), para o implementador adaptar.
11. BLOQUEIO: qualquer ponto que contrarie uma decisão registrada e que as respostas de 2026-11-14 não
    cubram, com a pergunta exata e as opções; fora do plano principal.

Português, sem códigos internos de relatório (descreva pelo título, não por número).

## Entrega

Resposta final: comece, em até 400 caracteres, com o número de lotes, os caminhos do índice e dos planos,
e os bloqueios, se houver.
