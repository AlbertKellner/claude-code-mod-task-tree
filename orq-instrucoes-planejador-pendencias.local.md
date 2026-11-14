# Instruções comuns aos planejadores das pendências (depois do PR 37)

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-13. Só ela escreve aqui.

Você é o PLANEJADOR de um item. Outro agente vai implementar a partir do seu plano. Regras do usuário: o
planejamento e a implementação são feitos por agentes diferentes; o planejador "Só lê o código
(Recomendado)". Decisões do usuário para estas pendências: `orq-decisoes-pendencias.local.md` (nesta
pasta). Leia a seção do seu item.

## O que você pode e não pode fazer

- Pode: ler arquivos do repositório e as notas que o seu prompt cita, usar Grep e Glob, rodar
  `git log`/`git show`/`git diff` de leitura e `npm run impacto -- <arquivos>`.
- Não pode: criar cópia ou clone, escrever ou editar qualquer arquivo além do seu plano, rodar testes,
  check, build, `npm install` ou qualquer script que escreva. Não escreva código nem diff, nem trechos
  prontos para colar. Não abra a pasta `descartados\` nem notas que o prompt não cite.
- Repositório: `<repo>`, branch
  `fix/pendencias-auditoria`, ponta `1f9e8c1` (o `main` com o painel nativo, v0.15.0). Ele é carregado a
  quente em todas as sessões: não escreva nele.

## O que ler

O `CLAUDE.md` e o `regras/README.md` do repositório, `task-tree/DESENVOLVIMENTO.md` nas partes do seu
item, o código em `task-tree/` que o item toca, o kit em `task-tree/tests/kit/`, os testes da área e os
cenários do catálogo `regras/` da área (com a origem de cada um: decisões anteriores do usuário).

## O plano

Concreto o bastante para outro agente implementar sem adivinhar:
1. Causa confirmada no código (arquivo e linha); o que é dedução e o que está escrito. Se o
   comportamento já estiver certo no código de hoje, diga e prove.
2. O que muda: arquivos, funções; o comportamento novo, em termos do painel.
3. `npm run impacto -- <arquivos que a mudança vai tocar>`, com a saída resumida.
4. Testes de verificação a escrever, pelo kit: para cada um, o nome, o arquivo, o cenário que cita, o que
   afirma e por que falha no código de hoje (o implementador vai provar isso). Testes existentes que
   precisem mudar, e por quê.
5. Cenários do catálogo: novos (origem nas palavras do usuário e na data) e reescritos (`Reescrito:`).
   Os comandos exatos de selo (`npm run regras:selar -- "<arquivo>::<nome>" --tipo novo|decisao
   --motivo "…"`).
6. Documentação a atualizar (`DESENVOLVIMENTO.md`, checklist do `CLAUDE.md`), se for o caso.
7. Se o golden muda, e o quê.
8. O checklist do app: o que o harness não vê e o usuário confere.
9. Riscos e interações com os outros itens (implementados em série: carta, depois histórico e aviso,
   depois a frase do lembrete).
10. BLOQUEIO: qualquer ponto que contrarie uma decisão registrada do usuário, com a pergunta exata e as
    opções; fora do plano principal.

Português, sem códigos internos de relatório.

## Entrega

O plano em `<notas>\<nome do arquivo
que o seu prompt indica>`. Resposta final: comece, em até 400 caracteres, com o essencial (plano pronto
ou BLOQUEIO, o caminho do arquivo, os arquivos do mod que a mudança vai tocar).
