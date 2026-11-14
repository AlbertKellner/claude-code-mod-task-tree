# Lote 29 (triagem C): release, título fora do formato vira patch com aviso

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos relativos ao repositório.

## 1. O que cobre

- Achado "Regra de versão do release…", segunda pergunta.
- Decisão 48: "Patch com aviso" (a opção: "Continua virando patch, com um aviso visível no resumo do
  workflow."). Foge da recomendação da triagem (falhar o release): vale a resposta.

## 2. Causa confirmada na ponta

- Escrito, `.github/workflows/release.yml:43-49`: a minor só sai com `feat:` ou `feat(escopo):` em
  minúsculas; qualquer outro título é patch, sem aviso ("Feat: …", "feature: …", "feat add …" viram
  patch em silêncio). Em seguida vêm o commit na `main`, a tag e a release.
- Escrito, `.github/workflows/test.yml:6-9`: a conferência em PR aberto está desligada por escolha do
  usuário (2026-10-29); não se confere o título antes do merge.

## 3. O que muda

Na conta da versão (o script `scripts/versao.mjs` do lote 28; sem ele, no próprio passo do YAML):
- um título está no formato quando casa `tipo(escopo opcional)` + `!` opcional + `: ` + texto, com o
  tipo em minúsculas e entre os do Conventional Commits que o repositório usa (`feat`, `fix`, `docs`,
  `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`);
- fora do formato, o nível continua **patch** (nada falha, a versão é gravada, a tag e a release
  saem), e a conta devolve também um aviso.

`.github/workflows/release.yml`: quando há aviso, o passo escreve uma anotação `::warning::` e um
bloco no resumo do workflow (`$GITHUB_STEP_SUMMARY`): "Título do PR fora do formato Conventional
Commits: «<título>». A versão subiu como patch (<atual> → <nova>). Se a mudança era uma
funcionalidade (minor) ou quebra (major), ajuste a versão com um PR de correção de título `feat…` ou
`…!:`." O título entra por variável de ambiente, como hoje (nunca interpolado no script).

`CLAUDE.md`, "Release e PR": "título fora do formato Conventional Commits → patch, com aviso no
resumo do workflow".

Painel: nada.

## 4. Impacto

Nenhum arquivo do mod.

## 5. Testes de verificação (`scripts/travas.test.mjs`, sobre o script do lote 28)

- "título fora do formato vira patch com aviso": "Feat: x", "feature: x" e "feat add x" respondem
  patch e trazem o aviso. Falha hoje: não há aviso.
- "título no formato não traz aviso": "fix(task-tree): x", "feat: x", "chore(release): x",
  "feat(task-tree)!: x".
Sem o script, a conferência é à mão, no primeiro release.

## 6. Catálogo e selos

Nenhum.

## 7. Documentação

`CLAUDE.md` (acima); o comentário do passo no YAML.

## 8. Golden

Não muda.

## 9. Checklist do app

Nada. No GitHub: num merge com título fora do formato, o resumo do workflow "Release" mostra o aviso
em destaque e a release sai como patch.

## 10. Dependências e conflitos

- Depois do lote 28 (mesma conta, mesmo script e mesmo passo do YAML).
- Como o lote 28, vale a partir do merge do próprio PR desta rodada.
- Sem conflito com as triagens A e B.

## 11. Bloqueio

Nenhum.
