# Lote 28 (triagem C): release, "BREAKING CHANGE" só no rodapé

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos relativos ao repositório.

## 1. O que cobre

- Achado "Regra de versão do release: BREAKING CHANGE em qualquer ponto do corpo do PR sobe a major, e
  título fora do formato vira patch sem aviso", primeira pergunta.
- Decisão 47: "Só no rodapé (Recomendado)". A opção: "Só conta no rodapé, numa linha que começa com
  'BREAKING CHANGE:', o padrão do Conventional Commits. Citar a expressão no meio do texto deixa de
  subir a major."

## 2. Causa confirmada na ponta

- Escrito, `.github/workflows/release.yml:43`: `printf '%s' "$BODY" | grep -q 'BREAKING CHANGE'`, sem
  âncora: qualquer ocorrência no corpo do PR sobe a major.
- Escrito, `CLAUDE.md`, "Release e PR": "`!` depois do tipo ou `BREAKING CHANGE` no corpo → major".
- Risco de hoje: a descrição do PR é reescrita a cada push (regra global do usuário); um PR que cite a
  regra, ou diga "sem BREAKING CHANGE", leva o plugin de 0.15.x para 1.0.0. O PR único desta rodada
  ("Um PR só no fim") vai citar esta própria regra na descrição.

## 3. O que muda

`.github/workflows/release.yml`, passo "Calcular a versão nova":
- o corpo só sobe a major quando tem uma linha que **começa** com `BREAKING CHANGE:` (ou
  `BREAKING-CHANGE:`, a outra grafia do Conventional Commits), com ou sem espaços antes; os fins de
  linha do Windows (`\r`) são tirados antes da busca;
- o `!` depois do tipo no título segue subindo a major;
- o comentário do passo (linhas 29-31) passa a dizer "linha `BREAKING CHANGE:` no rodapé do corpo".

`CLAUDE.md`, "Release e PR": "`!` depois do tipo, ou uma linha começando com `BREAKING CHANGE:` no
corpo → major; citar a expressão no meio do texto não conta".

Painel: nada.

## 4. Impacto

Nenhum arquivo do mod.

## 5. Testes de verificação

O workflow não tem teste no repositório, e o `npm run check` não o roda. Para não deixar a regra sem
prova, a conta da versão sai do YAML para um script (`scripts/versao.mjs`: recebe o título, o corpo e
a versão atual; responde o nível e a versão nova), que o workflow chama com `node` (o runner já tem
Node; o passo usa só `jq` e `grep` hoje). Casos em `scripts/travas.test.mjs`:
- "BREAKING CHANGE no meio do texto não sobe a major": corpo "sem BREAKING CHANGE neste PR" e corpo
  que cita a regra entre crases: patch (ou minor com `feat`). Falha hoje (com a regra atual seria
  major).
- "uma linha BREAKING CHANGE: no rodapé sobe a major", com `\n` e com `\r\n`.
- "o ! depois do tipo sobe a major"; "feat sobe a minor"; "o resto é patch".
Se a orquestradora preferir não criar o script, a alternativa é só trocar a expressão do `grep`
(`grep -Eq '^[[:space:]]*BREAKING[ -]CHANGE:'` sobre o corpo sem `\r`) e conferir à mão; o plano
recomenda o script, porque o lote 29 mexe na mesma conta.

## 6. Catálogo e selos

Nenhum cenário (não é regra do painel). Nenhum selo.

## 7. Documentação

`CLAUDE.md` (acima). `DESENVOLVIMENTO.md`, se citar a regra de versão: no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

Nada. Conferência no GitHub, no merge do PR desta rodada: a nota do passo diz "patch" ou "minor"
conforme o título, mesmo com a expressão citada na descrição.

## 10. Dependências e conflitos

- Independente do mod. Tem de entrar **no próprio PR desta rodada**, antes do merge: o workflow roda
  a versão que estiver na `main` depois do merge (`ref: main`), então a regra nova já vale para ele.
- Antes do lote 29 (mesma conta).
- Como mexe em `scripts/` (com o script), a etapa `travas` roda no hook.

## 11. Bloqueio

Nenhum.
