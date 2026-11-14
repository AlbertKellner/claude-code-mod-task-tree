# Lote 27 (triagem C): golden ampliado ao que o catálogo diz travar

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "O golden não contém o que os cenários visual.desenho-* dizem travar" (a tarefa ✕ e o anel
  já entraram nos PRs 36 e 37).
- Decisão 43: "Ampliar o golden (Recomendado)". A opção: "Ampliar os roteiros do golden para cobrir o
  que falta; você valida os desenhos novos no app antes do commit. O painel não muda; passa a bloquear
  o commit quando esses desenhos mudarem." Como entregar, da mesma data: "Validar só no fim
  (Recomendado)": o implementador grava o golden com esse motivo e segue com o commit.

## 2. Causa confirmada na ponta

Lendo os quatro roteiros de `tests/golden.test.ts` (a 60 colunas, `desenhoDoApp` do kit):
- "principal": dois pedidos, com ✓, ✕ (parada com Esc), ◷, ○ e linhas ↩; `host` sem git; sem
  "ultracode"; os dois pedidos ficam à vista (não há "+N pedidos anteriores").
- "filha": o cartão com busto, toks/s, repositório e branch e anel; a `Filha` do kit não publica
  modelo (`tests/kit/ambiente.ts`: não há campo para o `engine`), então o cartão não tem modelo.
- "envios": as três cartas ficam "na fila", "entregue" e, a terceira, ainda na fila depois do Esc
  (o Esc poupa a carta na fila): não há carta interrompida nem "não entregue".
- "subagente": os cartões de subagente têm modelo (o `lancaveis` do kit dá um).
- Nenhum roteiro usa mais de 60 colunas; o cabeçalho muda de forma em 84 (`draw/head.tsx:59`).
- `regras/visual.md`: `visual.desenho-principal` diz "todos os estados … e o cabeçalho em cartão com
  repositório e branch"; `visual.desenho-envios` diz "na fila, entregue e interrompida"; os checklists
  `visual.cartao-modelo-e-esforco` e `visual.cartao-posicao-de-toks-e-repo` dizem "o desenho fica
  travado por visual.desenho-*".
Falta no golden: o modelo no cartão da sessão filha, a carta interrompida, o repositório no
cabeçalho, "ultracode", a linha "+N pedidos anteriores" e o cabeçalho largo.

## 3. O que muda

Os quatro desenhos aprovados não são tocados. Entram dois cenários novos:

- **"largo"** (a 100 colunas): a sessão num repositório (o roteiro responde a leitura de `.git/HEAD`
  e a raiz da sessão, que `io/git.ts` pede ao host), com toks/s (um passo do modelo, pelo `passos` do
  kit), com o interruptor "ultracode" ligado (o anexo `ultra_effort_enter`, como
  `tests/ultracode.test.ts:55`), e dois pedidos: o primeiro todo concluído e fora do trabalho, o
  segundo em andamento. Trava: o cabeçalho largo com repositório e branch, toks/s e "ultracode", e a
  linha "+1 pedidos anteriores".
- **"filha-modelo-e-carta"** (a 60 colunas): uma filha trabalhando que publica o modelo e o esforço,
  e duas cartas cinza, como `envios.cor-por-estado` as define: uma "interrompida" (a carta ainda na
  fila cuja tarefa ficou num plano interrompido: o pedido seguinte reusa o id da tarefa do envio) e
  uma "não entregue" (o destino arquivado com a carta na fila,
  `envios.destino-arquivado-nao-entregue`). Os roteiros dos testes desses dois cenários, em
  `tests/envios.test.ts`, servem de base. Trava: o modelo e o esforço à esquerda do
  anel no cartão da sessão, e as cartas cinza.

Arquivos:
- `tests/golden.test.ts`: os dois testes novos, no molde dos quatro (`conferir(cenário, desenho)`).
- `tests/kit/leitura.ts`: `desenhoDoApp` aceita a largura (padrão 60). `tests/kit/ambiente.ts`: a
  `Filha` ganha o modelo publicado (`engine`), e o `host` passa a responder a raiz da sessão e a
  leitura de `.git/HEAD` quando o teste pede (opção nova; sem ela, tudo como hoje). Selos de
  refatoração do kit.
- `scripts/selos.mjs` (a lista `CENARIOS`, levada para lá no lote 03): os dois nomes novos.
- `tests/golden/desenho.ts` e `regras/selos.json`: gravados pelo `golden:aprovar`.
- Nenhum arquivo do mod.

Em termos do painel: nada muda. Uma mudança nesses desenhos passa a bloquear o commit.

## 4. Impacto

Nenhum arquivo do mod tocado.

## 5. Testes

Novos: "golden: largo" (regras `visual.golden-gera-desenho`, `visual.desenho-cabecalho-largo`) e
"golden: filha-modelo-e-carta" (regras `visual.golden-gera-desenho`,
`visual.desenho-filha-modelo-e-carta`). Sem cenário gravado, o teste só confere que há desenho e
imprime o atual; depois do `golden:aprovar`, compara.
Existentes: os quatro testes de golden não mudam de corpo. `visual.golden-gera-desenho` muda de texto
por decisão (abaixo), sem mudar os testes que a citam.

## 6. Catálogo (`regras/visual.md`) e selos

Reescritos (todos com `Reescrito: 2026-11-14, decisão do usuário ("Ampliar o golden (Recomendado)")`):
- `visual.golden-gera-desenho`: "Dado os 6 cenários do golden (principal, filha trabalhando, envios,
  subagente, largo, filha com modelo e cartas); os quatro primeiros a 60 colunas, o largo a 100".
- `visual.desenho-principal`: o "Dado" passa a dizer o que o roteiro tem: "uma árvore de 3 níveis em
  dois pedidos, com tarefa concluída, interrompida (parada com Esc), aguardando e pendente, as linhas
  ↩ e o cabeçalho em cartão, a 60 colunas"; o repositório no cabeçalho, "ultracode" e "+N pedidos
  anteriores" ficam em `visual.desenho-cabecalho-largo`.
- `visual.desenho-envios`: "Dado tarefas de mensagem na fila e entregue, e a carta que segue na fila
  depois do Esc"; a interrompida e a não entregue ficam em `visual.desenho-filha-modelo-e-carta`.
- Os checklists `visual.cartao-modelo-e-esforco` e `visual.cartao-posicao-de-toks-e-repo`: o trecho
  "o desenho fica travado por visual.desenho-*" passa a citar os cenários certos
  (`visual.desenho-filha-modelo-e-carta` e `visual.desenho-cartao-filha`).

Novos, `coberto`:

```markdown
### visual.desenho-cabecalho-largo
O desenho do cabeçalho largo, com repositório, toks/s, "ultracode" e "+N pedidos anteriores", é o validado no app.

- Dado o painel a 100 colunas, a sessão num repositório, com toks/s medido, o interruptor ultracode ligado e um pedido anterior concluído fora do trabalho atual
- Quando o painel é desenhado no app desktop
- Então o desenho é o que o usuário validou no app

Origem: decisão do usuário, 2026-11-14 ("Ampliar o golden (Recomendado)"); gravado com "Validar só no fim (Recomendado)" e validado por ele no app antes do merge.
Código: draw/layout.ts
Estado: coberto

### visual.desenho-filha-modelo-e-carta
O desenho do cartão da filha com modelo e esforço e das cartas interrompida e não entregue é o validado no app.

- Dado uma filha trabalhando que publicou o modelo e o esforço, uma carta interrompida e uma não entregue
- Quando o painel é desenhado no app desktop
- Então o desenho é o que o usuário validou no app

Origem: decisão do usuário, 2026-11-14 ("Ampliar o golden (Recomendado)"); gravado com "Validar só no fim (Recomendado)" e validado por ele no app antes do merge.
Código: draw/layout.ts
Estado: coberto
```

Comandos, nesta ordem:
- `node scripts/selos.mjs --kit task-tree/tests/kit/leitura.ts --tipo refatoracao --motivo "desenhoDoApp aceita a largura"`
- `node scripts/selos.mjs --kit task-tree/tests/kit/ambiente.ts --tipo refatoracao --motivo "filha com modelo publicado; host com a raiz e o .git da sessão"`
- `npm run golden:aprovar -- largo filha-modelo-e-carta --motivo "\"Validar só no fim (Recomendado)\", 2026-11-14"`
- `npm run regras:selar -- "task-tree/tests/golden.test.ts::golden: largo" --tipo novo --motivo "decisão 2026-11-14: golden ampliado"`
- `npm run regras:selar -- "task-tree/tests/golden.test.ts::golden: filha-modelo-e-carta" --tipo novo --motivo "decisão 2026-11-14: golden ampliado"`

## 7. Documentação

`CLAUDE.md`, "Golden do desenho": "4 cenários (principal, filha trabalhando, envios, subagente; 60
colunas)" passa a 6, com os dois novos e a largura do "largo". Cabeçalho de `tests/golden.test.ts` e
de `scripts/golden.mjs` ("4 cenários").

## 8. Golden

Muda por desenho: dois cenários novos, gravados com o motivo combinado. Os quatro existentes não
mudam.

## 9. Checklist do app (a validação dele, no fim)

- A janela larga (mais de 84 colunas no painel): o cabeçalho com repositório e branch, toks/s e
  "ultracode", e a linha "+N pedidos anteriores" no fim.
- O cartão de uma filha real com o modelo e o esforço à esquerda do anel.
- Uma carta interrompida e uma "não entregue", cinza, sob a tarefa.

## 10. Dependências e conflitos

- Depois do lote 03 (onde vive a lista de cenários e a conferência dela) e do 26 (tempos).
- Por último entre os lotes que mudam desenho, das três triagens: cada lote de desenho que entrar
  depois regrava também estes dois cenários. Os que mais pesam: triagem B, lote 20 (decisão 27: toks/s
  e "ultracode" em qualquer largura, muda o cabeçalho a 60 colunas), lote 06 (o total da sessão na
  linha "+N"), lotes 16, 18 e 19 (faixa e tempos); triagem A, lote 19 (cartão "substituída"), lote 24
  (filha arquivada vira linha) e lote 05 (tarefa abandonada ✕).
- Se o lote 20 de B entrar antes, o cenário "largo" continua valendo (trava a forma larga, com o
  repositório e a linha "+N").

## 11. Bloqueio

Nenhum. O `golden:aprovar` exige as palavras do usuário e a data: são as de "Como entregar" em
`orq-decisoes-medios.local.md` ("Validar só no fim (Recomendado)", 2026-11-14).
