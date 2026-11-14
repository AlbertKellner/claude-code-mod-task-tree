# Cabeçalho do painel: diagnóstico e propostas de layout

Só leitura e protótipos fora do repositório. Mockups em `<notas>\cabecalho-propostas\` (um `.svg` por proposta, tema e largura; `index.html` com tudo lado a lado; `gerar.mjs` os gera). Os dados são os do print 6. Código lido por `git show origin/main` (`draw/svg.ts` `headerSvg`/`chips`/`icon`, `draw/geometry.ts`, `hooks/render.tsx`).

## Essencial

- **Hoje o cabeçalho é uma lista de fatos no mesmo peso:** título, "15 de 19 · 79% · 21:50 · 79 toks/s", repositório e branch, barra, chips. Tudo na mesma cor apagada, no mesmo tamanho, na mesma linha ou na de baixo. O olho não sabe o que é **progresso** (números), o que é **contexto** (repo/branch) e o que é **estado agora** (em andamento, aguardando, sessão ativa); e os botões ≡/▤ ficam soltos no canto.
- **Cinco propostas**, todas desenháveis pelo mod (sem fonte externa, largura estimada pelo código, botões por chave no canto direito, palavras no tooltip pela camada de hover), nos dois temas e em 60 colunas:
  1. **Anel + pílulas**: progresso num anel com o %; título ao lado; contexto numa linha discreta; chips em pílulas na cor do estado.
  2. **A barra é o estado**: barra segmentada (concluídas, em andamento, pendentes) com legenda; métricas à direita.
  3. **Métricas em pílulas**: progresso, tempo e ritmo em três pílulas; estado só com ícone e número, palavras no tooltip.
  4. **Compacto (56 px)**: uma linha com mini-anel, título, estado e números; contexto em letra fina; devolve 44 px à árvore.
  5. **Faixa de estado + bloco de números**: faixa colorida à esquerda (âmbar: em andamento), número grande "79%" à direita com os pares embaixo, pílulas de estado.
- **Recomendação: P1 (anel + pílulas)**, com o modo compacto da P4 como opção para pane estreito, se ele quiser. É a que mais separa os três tipos de informação sem perder nada do que existe hoje, e cabe na geometria atual (100 px).
- **Custo comum a todas:** só `draw/svg.ts` (`headerSvg`, `chips`) e, nas que mudam a altura, `HEADER_H` em `draw/geometry.ts`; `hooks/render.tsx` quase não muda (os botões continuam no canto). A linha do terminal fica como está (o kit lê o cabeçalho por ela). **O golden muda nos 3 cenários**, porque todo cenário desenha o cabeçalho: validação dele no app **antes** do commit e `golden:aprovar --todos`.

## 1. Diagnóstico do cabeçalho de hoje

- **Hierarquia:** só o título é negrito. Os números (progresso), o contexto (repo, branch) e o ritmo (toks/s) estão na mesma linha, na mesma cor e tamanho: "15 de 19 · 79% · 21:50 · 79 toks/s ◆ claude-code-mod-task-tree ⑂ feat/…". Quatro coisas diferentes lidas como uma frase.
- **Densidade:** a segunda linha chega a 7 itens em pane largo; em 60 colunas o repositório some e sobra a branch cortada.
- **Alinhamento:** as métricas são alinhadas à esquerda, atrás do título, e o que muda a cada segundo (o tempo, o toks/s) fica no meio da linha, fazendo o texto "pular" ao lado do repositório.
- **O que muda o tempo todo:** tempo, toks/s, % e os chips. Eles deveriam ficar num lugar fixo (à direita, tabular) para não deslocar o resto.
- **Métrica × contexto × ação:** progresso (números, barra, chips) e contexto (repo/branch) têm o mesmo tratamento; a ação (≡/▤) fica isolada no canto, sem relação visual com o resto do cartão.
- **Estado:** os chips repetem o ícone da árvore com a palavra; é claro, mas longo, e em pane estreito viram só números sem cor de fundo que os diferencie.

## 2. As propostas

Em todas: o cartão atual (fundo, borda, raio), a mesma paleta (âmbar em andamento, verde concluído, cinza pendente/interrompida; azul para "sessão ativa", para separar das tarefas), os botões ≡/▤ no canto superior direito (as chaves de clique não mudam), tooltip com o que não couber. "Largo" = 1200 px; "60 colunas" = 432 px.

**P1 · Anel de progresso e pílulas** (`p1-anel-*.svg`, 100 px)
- *Princípio:* o progresso é uma figura (anel com o %), não uma frase; o estado tem cor; o contexto é discreto.
- *Mostra:* anel à esquerda com "79%"; título ao lado; métricas "15 de 19 · 21:50 · 79 toks/s" alinhadas à **direita**, tabulares (o que muda não desloca nada); linha 2: ◆ repo ⑂ branch em cinza; linha 3: pílulas "● 1 em andamento", "○ 3 pendentes", "✕ 1 interrompida", "👤 1 sessão ativa", cada uma com fundo na cor do estado a 13%.
- *60 colunas:* anel menor; as métricas descem para a linha 2 (sob o título); a branch sozinha na linha 3; pílulas só com o número, mas ainda coloridas.
- *Temas:* o fundo das pílulas é a cor do estado com transparência: funciona nos dois temas sem cor nova.
- *Ganha:* leitura em três camadas (progresso, contexto, estado); o % visível de longe; os números param de pular. *Perde:* a barra (o anel a substitui; pode voltar fina sob o título, se ele sentir falta).

**P2 · A barra é o estado** (`p2-barra-*.svg`, 92 px)
- *Princípio:* uma barra segmentada conta a história inteira: verde (concluídas), âmbar (em andamento), trilho (pendentes); a legenda embaixo dá os números.
- *Mostra:* título; "15/19 · 21:50" à direita; linha 2: repo, branch e "· 79 toks/s"; barra de 6 px com segmentos; legenda com pontos coloridos: "15 concluídas · 1 em andamento · 3 pendentes · 1 interrompida · 1 sessão ativa".
- *60 colunas:* legenda só com números; branch sozinha.
- *Ganha:* o estado vira proporção, visível de longe; menos ícones. *Perde:* "interrompida" e "sessão ativa" não cabem na barra (a interrompida fica fora do total por regra), só na legenda; sem %.

**P3 · Métricas em pílulas, estado só em números** (`p3-pilulas-*.svg`, 100 px)
- *Princípio:* cada métrica é um objeto (pílula) e o estado é a menor faixa possível.
- *Mostra:* título; três pílulas: [mini-barra 79% · 15/19] [◷ 21:50] [↗ 79 toks/s]; linha 3: repo e branch; linha 4: "● 1 ○ 3 ✕ 1 👤 1" em cor, com as palavras no tooltip (e, em pane largo, uma legenda apagada ao lado).
- *60 colunas:* pílulas mais curtas; branch sozinha; a faixa de estado cabe sempre.
- *Ganha:* o mais compacto horizontalmente mantendo 100 px; bom para muitos chips. *Perde:* as palavras do estado ficam no tooltip (ele precisa decorar os ícones).

**P4 · Compacto, uma linha** (`p4-compacto-*.svg`, 56 px)
- *Princípio:* o cabeçalho é um rodapé de status: uma linha, e a árvore ganha 44 px.
- *Mostra:* mini-anel sem texto; título; estado "● 1 ○ 3 ✕ 1 👤 1"; "15/19 · 21:50" à direita; segunda linha em 10,5 px com repo, branch e toks/s; barra de 3 px no rodapé do cartão.
- *60 colunas:* título cortado cedo ("Explicar as opçõe…"); estado e números ficam; só a branch.
- *Ganha:* espaço para a árvore, que é o que ele lê. *Perde:* o título cabe pouco; é denso; pede o tooltip para quase tudo.

**P5 · Faixa de estado e bloco de números** (`p5-faixa-*.svg`, 100 px)
- *Princípio:* um cartão de painel: a faixa à esquerda diz o estado geral (âmbar: há trabalho em andamento; verde: tudo concluído; cinza: parado), e os números ficam num bloco à direita, como um mostrador.
- *Mostra:* faixa de 7 px na borda esquerda; título em 15 px; linha 2: repo e branch; barra; pílulas de estado; à direita "79%" em 22 px negrito, "15 de 19" e "21:50 · 79 toks/s" embaixo.
- *60 colunas:* o bloco estreita (sem toks/s); título cortado; pílulas só com número.
- *Ganha:* o estado geral em um relance (a cor da faixa) e o % como o número mais forte do painel. *Perde:* o título perde largura para o bloco; mais "cheio" que a P1.

## 3. O que cada proposta exige no código

| | `headerSvg`/`chips` (`draw/svg.ts`) | `HEADER_H`/geometria | `render.tsx` | Terminal | Animação (`motion.ts`) | Golden |
|---|---|---|---|---|---|---|
| P1 | anel (arco com `stroke-dasharray`), pílulas (rect + ícone + texto, classe `ch-<tom>` mantida), métricas à direita com `text-anchor="end"` | não (100 px) | não | não | o arco precisa de uma regra nova (hoje `growFrom` anima a largura de `rect`); sem ela, o anel troca sem animar | 3 cenários |
| P2 | barra em 3 `rect`, legenda | 92 px | ajuste do `alt` | não | a barra segmentada anima com `growFrom` por segmento | 3 cenários |
| P3 | 3 pílulas, faixa de estado, legenda apagada | não | não | não | como hoje | 3 cenários |
| P4 | tudo numa linha; mini-anel | **56 px**: o slot do cabeçalho e a posição dos botões mudam | sim (altura do slot, `overlays` dos botões) | não | mini-anel (idem P1) | 3 cenários |
| P5 | faixa (caminho na borda do cartão), bloco à direita, pílulas | não | não | não | como hoje | 3 cenários |

Viabilidade dentro das restrições do app:
- **Sem fonte externa:** tudo usa a fonte do sistema, como hoje; os tamanhos ficam entre 10,5 e 22 px.
- **Largura estimada pelo código:** pílulas e métricas à direita usam `textW`, como os chips de hoje; o corte do título é `fit`, como hoje.
- **Cliques por chave:** os botões ≡/▤ seguem no canto direito, dentro de `ICONS_W`; nenhuma proposta põe outro botão (o anel e as pílulas não são clicáveis).
- **Tooltip:** a camada de hover já lê `data-tip`/`alt`; as palavras dos estados (P3, P4) e o nome completo do repositório vão para lá, como o título cortado vai hoje.
- **Tema:** as cores novas são as atuais com transparência (fundo das pílulas) ou as atuais puras (faixa, arco). Nada fora da paleta `LIGHT`/`DARK`.

**Regras do catálogo afetadas** (todas de desenho; a contagem não muda): `visual.cabecalho-em-cartao`, `visual.cabecalho-barra-e-chips-desenhados`, `visual.desenho-principal`, `visual.desenho-cartao-filha`, `visual.desenho-envios` (os 3 goldens); o texto de `cabecalho.chips-contam-folhas` só se os chips virarem pílulas ("chips" → "pílulas"). `cabecalho.numeros-somam-o-desenhado` e `cabecalho.titulo-*` não mudam (o kit lê o cabeçalho pela linha do terminal, que fica igual).

**Golden:** `headerSvg` entra em todo cenário, então os 3 mudam de desenho. Fluxo: a Implementação faz o cabeçalho escolhido; o check acusa "o desenho de principal/filha/envios mudou"; ele valida no app; `golden:aprovar --todos --motivo "\"<palavras>\", <data>"`; commit.

**Matriz de impacto:** `npm run impacto -- draw/svg.ts` (área visual + cabeçalho); com `draw/geometry.ts` e `hooks/render.tsx` (P2, P4), núcleo: tudo.

## 4. Recomendação

**P1 (anel + pílulas).** Motivos: separa progresso, contexto e estado em três camadas visuais sem tirar nada do que ele tem hoje; os números que mudam ficam presos à direita; as pílulas coloridas se leem de longe nos dois temas; cabe nos 100 px atuais, então só `draw/svg.ts` muda e o resto (botões, slot, terminal, kit) fica igual. Dois ajustes opcionais depois de ele ver: uma barra fina sob o título, se sentir falta dela; e o modo compacto da P4 para panes com menos de ~70 colunas.

Se ele preferir mais espaço para a árvore, **P4**; se preferir o estado como proporção, **P2**.

## Próximo passo (quando ele escolher)

Ele pediu para pôr os exemplos no task-tree como modelo. Duas formas: (a) abrir o `index.html` desta pasta no navegador (já pronto); (b) um cenário temporário de golden com o cabeçalho de cada proposta, desenhado no próprio painel do app, uma proposta por vez (exige implementar cada uma). Recomendo (a) para escolher e implementar só a escolhida.
