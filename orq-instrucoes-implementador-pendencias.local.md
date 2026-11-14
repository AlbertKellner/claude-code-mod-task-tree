# Instruções comuns aos implementadores das pendências (depois do PR 37)

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-13. Só ela escreve aqui.

Você é o IMPLEMENTADOR de um item. Outro agente fez o plano; você escreve o código e os testes a partir
dele, valida o resultado e faz o commit local. Decisões do usuário: "Implementador escreve o código
(Recomendado)"; "a sessão de implantacao tambem deve validar os resultados"; o implementador faz o
commit; e, para estas pendências, 2026-11-13: "A implementação deve ser feita conforme combinamos".
Decisões de cada item: `orq-decisoes-pendencias.local.md` (pasta de notas).

## Fontes

- Use só o plano que o seu prompt indica, as decisões acima e o código do repositório. Não abra a pasta
  `descartados\`, outros planos nem outros diffs.
- O plano foi escrito a partir de `1f9e8c1`. Se o seu item não é o primeiro, a ponta já tem os commits
  dos itens anteriores: adapte o plano ao código atual e diga no relato o que adaptou.
- Se algo no plano não fechar com o código, escolha o caminho mais fiel ao plano e relate. Se o plano
  trouxer BLOQUEIO, não implemente a parte bloqueada: relate.

## Repositório

`<repo>`, branch `fix/pendencias-auditoria`.
Leia o `CLAUDE.md` e o `regras/README.md`. O mod é carregado a quente desse clone em todas as sessões:
um estado intermediário que não compila aparece ao usuário como "reload failed".

## Passos

1. Confira `git status` limpo e a branch `fix/pendencias-auditoria`; anote a ponta. Se a árvore não
   estiver limpa, pare e relate.
2. Faça uma cópia sua no scratchpad (`git clone` local do repositório, na ponta atual da branch),
   `npm install`, e copie `task-tree/.claude-plugin/types/` do repositório real se o validate não a gerar.
3. Na cópia, escreva primeiro os testes novos (e as mudanças do kit, se o plano pedir) e prove que eles
   falham no código de hoje, pelo motivo que o plano diz. Guarde a saída.
4. Na cópia, implemente o resto: código, cenários do catálogo, documentação, selos
   (`npm run regras:selar …`, como o plano lista). Rode `npm run check`. Se um teste falhar por tempo
   (5 s), rode de novo uma vez.
5. Leve tudo ao repositório real de uma vez: `git diff --binary` na cópia e `git apply` no real.
6. No real: se o golden mudou, `npm run golden:aprovar -- <cenários que mudaram> --motivo "\"A
   implementação deve ser feita conforme combinamos\", 2026-11-13"`; depois `npm run check` inteiro
   (tudo `ok`), `npm run testes:alterados` e `npm run impacto`.
7. Commit local só dos arquivos que você alterou: `git commit -F <arquivo de mensagem> -- <caminhos>`
   (nunca `git add -A`, nunca `--no-verify`). Um commit por decisão do usuário (se o seu item tem duas
   partes decididas separadamente, dois commits). Mensagem em Conventional Commits, em português, dizendo
   o que muda para o usuário, terminando com a linha `Co-Authored-By: Claude Opus 5.5
   <noreply@anthropic.com>`. O hook de pré-commit roda o check: se falhar, corrija e tente de novo.
8. Não faça push. Apague a sua cópia do scratchpad no fim.

## Relato

Comece, em até 400 caracteres, com: o(s) hash(es) do commit, o resultado do check, se os testes novos
falharam na base e passaram com a mudança, se o golden mudou e o que ficou de fora. Depois: as linhas
`ok` de cada etapa do check e a contagem de testes, a saída de `testes:alterados`, o resumo do `impacto`,
os arquivos do commit e o que você adaptou ou decidiu fora do plano.
