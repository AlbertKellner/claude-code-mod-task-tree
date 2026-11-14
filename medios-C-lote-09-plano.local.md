# Lote 09 (triagem C): comentários e exports da tabela de durabilidade

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "Tabela de durabilidade e documentação desatualizadas, e o teste que a tabela diz ter não
  existe", na parte do código (correção direta). A parte do `DESENVOLVIMENTO.md` é a decisão 45, no
  lote 30.

## 2. Causa confirmada na ponta

- Escrito, `state/durability.ts:107-108` e `hooks/panel.ts:19-22`: os comentários dizem que
  `tests/durabilidade.test.ts` falha quando uma chave do state fica sem linha na tabela. Nenhum teste
  usa a tabela (o harness não lê arquivos).
- Escrito, `state/durability.ts:109-119`: `STATE_KEYS`, `STORES`, `LINK_KEYS` e `stateOf` só aparecem
  no próprio arquivo (busca na ponta: nenhum outro uso).
- Escrito, `state/durability.ts` (`TABLE`): as linhas `drawNow` e `breaksMemo` descrevem variáveis que
  não existem mais (o `DESENVOLVIMENTO.md:279-281` já diz isso).
- Escrito, `io/publish.ts:100-102`: o comentário diz que as cartas já tomadas são tiradas na
  publicação; elas vão ao arquivo (linha 146), e precisam ir: a carta verde no cartão da remetente
  depende delas.
- Escrito, `io/host.ts:10-11`: cita `tests/host.test.ts`, que não existe.
- Efeito no painel: nenhum. Quem acrescenta uma chave confia numa trava que não existe.

## 3. O que muda

- `scripts/regras.mjs` (etapa `regras` do check): uma conferência nova, por leitura de texto: cada
  chave declarada em `PluginState['task-tree']` (`types/index.d.ts:255`) tem uma linha na `TABLE` de
  `state/durability.ts` com `lives` `state` ou `state+store`, e cada linha dessas tem a chave
  declarada. Diferença: o check falha com a chave. Com isso o comentário passa a dizer a verdade.
- `state/durability.ts`: o comentário das linhas 107-108 passa a citar a etapa `regras` do check;
  saem `STATE_KEYS`, `STORES`, `LINK_KEYS` e `stateOf` e as linhas `drawNow` e `breaksMemo` da `TABLE`.
- `hooks/panel.ts:19-22`: o comentário cita a etapa `regras`, não o teste.
- `io/publish.ts:100-102`: o comentário diz que `sends` vai inteiro (as tomadas também: o cartão desta
  sessão, na que a abriu, pinta a carta entregue por elas).
- `io/host.ts:10-11`: sai a citação do teste que não existe ("cobertos pelos testes de sessões e de
  durabilidade, pelo `host` do kit").
- Painel: nada muda.

## 4. Impacto

`npm run impacto -- state/durability.ts hooks/panel.ts io/publish.ts io/host.ts`: 95 cenários
(sessões 22, envios 17, turnos 14, pedidos 14, durabilidade 9, perguntas 8, ultracode 5). É só
comentário e export sem uso: o check roda tudo e nada deve mudar. Golden: nenhum.

## 5. Testes de verificação

- `scripts/travas.test.mjs`: "uma chave do state sem linha na tabela de durabilidade falha o check",
  no molde dos casos do mapa de código (linhas 256-280 do arquivo): uma montagem mínima com um
  `types/index.d.ts` e um `state/durability.ts` de duas chaves; tirar uma linha da tabela faz a
  conferência acusar; tirar a chave dos tipos, idem. Falha hoje: a conferência não existe.
- Nenhum teste do mod muda. Nenhum selo.

## 6. Catálogo e selos

Nenhum cenário novo (regra de manutenção do código, não do painel). `regras/README.md`, parágrafo do
`scripts/regras.mjs`: acrescentar "ou uma chave do state do mod não tem linha na tabela de
durabilidade (e vice-versa)".

## 7. Documentação

Os comentários acima. `DESENVOLVIMENTO.md`: no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

Nada.

## 10. Dependências e conflitos

- Depois do lote 08 (mesmos arquivos). Como mexe em `scripts/`, a etapa `travas` roda no hook.
- Os lotes que acrescentam ou tiram chave do state passam a depender desta conferência: o 16 daqui
  (tira `recap`), o 19 daqui (uma chave nova), e os das triagens A e B que mexem em
  `types/index.d.ts` (A: 03, 05, 07, 09, 21, 23, 24; B: 10, 19, 25). Cada um atualiza a tabela no
  mesmo commit, ou o check acusa.

## 11. Bloqueio

Nenhum.
