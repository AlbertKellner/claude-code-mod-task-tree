# Corte de 400 linhas: "+122 linhas" dentro da árvore (análise)

Base: `f5e2450`. Nada foi editado.

## Essencial

- **Não é bug: a regra do catálogo está imprecisa**, e a origem dela está errada.
  - O corte de linhas é de `1d55fa0` (2026-10-22, "limite de 400 linhas desenhadas, com corte e contagem"), aprovado pelo usuário: "Sim, com o corte" (DESENVOLVIMENTO, "Limite de linhas"). Não é de `4edb3f2`, que tratou de "+N pedidos anteriores" e do tamanho do desenho.
- **O que o código faz** (`limitRows`, `draw/layout.ts:617–635`), exatamente como o commit e o DESENVOLVIMENTO descrevem:
  - Até 400 linhas, nada muda.
  - Acima, saem **blocos inteiros de nível 0 do começo** (os mais antigos), contados numa linha `+N linhas anteriores`.
  - Se o **último bloco sozinho** passa do limite, o que vinha antes sai contado (`+N linhas anteriores`, só se havia algo antes), o bloco é desenhado até o limite e fecha com uma linha `+N linhas`, de profundidade 1 (alt "Linhas seguintes, não desenhadas").
  - Total sempre ≤ 400.
- **O caso do teste** (um pedido só, plano 8 × 8 × 7) é o do "último bloco sozinho":
  - não há bloco antes, então não aparece "+N linhas anteriores";
  - o bloco é desenhado até 399 linhas e fecha com "└─ +122 linhas";
  - as 402 linhas do painel são 400 linhas do desenho mais as 2 do cabeçalho.
  - É o comportamento aprovado.
- **Plano:**
  - reescrever o texto da regra (rótulos reais e os dois casos) e corrigir a origem;
  - cobrir com dois testes (vários blocos → "+N linhas anteriores"; um bloco grande → "+N linhas" no fim, total ≤ 400);
  - o estado passa a `coberto`. Nada no plugin muda.
- **Sem dúvida para o usuário.** Só um registro: no caso do bloco único, o fim do bloco (as tarefas planejadas por último) fica fora do desenho. Isso é parte do desenho aprovado, que privilegia guias inteiras e o começo do bloco.

## 1. Causa

- `limitRows` (`layout.ts:618–635`):
  - `from` = o primeiro índice de nível 0 a partir do qual o resto cabe em 399 linhas. Se existe, devolve `[+N linhas anteriores, …resto]`.
  - Senão (o último bloco sozinho passa do limite): `last` = o início do último bloco; `head` = `+last linhas anteriores` só se `last > 0`; `kept` = as primeiras linhas do bloco até completar 399; e no fim `{ key: 'sec:after', depth: 1, title: '+N linhas' }`.
- Com um pedido só, `last = 0`. Então não há "anteriores", e a linha final é "+N linhas", com profundidade 1. No terminal, ela aparece como "└─ +122 linhas", dentro da árvore do pedido.
- A regra do catálogo diz "+N linhas anteriores/seguintes", mas o rótulo do fim é "+N linhas" (o "seguintes" está só no alt), e não deixa claros os dois casos.

## 2. Bug ou regra desatualizada

- **Regra desatualizada no catálogo**, não bug. O limite é respeitado (≤ 400 linhas de desenho), a linha de corte fica onde o desenho aprovado diz (no fim do último bloco, profundidade 1), e a contagem é a das linhas que saíram.
- **Perda de informação:** sim, mas pelo desenho aprovado. O cabeçalho conta o que está desenhado, e "sessão inteira: X de Y" mostra o total. No caso do bloco único, saem as **últimas** linhas do bloco. O DESENVOLVIMENTO explica por quê: cortar por blocos inteiros do começo mantém o trabalho atual (que fica no fim), e "cortar dentro de um bloco quebraria as guias".
  - Quando o bloco único é maior que o limite, isso pode esconder tarefas em andamento no fim de um plano enorme.
  - É um caso extremo (o painel real mais longo tinha 31 linhas). Fica como observação, não como correção.

## 3. Plano

**Catálogo** (`regras/cabecalho.md`), `cabecalho.limite-de-linhas-do-desenho`:
```markdown
### cabecalho.limite-de-linhas-do-desenho
O desenho tem no máximo 400 linhas; o que passa vira uma linha de contagem.

- Dado um painel com mais de 400 linhas
- Quando é desenhado
- Então saem blocos inteiros de pedidos do começo (os mais antigos), contados em "+N linhas
  anteriores"; se o último pedido sozinho passa do limite, ele é desenhado até o limite e fecha com
  "+N linhas" no fim dele; o desenho nunca passa de 400 linhas

Origem: decisão do usuário ("Sim, com o corte"), 2026-10-22; commit 1d55fa0 (o tamanho do desenho, 4edb3f2, 2026-10-21, levou a ele).
Estado: coberto
```
- A regra não muda: só o texto passa a descrever o que foi aprovado. Como o cenário é `pendente` e nenhum teste o cita, não há teste selado a reescrever.
- Se o processo exigir a marca, acrescentar `Reescrito: 2026-10-28, texto corrigido para o desenho aprovado em 2026-10-22 (sem mudança de regra).`

**Testes** (`tests/cabecalho.test.ts`, `// Regra: cabecalho.limite-de-linhas-do-desenho`; `{ timeoutMs: 15000 }` por segurança, já que o caso medido leva 2,5 s):
1. **Um pedido grande demais:** o plano 8 × 8 × 7 num pedido só.
   - O número de linhas do desenho (sem as 2 do cabeçalho) é ≤ 400.
   - A última linha é "+N linhas", com N = o total de linhas do pedido menos as desenhadas.
   - Não há "linhas anteriores".
   - As primeiras tarefas do plano aparecem.
2. **Pedidos antigos saem do começo:** dois ou três pedidos, o último cabendo em 399 linhas e os anteriores grandes (por exemplo, dois de 8 × 8 × 4 e um pequeno).
   - A primeira linha do desenho é "+N linhas anteriores".
   - O último pedido aparece inteiro.
   - Nenhuma linha "+N linhas" no fim.
   - **Atenção:** "+N pedidos anteriores" (`SHOWN_TURNS`) corta antes, quando há mais de 3 pedidos. Com 2 ou 3, só o corte de linhas age.
- O kit não muda: `painel()` e `emTexto` bastam. A contagem de linhas é `painel(p).length` menos as linhas do cabeçalho (`cabecalho: true`).

## 4. Impacto nas travas

- Nenhum arquivo do mod muda. Só `regras/cabecalho.md` e `tests/cabecalho.test.ts` (dois testes novos, selo `novo`).
- Nenhum teste existente muda; `testes:alterados` confirma.
- A Implementação está mexendo em `task-tree/` agora (tipos e código morto). Este commit toca só `tests/` e `regras/`, mas roda a suíte inteira: fazer **depois** do commit dela, para o check ver o código final.

## 5. Brief para a Implementação (depois do commit de tipos e código morto)

Na branch `test/regressivos-automacao-testes`. Um commit local. Sem push.

1. `regras/cabecalho.md`: o cenário da seção 3, com o texto e a origem corrigidos e `Estado: coberto`.
2. `tests/cabecalho.test.ts`: os testes 1 e 2 da seção 3, com `// Regra: cabecalho.limite-de-linhas-do-desenho`; selar `--tipo novo`.
3. `npm run check` verde; o relato traz o tempo dos dois testes e `npm run testes:alterados` (nenhum teste existente mudou).

Commit: `test(task-tree): limite de 400 linhas do desenho (pedidos antigos saem do começo; bloco grande fecha com +N linhas)`.

O usuário valida lendo a regra reescrita em `regras/cabecalho.md`, que agora diz o que ele aprovou em 2026-10-22.
