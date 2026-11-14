# Por que a versão do plugin não sobe e a release não é criada

Pedido: "sim, quero subir a versão, mas não manualmente. Verifique porque não esta subindo versao
e/ou não está criando uma nova release pelo workflow do github actions. Verifique o que falta
configurar ou fazer".

## Diagnóstico
- Único workflow: `.github/workflows/release.yml` ("Release"), disparado por PR fechado na `main` e
  só quando mesclado. Ele **lê** `task-tree/.claude-plugin/plugin.json` (`jq -r .version`), monta a
  tag `v<versão>` e cria a release; **se a release já existe, sai com "a versão não mudou neste PR"**.
- **Nada no repositório sobe a versão.** Não há release-please, semantic-release, changesets nem
  script de bump; o workflow assume que a versão foi editada à mão no PR.
- `plugin.json` está em **0.7.4** desde 20/10. Releases: só **v0.7.4** (2026-10-20); tags: só
  `v0.7.4`.
- Execuções: as das séries 2 a 9 (PRs #14 a #21) terminaram **com sucesso** em 7–12 s — todas no
  ramo "release v0.7.4 já existe". Ou seja, o workflow funciona; só não há versão nova para publicar.
- Configuração do GitHub: permissões padrão do `GITHUB_TOKEN` = `read`, mas o workflow declara
  `permissions: contents: write` (vale para ele); **a `main` não tem proteção de branch** (o
  `GITHUB_TOKEN` pode fazer push nela); "Actions pode criar/aprovar PRs" = desligado (só importa
  para a opção release-please, não escolhida).
- Títulos dos commits e PRs já seguem Conventional Commits com escopo (`fix(task-tree): …`,
  `feat(task-tree): …`): servem como entrada para o bump.
- Efeito colateral: o Claude Code guarda o plugin em cache por versão
  (`~/.claude/plugins/cache/<marketplace>/task-tree/<versão>`). Com a versão parada em 0.7.4, uma
  atualização pelo marketplace pode não trocar o código instalado — o que explica a máquina nova
  ter ficado com uma série antiga.

## Decisão do usuário
Opção "no merge, pelo título do PR". Quem define a versão é o próprio workflow, sozinho, pela
primeira palavra do título do PR mesclado: `fix` → patch (0.7.4 → 0.7.5), `feat` → minor
(0.7.4 → 0.8.0), `!` depois do tipo ou `BREAKING CHANGE` no corpo → major. Ninguém edita o
`plugin.json` à mão. (A ideia de um botão "Run workflow" para a versão atrasada confundiu e foi
deixada de lado: não é necessária, ver passo 4.)

## O que falta
### Mudança em arquivo do repositório (vai para a implementação)
1. `.github/workflows/release.yml`, depois do checkout (com `ref: main` e `fetch-depth: 0`, para
   commitar em cima da main atual, não do merge commit desatualizado):
   - **Calcular o nível**: do `github.event.pull_request.title` e do `body`:
     `^[a-z]+(\([^)]*\))?!:` ou `BREAKING CHANGE` → major; `^feat` → minor; qualquer outro → patch.
   - **Calcular a nova versão** a partir de `jq -r .version task-tree/.claude-plugin/plugin.json`.
   - **Gravar** com `jq --arg v "$new" '.version=$v'` (arquivo temporário e `mv`, preservando o
     resto), `git config user.name "github-actions[bot]"` e o e-mail
     `41898282+github-actions[bot]@users.noreply.github.com`, commit
     `chore(release): task-tree v<nova>` só do `plugin.json`, e `git push origin HEAD:main`.
   - **Criar a release** com `--target` o SHA desse commit novo (não o do merge), título
     `task-tree v<nova>` e `--generate-notes`. Manter a checagem "release já existe".
   - Evitar laço: o push do `GITHUB_TOKEN` não dispara outros workflows; e o gatilho é só
     `pull_request closed`, então o commit de release não roda o workflow de novo.
   - `concurrency: release` (um de cada vez), para dois merges seguidos não brigarem pela versão.
2. Opcional: o mesmo bump para o `marketplace.json`, se um dia ele passar a ter `version` (hoje não
   tem; não precisa).
### Configuração no GitHub (o usuário)
3. **Nada obrigatório hoje**: o workflow já pede `contents: write` e a `main` não é protegida. Se a
   `main` ganhar proteção no futuro, será preciso permitir o push do `github-actions[bot]` (regra
   de bypass) ou usar um token de app/PAT em secret.
### Versão atrasada (série 9)
4. Não precisa de ação à parte: o PR que trouxer a mudança do workflow, ao ser mesclado, já roda o
   workflow novo (o `pull_request closed` usa o arquivo do commit de merge) e sobe a versão a partir
   de 0.7.4, publicando tudo o que está na main, série 9 incluída. Se o título desse PR for
   `fix(...)` → 0.7.5; `feat(...)` → 0.8.0.

## Verificação depois do merge
- Aba Actions: o "Release" do PR mostra o passo de bump e o commit `chore(release)` na main.
- `gh release list`: release nova `vX.Y.Z` com as notas geradas.
- `plugin.json` da main com a versão nova; numa máquina com o plugin do marketplace, `/plugin` →
  atualizar troca de versão e baixa o código novo.
