# Durabilidade

O painel depois de reinício e recarga.

### durabilidade.reinicio-restaura-do-store
O reinício restaura o painel do store.

- Dado um painel salvo no store
- Quando a sessão reinicia (resume)
- Então o painel volta como estava

Origem: regra do painel; a confirmar.
Estado: pendente (durabilidade)

### durabilidade.formatos-antigos-do-publicado
Os formatos antigos do arquivo publicado são lidos.

- Dado um arquivo publicado por uma versão antiga do mod
- Quando o painel lê a sessão filha
- Então os 8 formatos são lidos

Origem: regra do painel; a confirmar.
Estado: pendente (durabilidade)

### durabilidade.recarga-mantem-painel-ligacoes-e-resumo
A recarga mantém o painel, as ligações e o resumo.

- Dado um painel com cartões ligados e um resumo ↩
- Quando o mod recarrega a quente
- Então o painel, as ligações e o resumo seguem iguais

Origem: regra do painel; a confirmar.
Estado: checklist (o kit não simula a recarga)
