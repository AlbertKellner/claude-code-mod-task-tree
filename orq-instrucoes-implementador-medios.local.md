# Instruções comuns aos implementadores dos lotes dos achados médios

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-14. Só ela escreve aqui.

Você é o IMPLEMENTADOR de um lote. Outro agente fez o plano; você escreve o código e os testes a partir
dele, valida o resultado e faz o commit local. Decisões do usuário: "Implementador escreve o código
(Recomendado)"; "a sessão de implantacao tambem deve validar os resultados"; o implementador faz o
commit; para estes lotes, 2026-11-14: "Um PR só no fim" e "Validar só no fim (Recomendado)". As
respostas dele aos achados estão em `orq-decisoes-medios.local.md` (pasta de notas).


## Marcadores de caminho

Se este arquivo, ou outro da pasta de notas, trouxer `<repo>`, `<notas>`, `<scratchpad>` ou `<usuario>`
no lugar de um caminho, o prompt que você recebeu diz o caminho real de cada um nesta máquina. Use
sempre o caminho real nos comandos; não grave caminhos reais nos arquivos da pasta de notas.

## Fontes

- Use só o plano que o seu prompt indica, as decisões acima e o código do repositório. Não abra a pasta
  `descartados\`, outros planos nem outros diffs.
- O plano foi escrito a partir de `6d5e026`. A ponta já pode ter commits de outros lotes: adapte o plano
  ao código atual e diga no relato o que adaptou.
- Se algo no plano não fechar com o código, escolha o caminho mais fiel ao plano e relate. Se o plano
  trouxer BLOQUEIO, não implemente a parte bloqueada: relate.

## Repositório

`<repo>`, branch `fix/achados-medios`.
Leia o `CLAUDE.md` e o `regras/README.md`. O mod é carregado a quente desse clone em todas as sessões:
um estado intermediário que não compila aparece ao usuário como "reload failed".

## Passos

1. Confira `git status` limpo e a branch `fix/achados-medios`; anote a ponta. Se a árvore não estiver
   limpa, pare e relate. Confira também a identidade do git no clone real: `git config user.email` tem
   de ser igual a `git log -1 --format=%ae`. Se for diferente, pare e relate, sem fazer commit: nenhum
   commit pode sair com outra identidade.
2. Faça uma cópia sua no scratchpad (`git clone` local, na ponta atual da branch), `npm install`, e copie
   `task-tree/.claude-plugin/types/` do repositório real se o validate não a gerar.
3. Na cópia, escreva primeiro os testes novos (e as mudanças do kit, se o plano pedir) e prove que eles
   falham no código de hoje, pelo motivo que o plano diz. Guarde a saída.
4. Na cópia, implemente o resto: código, cenários, documentação, selos (`npm run regras:selar …`). Rode
   `npm run check`. Se um teste falhar por tempo (5 s), rode de novo uma vez.
5. Leve tudo ao repositório real de uma vez: `git diff --binary` na cópia e `git apply` no real.
6. No real: se o golden mudou, `npm run golden:aprovar -- <cenários que mudaram> --motivo "\"Validar só
   no fim (Recomendado)\", 2026-11-14"`; depois `npm run testes:alterados` e `npm run impacto` (antes do
   commit). NÃO rode o `npm run check` inteiro à mão no real: ele já passou na cópia (passo 4) e o hook
   de pré-commit roda as mesmas etapas no commit (decisão do usuário, 2026-11-14: "Sim", ao ajuste de
   tirar o check repetido). Exceção: se o golden foi regravado no real, rode o check à mão antes do commit.
   A trilha paralela dos lotes de release terminou em 2026-11-14: hoje há um implementador por vez, e
   arquivo alterado que não é seu, na árvore do clone, é motivo para parar e relatar.
7. Commit local só dos arquivos que você alterou: `git commit -F <arquivo de mensagem> -- <caminhos>`
   (nunca `git add -A`, nunca `--no-verify`). Um commit por decisão do usuário; um lote de correções
   diretas pode ir num commit só. Mensagem em Conventional Commits, em português, dizendo o que muda para
   o usuário, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. O hook
   de pré-commit roda o check: se falhar, corrija e tente de novo.
8. Não faça push. Apague a sua cópia e os arquivos que você criou no scratchpad no fim.

## Relato

Comece, em até 400 caracteres, com: os hashes dos commits, o resultado do check, se os testes novos
falharam na base e passaram com a mudança, se o golden mudou e o que ficou de fora. Depois: as linhas
`ok` do check e a contagem de testes, a saída de `testes:alterados`, o resumo do `impacto`, os arquivos
de cada commit e o que você adaptou ou decidiu fora do plano.

## Trava dos testes (pedido do usuário, 2026-11-14: não estourar os 5 s)

Dois agentes podem estar trabalhando ao mesmo tempo. Nunca rode testes junto com outro agente. Antes de
QUALQUER comando que rode testes (`npm run check`, `claude plugin test`, `node scripts/travas…`, a
regressão, e o `git commit`, por causa do hook), pegue a trava; solte logo depois do comando:

- Pegar: `until mkdir "<notas>/.trava-testes" 2>/dev/null; do sleep 10; done`
- Soltar: `rmdir "<notas>/.trava-testes"`

Pegue, rode e solte no MESMO comando de shell (`until …; done; <comando>; s=$?; rmdir …; exit $s`), para a
trava nunca ficar presa se você for interrompido entre dois comandos. Vale também na sua cópia do
scratchpad: o que pesa é a máquina, não a pasta. Se a trava parecer presa há mais de 15 minutos (veja a
data da pasta), relate em vez de apagar.
