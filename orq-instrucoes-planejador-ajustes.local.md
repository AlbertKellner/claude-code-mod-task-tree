# Instruções comuns aos planejadores dos ajustes do painel nativo

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-13. Só ela escreve aqui.

Você é o PLANEJADOR de um ajuste. Outro agente vai implementar a partir do seu plano. Regras do usuário,
2026-11-13: o planejamento e a implementação são feitos por agentes diferentes; o planejador "Só lê o
código (Recomendado)".

## O que você pode e não pode fazer

- Pode: ler arquivos do repositório e da pasta de notas que o seu brief cita, ler as imagens dos prints,
  usar Grep e Glob, rodar `git log`/`git show`/`git diff` de leitura e `npm run impacto -- <arquivos>`.
- Não pode: criar cópia ou clone, escrever ou editar qualquer arquivo além do seu plano, rodar testes,
  check, build, `npm install` ou qualquer script que escreva. Não escreva código nem diff, nem trechos
  prontos para colar. Não abra a pasta `descartados\` nem outras notas que o brief não cite.
- Repositório: `<repo>`, branch
  `feat/painel-nativo`, ponta `22ad5de`. Ele é carregado a quente em todas as sessões: não escreva nele.

## O que ler

O seu brief (na pasta de notas), o `CLAUDE.md` e o `regras/README.md` do repositório, a seção "Desenho
nativo híbrido" de `task-tree/DESENVOLVIMENTO.md`, o código em `task-tree/draw/` e `task-tree/hooks/`, o
kit de testes em `task-tree/tests/kit/`, os testes de `task-tree/tests/visual.test.ts` e os tipos do kit
em `task-tree/.claude-plugin/types/claude-code/index.d.ts` (props de `Box`, `Text`, cores).

## O plano

Concreto o bastante para outro agente implementar sem adivinhar:
1. Causa confirmada no código (arquivo e linha); o que é dedução e o que está escrito.
2. O que muda: arquivos, funções e props; o comportamento novo; os valores exatos (cores nos dois temas,
   larguras, alturas, espaços) e por que funcionam sem o mod saber qual tema está ativo.
3. `npm run impacto -- <arquivos que a mudança vai tocar>`, com a saída resumida.
4. Testes de verificação a escrever, pelo kit, lendo a árvore do app: para cada um, o nome, o arquivo, o
   cenário que cita, o que afirma e por que falha no código de hoje (o implementador vai provar isso).
   Testes existentes que precisem mudar, e por quê.
5. Cenários do catálogo: novos (com a origem nas palavras do usuário e a data) e reescritos (com
   `Reescrito:`). Os comandos exatos de selo (`npm run regras:selar -- "<arquivo>::<nome>" --tipo
   novo|decisao --motivo "…"`).
6. Documentação a atualizar (`DESENVOLVIMENTO.md`, checklist do `CLAUDE.md`), se for o caso.
7. O que o check deve acusar depois: quais cenários do golden mudam e o que muda neles.
8. O checklist do app: o que o harness não vê e o usuário confere.
9. Riscos e interações com os outros ajustes (todos mexem no desenho do app e serão implementados em
   série, na ordem 1, 2, 3, 4).
10. BLOQUEIO: qualquer ponto que contrarie uma decisão registrada do usuário (veja a origem dos cenários
    em `regras/`), com a pergunta exata e as opções; fora do plano principal.

Português, sem códigos internos de relatório.

## Entrega

O plano em `<notas>\<nome do arquivo
que o seu prompt indica>`. Resposta final: comece, em até 400 caracteres, com o essencial (plano pronto
ou BLOQUEIO, o caminho do arquivo, os arquivos do mod que a mudança vai tocar).
