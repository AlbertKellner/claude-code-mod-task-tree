# Análise: SVG ou componentes nativos, e reconstruir tudo ou observar arquivos

Sessão `analise-arquitetura`, 2026-11-10. Só leitura: nada foi editado, nenhum teste rodou.
Versões lidas: kit do Claude Code 2.1.321 (tipos gerados em `task-tree/.claude-plugin/types`),
app desktop 4.23118.1 (`%LOCALAPPDATA%\AnthropicClaude\app-4.23118.1\resources\ion-dist.asar`),
mod no estado da branch `feat/ultracode-no-cartao` (mesmo código do `main`, v0.14.0).

Cada afirmação abaixo diz se foi **confirmada** (com arquivo e linha, ou trecho do bundle) ou se é
**suspeita** (falta ver no app).

## 1. Resposta curta

**Pergunta 1: o SVG é necessário?** Não. O app desktop desenha `Box`, `Text` e `Button` como
elementos reais da página (`div` e `span` com flexbox), com as cores do tema do próprio app, corte
de texto com reticências feito pelo navegador e um cartão de hover nativo (popover) que o painel
aceita. O SVG só é insubstituível para o que não tem equivalente em texto: o anel de contexto com
arco, os ícones vetoriais e as guias contínuas. O caminho mais próximo do app é **híbrido**: estrutura,
textos, cartões e cliques em componentes nativos; SVG pequeno só nos ícones. Não recomendo migrar
de uma vez: recomendo um protótipo de poucas linhas para você ver no app antes de decidir.

**Pergunta 2: é preciso reconstruir tudo a cada mudança?** São três coisas diferentes:

- *O desenho.* Sim, o desenho inteiro é refeito e reenviado a cada mudança, e isso não é escolha do
  mod: o kit só aceita a árvore inteira, e o app troca o DOM inteiro a cada desenho. Reaproveitar
  linha por linha do lado do mod economizaria cerca de 1 ms; não vale. O que pesa é o relógio de
  1 s, que reenvia tudo a cada segundo enquanto algo roda.
- *Observar os arquivos.* O kit não tem `fs.watch`. Existe um caminho indireto (o hook clássico
  `FileChanged` com `watchPaths`), não testado em mod. Hoje a mãe relê os arquivos das filhas a
  cada 3 s e só escreve no estado quando algo mudou; o ganho de trocar isso por observação é
  latência (de até 3 s para quase imediato), não custo.
- *A recarga do mod a cada arquivo salvo.* Vem de como o mod é carregado nesta máquina: direto do
  clone, pela variável `CLAUDE_CODE_PLUGIN_DIRS`, que o Claude Code observa. Dá para evitar: existe
  a variável `CLAUDE_CODE_PLUGIN_DIR_WATCH`, ou carregar o mod de uma cópia que só muda quando você
  manda.

## 2. Pergunta 1: opções

### O que foi levantado

**Primitivas do kit no app desktop** (confirmado, `claude-code/index.d.ts:4082-4096`): `Box`,
`Text`, `Button`, `Link`, `Code`, `Markdown`, `Input`, `Select`, `Svg` e `Client`. O terminal tem
as mesmas menos `Svg`, mais `Raster` e `Image`.

**Como o app desenha cada uma** (confirmado no bundle, funções `Nf`, `$f`, `Yh`, `Ep`):

- `Box` vira `div` com `display:flex`. Larguras e deslocamentos horizontais em `ch`, verticais em
  `lh` (altura de linha). Aceita borda (`borderStyle: 'round'` vira cantos arredondados), cor de
  fundo, `overflow: hidden`, `position: absolute` com `top/left/right/bottom` inteiros.
- `Text` vira `span` com `white-space:pre; overflow:hidden; text-overflow:ellipsis`: o corte com
  "…" é do navegador, na largura real. Tem `size` (caption, footnote, body, heading, title),
  `weight`, `mono`, `tabular` (dígitos de largura fixa, feito para relógio) e `wrap` com
  `truncate-start/middle/end` (`index.d.ts:13871-13940`).
- Cores: `Color` é uma chave de tema (`success`, `warning`, `error`, `inactive`, `subtle`…, 23
  chaves, `index.d.ts:14053`) ou uma cor crua. A chave de tema acompanha o tema do app sem o mod
  fazer nada.
- `Button` vira botão nativo; aceita filhos (`<Button><Text>…</Text></Button>`), então o próprio
  ícone pode ser o alvo do clique.
- `Svg` sem `isInteractive` vira `<img src="data:image/svg+xml,…">`; com `isInteractive`, vira
  `<iframe sandbox srcdoc>` depois do DOMPurify. Limite de 131.072 caracteres por `Svg`
  (`index.d.ts:13578`, e `lp` no bundle). No modo imagem o app injeta `font-family` e `color` do
  painel na raiz do SVG (função `wp`), então `currentColor` segue o tema.

**Hover e tooltip nativos** (confirmado nos tipos e no bundle; **suspeita** quanto a funcionar na
prática):

- `Box` e `Text` têm a prop `hover` (`index.d.ts:882-945`): troca de cor, fundo e borda, ou revela
  um `Box` desenhado `display: "none"` com `hover: { display: 'flex' }`. Nenhum hook roda.
- No bundle, um `Box` absoluto, escondido e com esse `hover`, dentro de um `Box` com `key`, vira um
  popover nativo do app (`popover="manual"`, com fundo, raio e sombra do app, até 360 px,
  posicionado acima ou abaixo da âncora, mostrado no `pointerenter`). Isso só acontece onde o app
  liga `liftsHoverCards`, e o componente `Pane` liga (`component:"Pane",…,liftsHoverCards:!0`).
- Esse código existe desde a versão 4.23118.0 do app (5 de novembro); a 4.16336.0 não tem.
- **Conflito com o histórico:** o `DESENVOLVIMENTO.md:917` registra que "o `hover` de `Box` do kit
  não reagiu no painel" (tentativa de tooltip removida em 9 de novembro, commit `bb2392e`). Não sei
  com qual forma exata foi testado (o cartão exige `Box` pai com `key`, filho absoluto com
  `display:"none"` e `hover:{display:'flex'}` sem `scope`), nem em qual versão do app. Uma issue
  pública diz que o mesmo padrão não revela em linha de transcrição (nota `pesquisa-web-hover`).
  Só um teste no app decide.

**Como o app atualiza a tela** (confirmado no bundle, funções `Wp`, `Up`, `Rp`): a cada desenho o
app monta um DOM novo a partir da árvore inteira e troca o antigo por ele (`replaceWith`). A única
coisa reaproveitada são os `iframe` idênticos (`isEqualNode`) e os elementos que os contêm. Como o
painel hoje não tem `Svg` interativo, **todo o DOM do painel é recriado a cada desenho**, e cada
linha é uma imagem `data:` decodificada de novo. Com texto nativo a troca é a mesma, mas trocar
`span` de texto é mais barato do que redecodificar uma imagem por linha.

**`Client`** (confirmado nos tipos, `index.d.ts:1440-1650`, e presente no bundle do desktop): um
módulo do mod que roda na camada de desenho, com estado local, relógio próprio (`surface.every`),
ponteiro e teclado; a instância sobrevive aos redesenhos e recebe `props` novos. Limites: sem `$`,
sem `Svg` (a tabela dele é a do terminal menos `Client`, `Raster` e `Image`), árvore de até 20.000
nós e 100.000 caracteres. **Suspeita:** nunca foi usado neste mod; não sei como se comporta no
painel do desktop.

### Estado atual (ponto de comparação)

- Desktop: um `Svg` por linha mais o cabeçalho, com `Button` de rótulo vazio sobreposto ao ícone e
  ao anel por `Box` absoluto (`hooks/render.tsx:66-113`). `draw/svg.ts` (736 linhas) e
  `draw/geometry.ts` (156) existem só para isso.
- Terminal: `Box` e `Text`, com glifos e guias em caracteres (`hooks/render.tsx:117-176`).
- Tamanho: nos desenhos travados no golden, a linha mediana tem cerca de 1,5 KB (43 SVGs, de 0,9 a
  3,7 KB). 400 linhas dão os 600 KB do limite. O app não mostrou um desenho de 950 KB
  (`DESENVOLVIMENTO.md:1574`).
- Custos que o SVG impõe e que estão no histórico: medir texto à mão para cortar (`textW`, `fit`),
  classes claro/escuro dentro de cada imagem, alinhamento do botão em células contra pixels,
  tooltip que não funcionou, linha que piscava quando interativa.

### Opção A: manter o SVG

- Prós: nenhum risco; todas as decisões visuais suas já estão nele; golden travado; controle de pixel.
- Contras: os custos acima continuam; tooltip segue sem solução; dois desenhos para manter
  (desktop e terminal); cada mudança visual passa por geometria manual.
- Risco: baixo. O limite de tamanho continua apertado em sessões longas.

### Opção B: híbrido (recomendada, por etapas)

Estrutura em `Box`/`Text`/`Button`; `Svg` pequeno, modo imagem, só para ícone de progresso, anel de
contexto e barra do cabeçalho.

- Ganha:
  - corte de texto pela largura real, sem `textW`/`fit`;
  - cores do tema do app, sem `prefers-color-scheme` embutido;
  - clique no próprio elemento, sem a sobreposição em células (`overlays` deixa de existir);
  - tooltip nativo do app para nome cortado, se o teste confirmar;
  - o relógio muda só um `Text`, não a imagem da linha inteira;
  - cartões aninhados com `Box` de borda arredondada;
  - desenho do desktop e do terminal passam a sair de uma árvore quase igual;
  - testes de comportamento alcançam o desenho do desktop (o harness acha elementos por `key` e
    texto; hoje ele não vê dentro do SVG);
  - ícones repetidos ficam com a mesma fonte, estáveis entre desenhos.
- Perde:
  - controle de pixel: posição só em `ch` e `lh` inteiros; altura de linha é a do app;
  - guias contínuas desenhadas como vetor: viram caracteres (`│ ├─`, com `mono`) ou um `Svg`
    estreito por linha; `Box` não tem borda de um lado só;
  - a fonte e os tamanhos passam a ser os do app (cinco degraus), não os escolhidos no SVG;
  - a faixa colorida e o desenho próprio do cabeçalho precisam ser refeitos com fundo de `Box`;
  - o golden do SVG perde o sentido para as linhas (sobra para os ícones).
- Riscos: fidelidade visual só se vê no app; o `hover` pode repetir o resultado da tentativa
  anterior; o `Button` nativo tem realce e padding próprios que o mod não controla (já conhecido,
  `DESENVOLVIMENTO.md:941-947`); tamanho total da árvore não medido (estimativa, não medição:
  algumas centenas de bytes por linha nativa mais o ícone).
- Custo de migração: alto se for tudo. Dezenas de decisões visuais suas estão registradas contra o
  SVG; cada uma teria de ser revista no app.

### Opção C: tudo nativo, sem SVG

Ícones como glifos (`○ ◉ ✓ ✕ ◷ ⑂`), anel como "42%", como o terminal já faz.

- Prós: um desenho só para as duas superfícies; some `draw/svg.ts`, `draw/geometry.ts` e o golden;
  árvore menor.
- Contras: perde o anel com arco, os ícones desenhados e a barra; o painel do app fica com cara de
  terminal.
- Risco: você já pediu ícones e anel específicos várias vezes; provável rejeição visual.

### Opção D: `Client`

O painel inteiro (ou só os relógios) num módulo com estado local e relógio próprio.

- Prós: o tique de 1 s fica na camada de desenho, sem ida e volta ao mod nem reenvio da árvore;
  hover e ponteiro tratados no próprio módulo.
- Contras: não desenha `Svg` (implica a opção C dentro dele); limite de 100.000 caracteres; sem
  `$`; segunda base de código com regras próprias; nada testado aqui.
- Risco: alto. Só faz sentido depois de B ou C existir.

## 3. Pergunta 2: opções

### O que foi levantado

**O desenho hoje** (confirmado, `hooks/render.tsx:197-336`): cada `ui.render` lê cerca de 14 chaves
de `$.state`, roda `layout()` (puro), gera o SVG de todas as linhas e devolve a árvore inteira.
Ler `$.state` dentro do desenho já inscreve o painel: um `$.state.set` redesenha sozinho
(`index.d.ts:3582-3587`). O teto é de dez redesenhos por segundo (`index.d.ts:2402-2406`).
Medições já registradas (`DESENVOLVIMENTO.md:585-588`): desenho inteiro 17 ms no kit; SVG de 400
linhas 1,5 ms no caso real.

**Não há atualização parcial** (confirmado): o kit só tem `$.ui.invalidate('ui.render')`, que
redesenha tudo, e `$.ui.blit`, que serve só para `Raster` e `Image`, que o desktop não tem. Do lado
do app, o DOM é trocado inteiro (ver pergunta 1).

**O relógio de 1 s** (confirmado, `hooks/sessions.ts:263-292`): enquanto algo roda, o mod chama
`invalidate` a cada segundo para andar os tempos. É a maior fonte de redesenho: árvore inteira
serializada e enviada, DOM inteiro refeito, todas as imagens redecodificadas, uma vez por segundo.

**A leitura das filhas** (confirmado, `hooks/sessions.ts:33-84`, `io/host.ts`, `io/publish.ts`):

- cada sessão grava `~/.claude/task-tree-waits/<id>.json` só quando o conteúdo mudou
  (`publishWait` compara com a última publicação);
- a mãe, a cada 3 s (`POLL`), pede a lista de sessões ao app (`list_sessions`), lê o arquivo de
  cada filha e deriva os cartões; só escreve no estado se o resultado mudou (comparação por JSON),
  então uma leitura sem novidade não redesenha;
- a lista de sessões (rodando, parada, arquivada) vem do app, não de arquivo: esse pedaço continua
  sendo consulta periódica de qualquer jeito.

**Observação de arquivos no kit** (confirmado): `$.fs` tem `read`, `write`, `list`, `exists`,
`stat` e `ancestors` (`index.d.ts:3427-3546`). Não tem `watch`. Caminhos indiretos:

- hook clássico `FileChanged` (`file_path`, `event: change | add | unlink`, `index.d.ts:5122`): os
  caminhos vêm de `watchPaths`, que `SessionStart`, `CwdChanged` e o próprio `FileChanged` podem
  devolver (confirmado no esquema dentro do `claude.exe`). O mod já registra
  `classic.SessionStart`. **Suspeita:** nunca foi usado aqui; não sei se aceita pasta, qual a
  latência, nem se dispara no app desktop para um mod.
- `$.process.spawn` de um observador externo que escreve uma linha por mudança
  (`index.d.ts:3740-3776` mostra esse uso). Funciona em tese, mas cria um processo por sessão e
  morre a cada recarga do mod.
- `$.fs.stat` (traz `mtimeMs`) no lugar de `read` no laço de 3 s: lê e interpreta só o arquivo que
  mudou.

**Testes:** o harness não tem fs, rede nem processo. Qualquer caminho por arquivo precisa do `$`
falso que `tests/host.test.ts` já usa, e a observação real vai para o checklist do app.

**A recarga do mod** (confirmado):

- `~/.claude/settings.json` define `CLAUDE_CODE_PLUGIN_DIRS` apontando para
  `…\claude-code-mod-task-tree\task-tree`, e a instalação pelo marketplace está desligada
  (`"task-tree@claude-code-mod-task-tree": false`; a cópia instalada é a 0.7.4).
- O Claude Code observa as pastas de `CLAUDE_CODE_PLUGIN_DIRS` e recarrega o módulo de hooks em
  toda sessão aberta quando um arquivo é salvo. Um estado que não compila mostra "reload failed" e
  a versão anterior segue carregada.
- Na recarga, `$.state` fica, as variáveis de módulo e os relógios morrem, e `session.start` não
  roda (`DESENVOLVIMENTO.md:202-208`). Por isso o desenho religa relógio e leitura das filhas.
- O `claude.exe` 2.1.321 tem a variável `CLAUDE_CODE_PLUGIN_DIR_WATCH`: com valor falso, a lista de
  pastas observadas fica vazia (trecho: `CLAUDE_CODE_PLUGIN_DIR_WATCH===!1?[]:…`). Ela é aceita nas
  configurações do usuário junto de `CLAUDE_CODE_PLUGIN_DIRS`. **Suspeita:** não testei qual texto
  o valor precisa ter, nem como recarregar à mão depois (o binário cita `/reload-plugins`).

### Opções para o desenho

- **Manter como está.** Prós: funciona, medido. Contras: reenvio total a cada segundo com relógio.
- **Memoizar linha por linha no mod.** Economiza cerca de 1 ms de 17; o envio e o DOM continuam
  totais. Não recomendo.
- **Diminuir o que cada desenho custa** (consequência da opção B da pergunta 1): árvore menor, sem
  imagem por linha.
- **Redesenhar menos:** tique de 1 s só quando há tempo visível mudando, ou relógio dentro de um
  `Client`. O primeiro é barato; o segundo depende da opção D.

### Opções para a leitura das filhas

- **Manter a releitura de 3 s.** Prós: simples, estável, já não redesenha sem novidade, sobrevive a
  versões diferentes do mod entre sessões. Contras: até 3 s de atraso; lê todos os arquivos sempre.
- **`stat` antes de `read`.** Prós: mudança pequena, testável com o `$` falso, menos leitura.
  Contras: a latência continua 3 s.
- **`FileChanged` com `watchPaths`, mantendo a releitura como rede de segurança (mais lenta).**
  Prós: cartão da filha atualiza quase na hora. Contras: caminho não testado; a lista de filhas
  muda durante a sessão, então os caminhos teriam de ser atualizados a cada filha nova; consistência
  depende de o evento chegar (por isso a releitura fica).
- **Processo observador.** Não recomendo: processo extra por sessão, frágil na recarga.

### Opções para a recarga do mod

- **Manter.** Toda sessão recarrega a cada arquivo salvo por qualquer sessão filha que edite o clone.
- **Desligar a observação** (`CLAUDE_CODE_PLUGIN_DIR_WATCH`). Prós: uma linha de configuração; some
  o "reload failed" de estado intermediário. Contras: você recarrega à mão para validar no app.
- **Carregar de uma cópia de entrega.** `CLAUDE_CODE_PLUGIN_DIRS` aponta para outra pasta, e um
  comando copia o `task-tree/` para lá só depois do `npm run check` passar. Prós: as sessões só
  recarregam com código validado, e a recarga a quente continua servindo para validar. Contras: um
  passo a mais no fluxo; precisa de um script.
- **Usar a versão instalada pelo marketplace no dia a dia** e o clone só para desenvolver. Contras:
  você valida no app antes do push, então o clone teria de continuar carregado em algum lugar.

Mudar `settings.json` é decisão e ação sua: uma sessão filha é recusada ao tentar.

## 4. Recomendação

1. **Recarga do mod: carregar de uma cópia de entrega** (ou, como passo imediato de uma linha,
   desligar a observação). É o problema com efeito mais direto no seu dia: hoje qualquer sessão que
   salve um arquivo recarrega o painel de todas.
2. **SVG: não migrar agora; fazer um protótipo híbrido** de um cartão de filha com cinco linhas,
   atrás de um comando (`/task-tree nativo`), sem tocar o desenho atual. Ele responde no app as
   três dúvidas que a leitura não resolve: se o cartão de hover nativo aparece, como ficam guias e
   alinhamento em `ch`/`lh`, e se o painel deixa de piscar com o relógio. Só com o seu "funcionou"
   a migração entra em pauta.
3. **Leitura das filhas: manter os 3 s** e, se a latência incomodar, testar `FileChanged` como
   acréscimo. `stat` antes de `read` é uma melhoria pequena e segura que pode entrar a qualquer hora.
4. **Não investir em reaproveitar linhas no mod.** O ganho possível está em desenhar menos vezes e
   com árvore menor, não em cache.

## 5. Esboço do caminho de migração (se o protótipo agradar)

1. Protótipo: `drawDesktopNative` ao lado de `drawDesktop`, escolhido por uma chave de estado;
   parte do `drawTerminal`, que já é a árvore nativa. Sem golden, sem mexer nos testes existentes.
2. Validação sua no app (checklist: largura real e corte, dois temas, clique no ícone e no anel,
   hover, relógio sem piscar, cartões aninhados).
3. Linhas de tarefa em nativo, com ícone em `Svg` pequeno; cabeçalho ainda em SVG.
4. Cartões de sessão e de subagente; depois o cabeçalho.
5. Tooltip do nome cortado pelo cartão de hover nativo (regra nova no catálogo: a remoção de 9 de
   novembro foi decisão sua).
6. Retirada do desenho antigo: `rowSvg`, `overlays`, `textW`/`fit`; golden reduzido aos ícones.

Cada passo é um commit local com validação visual, como o fluxo do repositório pede. Os testes de
comportamento (títulos e estados, lidos pela superfície terminal) não mudam.

## 6. Perguntas para você

1. **Recarga do mod.** Opções: (a) cópia de entrega atualizada por comando depois do check
   (recomendada); (b) só desligar a observação com `CLAUDE_CODE_PLUGIN_DIR_WATCH`; (c) deixar como
   está.
2. **SVG.** Opções: (a) protótipo híbrido de um cartão, atrás de um comando, para você ver no app
   (recomendada); (b) manter o SVG e encerrar o assunto; (c) migrar tudo para nativo direto.
3. **Tooltip.** Se o protótipo mostrar que o cartão de hover nativo funciona no painel, o tooltip
   do nome cortado volta? (recomendado: sim, só no desenho nativo.)
4. **Latência das filhas.** Os até 3 s de atraso no cartão incomodam? Se sim, testamos
   `FileChanged`; se não, fica como está (recomendado: fica como está).
5. **Ícones.** No híbrido, as guias da árvore podem virar caracteres (`│ ├─`) ou precisam continuar
   como traço contínuo? (recomendado: decidir vendo o protótipo com as duas formas.)

## 7. O que ficou sem verificar

- Nada foi visto no app: fidelidade do desenho nativo, cartão de hover no painel, piscar com o
  relógio, comportamento do `Client` no desktop.
- O formato exato da tentativa anterior de `hover` em `Box` e a versão do app em que foi feita.
- O tamanho real de uma linha nativa serializada e o limite de tamanho que o app aplica à árvore do
  painel (os 600 KB são empíricos; não achei o número no bundle).
- `FileChanged`/`watchPaths` num mod: se dispara no app desktop, se aceita pasta, latência.
- O valor que `CLAUDE_CODE_PLUGIN_DIR_WATCH` precisa ter e a recarga manual depois.
- O pedido citava workflow com leitores e juízes em paralelo; fiz a leitura direta, sem workflow,
  porque as palavras suas no pedido não pedem workflow. Não houve verificação adversarial por
  agentes separados.
- Não li o trabalho da sessão `auditoria-mod` (a pasta de notas compartilhadas estava vazia), então
  não há cruzamento com ela.
