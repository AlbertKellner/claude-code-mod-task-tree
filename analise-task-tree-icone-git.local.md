# Ícone do repositório: do gato (GitHub) ao logotipo do Git

Pedido: "mude esse ícone para ficar com o ícone do git" (print 23, o gato ao lado do nome do repo).

## Desenho atual (`draw/svg.ts:217–223`, `repoIcon(x, y, cls)`)
- Caixa de 14 px centrada em (x, y), `<g class=cls>` com `fill none`, traço 1,3, pontas e juntas
  `round`, deslocado por `transform="translate(x y)"`; classe `gy` (cinza do tema), o texto do repo
  ao lado em `s` 11 px, opacidade .75 (`gitSvg`, linha 232, ícone em `x + 7`).
- Um `path` com a cabeça do gato e dois tracinhos de olhos.

## Path proposto (logo do Git simplificado, só traço, mesma caixa e classes)
```ts
export function repoIcon(x: number, y: number, cls: string): string {
  return (
    `<g class="${cls}" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x} ${y})">` +
    // o losango
    '<path d="M0 -6.5L6.5 0L0 6.5L-6.5 0Z"/>' +
    // o grafo: nó central, um ramo para cima à esquerda, outro para cima à direita, o tronco para baixo
    '<path d="M-2.6 -2.6L0 0V3.6M0 0L2.6 -2.6"/>' +
    '<circle cx="-2.6" cy="-2.6" r="1.1"/><circle cx="2.6" cy="-2.6" r="1.1"/><circle cx="0" cy="0" r="1.1"/></g>'
  )
}
```
- Losango de 13 px (vértices a ±6,5), como o logotipo; dentro, o grafo de commits em "Y" invertido
  com três nós (r 1,1) e o tronco até perto do vértice de baixo. Sem o laranja: herda a cor da
  classe (`gy`), igual ao ⑂ ao lado.
- Prova visual em `icone-git.svg` (gato → git → ⑂, em 3× e em 1× com os textos, nos dois fundos).
- Diferença do ⑂ da branch: o ⑂ tem três bolinhas maiores (r 1,8) e a curva, sem contorno; o Git
  tem o **losango** em volta e nós menores. Lado a lado em 1× continuam distintos.
- Em 1× os nós de r 1,1 com traço 1,3 ficam quase cheios: se na validação parecerem borrados,
  trocar os três `circle` por preenchidos (`class="gyf"`, sem traço, r 1,4) e manter só o grafo e
  o losango em traço.

## Plano
1. `draw/svg.ts`: substituir o corpo de `repoIcon` pelo path acima; atualizar o comentário da
   linha 214 ("a cat's head, the GitHub mark" → o logotipo do Git, losango com o grafo).
2. Nada muda em `gitSvg`, no cartão (`labelSvg`) nem no topo (`headerSvg`): mesma caixa de 14 px e
   mesma classe. Terminal: sem ícone (texto), sem mudança.
3. Sem testes nem docs (memória do projeto). Validar a recarga do mod; validação visual nos dois
   temas, no cartão e no topo, ao lado do ⑂ da branch (legível, distinto, sem borrão em 1×).

## Reaberto: a forma do logotipo oficial, nas cores do painel
Pedidos do usuário: "o ícone deve ser igual a esse" (print 24, o logo oficial do Git) e, em
seguida, "ele não deve ser laranja, ele deve seguir a identidade visual do painel". Nenhum #F05133.

### Proporções (medidas na referência, 957 px; normalizadas para a caixa de 14 px)
- Losango: quadrado de lado 9,9 rotacionado 45° (diagonal 14), cantos arredondados `rx 0,9`.
- Nós: raio 72/957 × 14 ≈ **1,05**; traços do grafo: 65/957 × 14 ≈ **1,0**.
- Posições (centro em 0,0): nó central-superior **(0, −2,8)**; nó da base **(0, 3)**; nó da
  direita **(2,9, 0,1)**; o traço diagonal entra pela borda superior esquerda a partir de
  **(−2,2, −5,3)** até o nó central; dele, a vertical até o nó da base e a diagonal até o da direita.

### Cores (identidade do painel)
- Losango **preenchido** na cor apagada dos ícones: classe **`gyf`** (#9c9a92 escuro / #888780
  claro), a mesma família do ⑂ da branch (`gy`) e do texto do modelo.
- Grafo e nós **na cor do fundo do cartão** (recorte visual): classe **`cd`** para o preenchimento
  dos nós (`fill` #20201f / #f9f9f7) e uma classe nova **`cds`** com `stroke` na mesma cor para o
  traço do grafo (`LIGHT: ['cds','stroke:#f9f9f7']`, `DARK: ['cds','stroke:#20201f']`). Sobre o
  cartão, isso equivale ao recorte; no topo (cabeçalho, que agora também é cartão da mesma cor) o
  efeito é o mesmo. Recorte verdadeiro (`mask`/`clip-path`) é desnecessário.
- Contraste: o losango cinza sobre o cartão é o do ⑂ atual (4,5 escuro / 2,0 claro, aceitável
  para ícone); o grafo "recortado" tem o mesmo contraste, invertido.

### Path final (`repoIcon`, mesma caixa e assinatura; `cls` ignorado, as classes são fixas)
```ts
export function repoIcon(x: number, y: number, _cls: string): string {
  return (
    `<g transform="translate(${x} ${y})">` +
    // o losango do logotipo, preenchido na cor apagada dos ícones
    '<rect class="gyf" x="-4.95" y="-4.95" width="9.9" height="9.9" rx="0.9" transform="rotate(45)"/>' +
    // o grafo, recortado na cor do cartão: a diagonal que entra pela borda, o nó central, a vertical e o ramo
    '<path class="cds" d="M-2.2 -5.3L0 -2.8V3M0 -2.8L2.9 0.1" fill="none" stroke-width="1"/>' +
    '<g class="cd"><circle cx="0" cy="-2.8" r="1.05"/><circle cx="0" cy="3" r="1.05"/><circle cx="2.9" cy="0.1" r="1.05"/></g></g>'
  )
}
```
Prova em `icone-git-oficial.svg` (6×, 3×, 1× e ao lado do ⑂, nos dois fundos).

### Plano
1. `draw/svg.ts`: substituir `repoIcon` pelo acima; acrescentar `cds` em `LIGHT` e `DARK`
   (`slim` só inclui a regra nos SVGs que usam a classe).
2. Sem mudança em `gitSvg`, `labelSvg`, `headerSvg` (mesma caixa de 14 px). Terminal: sem ícone.
3. Legibilidade em 1×: o traço de 1 px e os nós de 1,05 ficam no limite; se na validação o grafo
   sumir, subir para traço 1,2 e nós 1,2 (o logotipo tolera), ou fazer o ícone em 16 px nos dois
   lugares (`gitSvg` ajusta o `x` do texto pelo `ICON`).
4. Sem testes nem docs (memória do projeto). Validar a recarga do mod; validação visual nos dois
   temas, no cartão e no topo, ao lado do ⑂ da branch.
