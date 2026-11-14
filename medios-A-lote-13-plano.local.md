# Lote 13: leitura das filhas, higiene das arquivadas e do que é publicado

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (correção direta; nada muda no que o painel mostra).

## 1. O que cobre

- Achado "Filhas arquivadas e antigas nunca saem: painel inteiro guardado no state, arquivo relido a cada
  3 s, tudo republicado aninhado; a lista do host é pedida com limite 100": a **parte direta** (higiene).
- A decisão 11 do mesmo achado ("Vira linha resumida (Recomendado)") é o lote 24.

## 2. Causa confirmada na ponta atual

Escrito no código:
- `io/host.ts:33`: a lista é pedida com `limit: 100` e `include_archived: true`; ninguém olha se vieram
  100 linhas.
- `io/host.ts:78-97` (`readFiles`): lê e analisa o arquivo de toda linha de `mine`, arquivada ou não, a
  cada leitura (3 s).
- `io/publish.ts:131-147`: `children` vai ao arquivo como está no state, com o painel de cada filha e,
  dentro dele, as filhas dela, sem corte.
- O desenho e as contas param em `DEEP = 3` (`draw/layout.ts:143`): `session` devolve só o cabeçalho no
  nível 3 (`layout.ts:1279`), e `total`, `allTasks`, `activeLeaves` e `trimToWork` não descem além dele.

Dedução: numa orquestradora que dura dias, cada leitura relê o arquivo de cada filha arquivada, e o
arquivo publicado carrega níveis que nenhuma sessão acima desenha nem conta.

## 3. O que muda

`io/host.ts`, `hooks/sessions.ts`, `io/publish.ts`, `tests/kit/ambiente.ts`.

1. Arquivada não é relida: `readFiles` recebe as filhas conhecidas e pula a linha arquivada cuja entrada
   conhecida já estava arquivada (o arquivo dela foi lido pelo menos uma vez nesse estado). Para a
   pulada, `deriveChildren` mantém tudo o que a entrada conhecida tinha (painel, contexto, modelo, taxa,
   git, e também `aborted` e `ultracode`, que hoje vêm só da leitura atual). Desarquivada, volta a ser
   lida. Depois de um reinício (as filhas voltam do store só com as ligações, sem `archived`), a
   primeira leitura lê todas.
2. Corte de profundidade ao publicar: quem publica mantém três níveis de sessões abaixo de si (as
   filhas, as netas e as bisnetas, com o painel de cada uma) e esvazia `children` no painel das
   bisnetas. É o que a mãe de quem publica ainda usa: ela desenha quem publica no nível 0, as filhas
   dele no 1, as netas no 2 e as bisnetas no 3, estas só com o cabeçalho e a contagem das próprias
   tarefas. A constante é a `DEEP` de `draw/layout.ts`. O state desta sessão não é cortado (o painel
   dela desenha como hoje).
3. Registro das 100 linhas: quando a lista vem com 100 linhas ou mais, uma linha no log de depuração,
   uma vez por módulo: "task-tree: a lista de sessões veio com 100 linhas (o limite pedido); pode haver
   sessões fora dela".

Comportamento no painel: nenhum (é o critério de aceite). O arquivo publicado encolhe e as leituras de
3 s deixam de abrir os arquivos das arquivadas.

## 4. Impacto

`npm run impacto -- io/host.ts hooks/sessions.ts io/publish.ts`: `hooks/sessions.ts` 46 cenários,
`io/host.ts` 29, `io/publish.ts` 29 (sessoes 22, ultracode 5, subagentes 1, durabilidade 1). Checklist
por mapa: `envios.*-no-app`, `ultracode.cor-e-corte`. Golden: nenhum cenário.

## 5. Testes a escrever

Kit: `host` (`tests/kit/ambiente.ts`) ganha `leituras(id)`: quantas vezes o arquivo publicado daquela
sessão foi lido (contado no stub de `fs.read`).

1. `tests/sessoes.test.ts`, regra `sessoes.arquivada-nao-e-relida` (nova):
   **"o arquivo de uma filha arquivada não é relido a cada leitura, e o cartão segue igual"**. Roteiro:
   `abrir($, on, { rodando: false, arquivada: true, painel: { tasks: [pai com uma feita e uma aberta] } })`
   (o roteiro e o painel do teste "filha arquivada…", `sessoes.test.ts:83`); `const antes = await
   painel($)`; `const n = h.leituras(K1)`; dois `aviso($)`.
   Afirma: `h.leituras(K1)` segue `n`; o painel é igual ao de `antes` (mesmos textos); o cartão diz
   "arquivada". Depois `h.filha(K1).arquivada = false`, `h.filha(K1).rodando = true`, `aviso`:
   `h.leituras(K1)` cresceu e o cartão não diz "arquivada".
   Falha hoje: cada `aviso` lê o arquivo de novo.
2. `tests/sessoes.test.ts`, regra `sessoes.publicado-corta-a-profundidade` (nova):
   **"o painel publicado leva três níveis de sessões abaixo desta e corta o resto"**. Roteiro: `fixar`;
   `host` com K1 usando `publicado` (o texto cru do arquivo), versão 1, com `groups` de uma tarefa e
   `children` aninhados em quatro níveis (C1 dentro de K1, C2 dentro de C1, C3 dentro de C2, C4 dentro de
   C3; cada um com `id`, `name`, `title`, `running: false`, `archived: false` e um `panel` com um grupo
   de uma tarefa); `pedido`; `plan(A)`; `start(['1'])`; `abrirSessao`; `aviso`.
   Afirma, em `h.proprio()`: `children[0]` é K1; dentro dela C1 e, dentro de C1, C2, com as tarefas de
   cada um; `C2.panel.children` é `[]`. E o painel desta sessão segue mostrando K1, C1, C2 e C3 (C3 só
   com o cabeçalho), como hoje.
   Falha hoje: C3 e C4 vão no arquivo publicado.

O registro das 100 linhas não tem teste (linha de log); conferir pela leitura.

Testes existentes: nenhum muda (`sessoes.filha-arquivada-interrompe`, `subagentes.na-filha`,
`durabilidade.formatos-antigos-do-publicado`).

## 6. Catálogo e selos

`regras/sessoes.md`:

```markdown
### sessoes.arquivada-nao-e-relida
O arquivo de uma filha arquivada não é relido enquanto ela segue arquivada.

- Dado uma sessão filha arquivada, já lida uma vez nesse estado
- Quando o painel relê as sessões
- Então o arquivo dela não é aberto de novo, e o cartão segue como estava (as tarefas, a palavra "arquivada", o anel apagado); desarquivada, volta a ser lida

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: toda leitura de 3 s relia o arquivo de cada arquivada); higiene, sem mudar sessoes.filha-arquivada-interrompe.
Código: io/host.ts
Estado: coberto
```

```markdown
### sessoes.publicado-corta-a-profundidade
O painel publicado leva só os níveis de sessões que a sessão de cima ainda usa.

- Dado uma cadeia de sessões abertas umas pelas outras, com mais de três níveis abaixo desta
- Quando esta sessão publica o painel
- Então o arquivo leva as filhas, as netas e as bisnetas com as tarefas de cada uma, e nada abaixo das bisnetas; o painel desta sessão e o cartão dela na mãe mostram o mesmo de antes

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: as filhas eram republicadas aninhadas sem corte, além da profundidade que o desenho segue).
Código: io/publish.ts, draw/layout.ts
Estado: coberto
```

Selos:

```bash
node scripts/selos.mjs --kit task-tree/tests/kit/ambiente.ts --tipo refatoracao --motivo "host ganha leituras(id), a contagem de leituras do arquivo publicado; nada do que os testes existentes usam muda"
npm run regras:selar -- "task-tree/tests/sessoes.test.ts::o arquivo de uma filha arquivada não é relido a cada leitura, e o cartão segue igual" --tipo novo --motivo "correção direta: higiene da leitura das filhas"
npm run regras:selar -- "task-tree/tests/sessoes.test.ts::o painel publicado leva três níveis de sessões abaixo desta e corta o resto" --tipo novo --motivo "correção direta: higiene do arquivo publicado"
```

## 7. Documentação

`DESENVOLVIMENTO.md`: "Arquivo publicado (versão 1)" (~296-325) com o corte de profundidade em `children`;
os passos 1 e 2 da leitura das filhas (lista com o registro das 100 linhas; arquivada pulada).

## 8. Golden

Não muda.

## 9. Checklist do app

- Uma orquestradora real com filha arquivada: o cartão arquivado segue igual depois de alguns minutos, e
  volta a atualizar quando a sessão é desarquivada.

## 10. Dependências e conflitos

- Depois do lote 12 (mesma leitura; `deriveChildren` e `readFiles` mudam nos dois).
- Lote 24 (filha arquivada antiga vira uma linha) decide o que fica guardado de uma arquivada antiga;
  este lote não tira nada do state.
- Triagem C, decisão 35 ("Enxugar e esvaziar", sobre "arquivos publicados nunca são apagados, crescem
  sem teto e são relidos por inteiro a cada 3 s") e a parte direta dela mexem em `publishWait`,
  `readPublished` e `readFiles`. Se ela já tiver evitado reler arquivo que não mudou, o item 1 deste lote
  pode ficar só no teste; o corte de profundidade soma com o enxugamento dela. Decisão 34 (poda dos
  subagentes terminados) mexe nos `groups` publicados, não em `children`.
- Triagem B: nada aqui.

## 11. Bloqueio

Nenhum.
