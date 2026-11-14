# Lote 13 (triagem C): arquivos publicados lidos só quando mudam

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- A parte direta do achado "Arquivos publicados nunca são apagados, crescem sem teto e são relidos por
  inteiro a cada 3 s". A triagem a marca como opcional ("custo, não painel errado"); entra porque as
  instruções pedem todas as correções diretas. A orquestradora pode deixá-la para depois sem afetar
  nenhum outro lote.
- Não cobre "não reler a filha arquivada depois da primeira leitura": isso está no lote 13 da triagem
  A (higiene das arquivadas), que mexe na mesma função.

## 2. Causa confirmada na ponta

- Escrito, `io/host.ts:78-99` (`readFiles`): a cada releitura (3 s, `hooks/sessions.ts:287-295`) o
  arquivo de cada filha listada é lido e interpretado de novo (`readPublished`, `io/publish.ts:78-98`),
  mude ou não.
- Escrito, `hooks/sessions.ts:117-120` (`watchSends`): lê de novo os arquivos das sessões com carta
  na fila, na mesma releitura.
- Escrito, tipos do kit: `$.fs.list(pasta)` devolve nome, tamanho e `mtimeMs` de cada arquivo numa
  chamada.
- Medido pela triagem: arquivos de até 816 KB. Dedução: com várias filhas, cada 3 s custa a leitura e
  a interpretação de megabytes que não mudaram.

## 3. O que muda

- `io/publish.ts`: um leitor com memória por módulo. Cada releitura faz uma listagem da pasta dos
  arquivos publicados e, para cada sessão pedida, só lê e interpreta o arquivo quando o tamanho ou a
  data de gravação mudou desde a última leitura boa; senão devolve o resultado guardado. Sem a
  listagem (erro, pasta ausente), lê como hoje. Arquivo que sumiu da listagem vale como ausente. Uma
  recarga do mod esquece a memória e lê tudo uma vez.
- `io/host.ts` (`readFiles`) e `hooks/sessions.ts` (`refreshChildren`, `watchSends`): a listagem é
  feita uma vez por releitura e passada aos dois; ambos usam o leitor com memória.
- O que cada leitura devolve não muda; o painel não muda.

## 4. Impacto

`npm run impacto -- io/publish.ts io/host.ts hooks/sessions.ts`: 53 cenários (sessões 22, envios 17,
ultracode 5, subagentes 4, durabilidade 3, pedidos 2). Checklist: `envios.destino-arquivado-no-app`,
`envios.subagente-no-app`, `ultracode.cor-e-corte` (não tocados). Golden: nenhum.

## 5. Testes de verificação (`tests/sessoes.test.ts`)

O `host` do kit ganha a listagem da pasta (`fs.list`, com tamanho e data que mudam quando o painel da
filha muda no teste; o lote 11 já pede essa listagem) e um contador das leituras por arquivo (selo de
refatoração do kit).
- "o arquivo de uma filha que não mudou não é lido de novo". Regra:
  `sessoes.arquivo-lido-so-quando-muda`. Uma filha aberta; três `aviso` seguidos: uma leitura do
  arquivo dela; o cartão igual nas três. Falha hoje: três leituras.
- "o arquivo que mudou é lido na releitura seguinte". Mesma regra: muda o painel da filha no `host`;
  `aviso`: uma leitura a mais e o cartão com a tarefa nova.
- "sem a listagem da pasta, lê como antes". Mesma regra: `fs.list` em erro; o cartão aparece.
- Todos os testes existentes de sessões e envios seguem passando com o `host` atual (sem `fs.list`
  registrado, o leitor cai no caminho de hoje): é a prova de que nada visível muda.

## 6. Catálogo (`regras/sessoes.md`) e selos

Novo, `coberto`:

```markdown
### sessoes.arquivo-lido-so-quando-muda
O arquivo publicado de uma filha só é lido de novo quando muda.

- Dado filhas com o painel publicado, relidas a cada poucos segundos
- Quando o arquivo de uma filha não mudou desde a última leitura
- Então ele não é lido nem interpretado de novo, e o cartão segue igual; quando muda, a releitura seguinte o lê e o cartão acompanha; sem a listagem da pasta, a leitura é a de sempre

Origem: auditoria 2026-11-10 (arquivos relidos por inteiro a cada 3 s); sem mudar nenhuma regra do painel.
Estado: coberto
```

Selos:
- `node scripts/selos.mjs --kit task-tree/tests/kit/ambiente.ts --tipo refatoracao --motivo "host com a listagem da pasta e o contador de leituras"`
- `npm run regras:selar -- "task-tree/tests/sessoes.test.ts::<nome>" --tipo novo --motivo "auditoria: arquivo publicado lido só quando muda"`, um por teste novo.

## 7. Documentação

`state/durability.ts`: uma linha de variável de módulo na `TABLE` (a memória das leituras).
`DESENVOLVIMENTO.md`: no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

- Com duas ou três filhas reais paradas, o painel segue atualizando o cartão da que trabalha em até
  3 s (nada deixa de aparecer por causa da memória).

## 10. Dependências e conflitos

- Depois do lote 11 (mesmos arquivos e o mesmo apoio de listagem no kit).
- Triagem A, lote 12 (leitura das filhas, uma execução por vez) e lote 13 (não reler arquivada;
  registrar as 100 linhas): mesma função `readFiles` e mesmo `refreshChildren`. Fazer em sequência; o
  "não reler arquivada" de lá e o "só quando muda" daqui se somam (a arquivada nem entra na conta).
- Triagem B, lote 10 (recibo guardado no envio) usa o `received` lido por `watchSends`: o resultado
  guardado é o mesmo objeto de antes; não muda o que ele vê.

## 11. Bloqueio

Nenhum.
