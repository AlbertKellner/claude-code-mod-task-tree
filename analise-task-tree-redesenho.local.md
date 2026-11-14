# Redesenho periódico do painel: por que existe e alternativas

Pergunta do usuário: "você necessariamente precisa ficar reconstruindo o painel de tempos em tempos?
não da pra fazer um pooling em algum arquivo, ou qualquer outra forma de eventos? senão o proprio
claude code não teria animacoes"

## 1. Os redesenhos periódicos de hoje
- **Relógio de 1 s** (`ticker`, `hooks/sessions.ts` `tick`): só roda enquanto há tarefa
  cronometrando, aqui ou numa filha (`anyRunning`). Ele chama `$.ui.invalidate('ui.render')`, e o
  `render` refaz **todo** o desenho, ainda que só os textos `m:ss` tenham mudado. É ele que
  substitui o SVG e reinicia as animações.
- **Poller de 3 s** (`watchSessions` → `refreshChildren`): lê a lista do app (`list_sessions`) e os
  arquivos publicados das filhas (`~/.claude/task-tree-waits/<id>.json`). As filhas são outros
  processos e o app não avisa quando elas mudam. O poller **não redesenha à toa**: só grava o
  estado (e com isso redesenha) quando as filhas mudaram (`JSON.stringify` comparado). O culpado
  principal é o relógio.
- Os eventos da própria sessão (plan/start/done, prompt, fim de turno) já redesenham por evento,
  quando o `$.state` muda.

## 2. Como o slot trata um redesenho
- O `render` devolve uma árvore de elementos (Box, Svg…); cada linha é um `Svg` próprio. O kit não
  documenta se o slot reaproveita um `Svg` com o mesmo `source`. Pela prova das animações (bolinhas
  em laço no cabeçalho, que muda a cada segundo por causa do relógio), o laço pareceu contínuo. Mas
  as animações de entrada do 009ba1f "não ficaram boas", o que bate com cada `source` novo virar uma
  imagem nova (a animação recomeça ou é cortada).
- O kit só tem atualização parcial para `Raster` e `Image` (`$.ui.blit`, "no redraw"), **não para
  `Svg`**. Não há como mudar só o texto do relógio dentro de um SVG já desenhado.
- Conclusão prática: a linha cujo `source` não muda provavelmente fica intacta; a linha cujo
  `source` muda (a que tem relógio) é recriada.

## 3. Alternativas
1. **Isolar o relógio num `Svg` próprio.** Cada linha com relógio vira dois `Svg`: a linha (estável)
   e o tempo (pequeno, à direita, sobreposto como os overlays). O relógio continua a 1 s, mas só o
   SVG do tempo muda; a linha, o ícone e o cartão não são recriados e as animações deles
   sobrevivem.
   - Prós: resolve a causa sem perder segundos.
   - Contras: mais elementos no desenho, e o alinhamento do overlay precisa do cuidado das células
     (`geometry.ts`). Depende de o slot de fato reaproveitar `Svg` igual: confirmar com uma prova.
2. **Relógio animado no próprio SVG (SMIL).** No redesenho, escrever os próximos 60 s como `<set>`
   discretos (`begin="1s"`, `"2s"`… trocando o texto) e redesenhar só a cada minuto, ou na mudança
   de estado.
   - Prós: um redesenho por minuto.
   - Contras: SVG maior (60 textos por relógio), relógio que pode derivar se o SVG for recriado fora
     de hora, e mais complexidade. Não há JS no SVG para calcular a hora.
3. **Relógio em minutos** ("12 min", não "12:34"): redesenho a cada 60 s.
   - Prós: trivial.
   - Contras: perde a sensação de "vivo" e a precisão que o usuário vê hoje.
4. **Eventos para as filhas no lugar do poll.** O kit tem o hook clássico `FileChanged`, com os
   caminhos pedidos no `SessionStart` (`hookSpecificOutput.watchPaths`). O painel vigiaria
   `~/.claude/task-tree-waits/<id-da-filha>.json` e releria só quando o arquivo de uma filha muda.
   - Prós: cartões atualizam na hora e sem leitura a cada 3 s.
   - Contras: `watchPaths` é fixado no início da sessão (filhas abertas depois exigem vigiar a
     pasta inteira, se o kit aceitar pasta); filhas novas, encerradas e arquivadas só vêm do
     `list_sessions`, então um poll mais lento (ex. 15–30 s) continua necessário; e não muda o
     problema das animações, que é o relógio.
5. **Redesenhar só se o desenho mudou.** No `tick`, comparar o texto do relógio arredondado (m:ss)
   já faz isso; não há ganho além do 1 s.

## Recomendação
1 e 4 juntas: o relógio num `Svg` separado, e as filhas por `FileChanged` com um poll lento de
reserva. Antes, uma prova rápida (sem commit): uma linha com uma animação em laço e o relógio fora
dela, para ver se a animação continua lisa enquanto o tempo corre. Se o slot recriar mesmo os `Svg`
iguais, sobram a opção 2 (SMIL de 60 s) ou a 3 (minutos).

## Prova (em andamento, sem commit)
- Bloco `PROVA-RELOGIO` em `hooks/render.tsx` (`drawDesktop`, logo após `{chrome.errorLine}`) e a
  linha `;(globalThis as any).__pvNow = now` antes de `return drawDesktop(...)`. **Retirar os dois**
  (`git checkout -- task-tree/hooks/render.tsx`, o arquivo só tem a prova).
- Desenha duas linhas: A, com a bolinha animada (SMIL `cx`, 3 s, em laço) e o relógio `m:ss` num
  `Svg` sobreposto; B, com a mesma bolinha e o relógio dentro do mesmo `Svg`.
- 1ª tentativa, com `Date.now()`: não apareceu. 2ª, com `now` do `stamp`: também não apareceu para
  o usuário. O `claude plugin validate` passa e o arquivo publicado da principal não tem erro de
  desenho. Aguardando um print da janela para entender.

## Resultado da prova (concluída e retirada)
- Causa de não aparecer: os `Svg` da prova estavam com `alt=""`. O app não desenha um `Svg` de
  imagem com alt vazio, ainda que o desenho rodasse a cada segundo (confirmado por um arquivo de
  log por desenho). Com alt preenchido, a prova apareceu.
- **Resultado: "As duas pulam"** (as palavras do usuário). Tanto a linha A, com o relógio num `Svg`
  sobreposto e a linha sem nenhuma mudança, quanto a B reiniciam a animação a cada segundo. **O app
  recria todos os `Svg` do painel a cada redesenho**, mesmo os de `source` igual. A opção 1
  (isolar o relógio) não resolve; só redesenhar menos resolve.
- Prova retirada (`git checkout -- task-tree/hooks/render.tsx`, `prova-*.txt` apagados). A
  árvore de trabalho ficou limpa.
- Escolha do usuário: **"Relógio em SMIL"**.

## Plano de implementação: relógio em SMIL, redesenho por minuto
1. **Relógio autônomo no SVG** (`draw/svg.ts`): uma função `liveClock(ms, x, y, attrs)` que,
   para um tempo `ms` que corre, escreve 60 `<text>` com `m:ss` (de `ms` a `ms+59 s`, usando
   `clockText`), o primeiro visível e os demais com `visibility="hidden"` e `<set
   attributeName="visibility" to="visible" begin="{i}s" dur="1s"/>`. O primeiro tem
   `<set to="hidden" begin="1s" fill="freeze"/>`, e o último fica visível com `fill="freeze"`. Com
   `text-anchor="end"` e `tabular-nums`, todos têm a mesma posição. Para o tempo parado (tarefa
   concluída), continua o `<text>` único de hoje.
2. Usar `liveClock` onde o tempo corre:
   - linhas (`rowSvg`, `time` quando a linha está `current`/`running`/em andamento);
   - cartões (`labelSvg`, se mostrar tempo);
   - cabeçalho (`headerSvg`, o `score` com `clockText(time)`): separar o tempo do resto do texto
     em um `<text>` próprio, posicionado logo após `N de M · %` (largura por `textW`).
   Cada função precisa saber se o tempo corre: passar por `Row` (o `layout` já sabe o tom) e,
   no cabeçalho, pelo `busy` de `sessionTime`.
3. **Ticker** (`hooks/sessions.ts` `tick`/`keepTime`): de 1 s para 60 s, ou redesenhar só quando
   o relógio de algum SVG está para acabar (60 s depois do último desenho). Os eventos de
   estado (plan/start/done, poll das filhas que muda algo) seguem redesenhando na hora, e cada
   redesenho reinicia os 60 quadros a partir do `now` novo, então não há deriva acumulada.
4. Tamanho: cerca de 60 × 110 B ≈ 7 KB por relógio em curso. Com poucos relógios correndo (as
   linhas em andamento e o cabeçalho) fica bem abaixo de `DRAW_LIMIT`. Se passar, voltar aos
   relógios de 1 texto por minuto (`m min`).
5. Terminal: sem mudança (o texto continua redesenhando no ritmo atual, ou a cada 60 s também,
   mostrando `m:ss` congelado entre redesenhos; decidir na implementação, sem animação).
6. Animações: só depois disso, refazer as do 009ba1f (fade-in, ícone, chips/barra). Com
   redesenho por minuto ou por evento, a animação de entrada toca uma vez e não é cortada (exceto
   se coincidir com o redesenho do minuto).
7. Validação: recarga do mod e validação visual. O relógio deve andar segundo a segundo sem
   piscar; uma animação em laço posta para teste deve correr lisa entre os minutos; o `m:ss` deve
   bater com o real depois de alguns minutos. Sem testes nem docs (memória do projeto).
