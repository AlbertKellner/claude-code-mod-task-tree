// Guardas comuns aos scripts, puras para as travas alcançarem.
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// O script foi chamado pela linha de comando? Compara os caminhos reais (links, junções e `subst`
// resolvidos): o Node resolve os links no caminho do módulo, não em process.argv[1]. Sem argv[1], ou
// com um dos dois caminhos inexistente, não é.
export function ehPrincipal(url, argv1 = process.argv[1]) {
  if (!argv1) return false
  try {
    return realpathSync.native(fileURLToPath(url)) === realpathSync.native(argv1)
  } catch {
    return false
  }
}

// A etapa conferiu? `regras` e `selos` terminam com a linha de resumo delas ("regras: …",
// "selos: …"); a que sai com 0 sem essa linha não conferiu nada. As outras etapas não têm linha
// exigida.
const RESUMO = { regras: /^regras: /m, selos: /^selos: /m }
export function etapaConferiu(nome, saida) {
  const r = RESUMO[nome]
  return r ? r.test(saida) : true
}
