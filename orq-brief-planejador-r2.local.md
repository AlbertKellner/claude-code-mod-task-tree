# Brief comum dos planejadores da rodada 2 (PR AlbertKellner/claude-code-mod-task-tree#36)

Você é o PLANEJADOR de uma correção no mod task-tree do Claude Code. Não altere o repositório real:
só leia, ensaie numa cópia no scratchpad e entregue o plano e um diff.

## Contexto

- Repositório real: `<repo>`, branch
  `fix/achados-altos-auditoria`, HEAD `b02a9a9`. NÃO leia o código pela árvore de trabalho dele: outro
  agente está aplicando ali, agora, a correção dos itens 1 e 2 (sem commit ainda), e o mod recarrega a
  quente desse clone em todas as sessões. Não escreva nada nele, não crie worktree nele.
- Sua base de trabalho: um `git clone` local do repositório real para uma pasta SUA no scratchpad
  (nome único, ex.: `r2-<item>`), em `b02a9a9`, e por cima dele `git apply` de
  `<notas>\correcao-r2-itens-1-2.diff`
  (os itens 1 e 2 entram antes do seu). Faça um commit local na cópia depois desse apply, para o seu
  diff sair só com a sua mudança (`git diff` contra esse commit).
- Na cópia: `npm install` uma vez. Se o `claude plugin validate` não gerar
  `task-tree/.claude-plugin/types/`, copie a pasta do repositório real (ela é ignorada pelo git).
- Leia o `CLAUDE.md` do repositório (fluxo, catálogo `regras/`, selos, golden, travas) e
  `regras/README.md`.
- Pasta de notas (fora do repo): `<notas>`.
  Decisões do usuário desta rodada, com as palavras dele e a data: `orq-decisoes-altos.local.md`.
  Auditoria de origem: `auditoria-mod-task-tree.local.md` e o anexo.
- Outros planejadores rodam em paralelo, cada um na sua cópia, para os outros itens da rodada. As
  implementações serão em série, e o seu diff pode ser aplicado depois de outros itens: por isso o
  plano precisa trazer os comandos exatos de selo (`npm run regras:selar ...`), para o implementador
  refazer `regras/selos.json` se o diff colidir nesse arquivo.

## Regras

1. Só entra o que a decisão do usuário cobre. Nenhum outro teste selado, cenário decidido ou golden
   pode mudar. Se a correção exigir isso, ou se a decisão registrada não bater com o que o código faz
   hoje, pare esse ponto e descreva no plano como BLOQUEIO, com a pergunta exata ao usuário e as
   opções; não inclua no diff principal (pode entregar um diff opcional à parte).
2. Cenário reescrito ganha `Reescrito: 2026-11-12, decisão do usuário ("<palavras dele>")`. Teste
   existente que muda por decisão é selado `--tipo decisao`; teste novo, `--tipo novo`. Correção de
   bug traz o teste que reproduz o bug e o cenário no catálogo.
3. Rode na cópia `npm run check` (todas as etapas), `npm run impacto` e `npm run testes:alterados`.
   A etapa `regressao` só aceita selo `decisao` do dia.
4. Mudança no golden do SVG: não rode `golden:aprovar`. Diga no plano que o check vai falhar em
   "o desenho de <cenário> mudou", o que muda no desenho e o que o usuário deve conferir no app.

## Entrega

- `notas\correcao-r2-<item>.local.md`: causa confirmada no código, passos, cenários, testes, comandos
  de selo, resultado do check na cópia, impacto, riscos, checklist do app, e os arquivos que o diff
  toca (para o orquestrador prever colisões).
- `notas\correcao-r2-<item>.diff`: `git diff` contra a base (b02a9a9 + itens 1 e 2), aplicável com
  `git apply` na raiz do repositório.
- Português, sem códigos internos tipo "R1"/"H6". Resposta final: comece com até 400 caracteres com o
  essencial (diff pronto ou BLOQUEIO, resultado do check, caminhos dos arquivos entregues).
