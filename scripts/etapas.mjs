// As etapas do npm run check (scripts/testes.mjs) e o grupo que roda em paralelo: as etapas leves junto
// com o plugin test, e a primeira que falha encerra as que ainda rodam (decisão do usuário, 2026-11-15:
// "é possivel rodar as etapas do npm run check em paralello, e a primeira que quebrar, para as outras
// que ainda estiverem rodando?"; "sim"). Sem efeito ao importar, para as travas alcançarem.
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { etapaConferiu } from './guarda.mjs'

// As oito etapas, na ordem do resumo. junto: no grupo paralelo. depois: só depois de todas as outras
// passarem, sozinha e com a saída ao vivo. roda: no hook, os arquivos dela mudaram.
export function montarEtapas({ claude, modulos, repo, raiz, indice = false, comBase = [], hook = { travas: true, validate: true, tsc: true } }) {
  const etapa = (nome, cmd, args, roda = true, extra = { junto: true }) => ({ nome, cmd, args, bloqueia: true, roda, junto: false, depois: false, ...extra })
  return [
    // O catálogo regras/ contra os testes (ids, estados, ligações); node puro, em milissegundos.
    etapa('regras', process.execPath, ['scripts/regras.mjs', '--repo', repo]),
    // As travas do selo (scripts/selos.mjs), testadas num repositório temporário.
    etapa('travas', process.execPath, ['--test', 'scripts/travas.test.mjs'], hook.travas),
    // Os testes e o kit contra regras/selos.json: teste existente só muda com selo novo.
    etapa('selos', process.execPath, ['scripts/selos.mjs', '--repo', repo, ...comBase]),
    etapa('validate do marketplace', claude, ['plugin', 'validate', '.', '--strict'], hook.validate),
    etapa('validate do mod', claude, ['plugin', 'validate', 'task-tree', '--strict'], hook.validate),
    // O TypeScript instalado, pelo Node (o npx, sem ele, baixaria outro pacote de nome tsc).
    etapa('tsc', process.execPath, [join(modulos, 'typescript', 'bin', 'tsc'), '--noEmit', '-p', 'task-tree'], hook.tsc),
    etapa('plugin test', claude, ['plugin', 'test', 'task-tree']),
    // Os testes de HEAD contra o código novo; só com diferença em task-tree/ (ela mesma decide). Em
    // série com o plugin test: em paralelo, na máquina carregada, testes estouravam os 5 s do kit
    // (1 falha em 5 execuções do hook), e um hook que falha à toa empurra para o --no-verify.
    etapa('regressao', process.execPath, ['scripts/regressao.mjs', '--repo', repo, ...(indice ? ['--indice', '--raiz', raiz] : []), ...comBase], true, { depois: true }),
  ]
}

// As que rodam: em série antes do grupo (as tiradas dele), o grupo, e as que esperam todas passarem.
export function dividir(etapas) {
  const rodam = etapas.filter(e => e.roda)
  return {
    antes: rodam.filter(e => !e.junto && !e.depois),
    grupo: rodam.filter(e => e.junto),
    depois: rodam.filter(e => e.depois),
  }
}

// Os processos em curso, para o Ctrl+C encerrar.
export const emCurso = new Set()

// Lança a etapa com a saída capturada: a misturada (para mostrar) e o stdout sozinho (para
// etapaConferiu). Fora do Windows, cada etapa é líder de um grupo de processos, que encerrar() mata
// inteiro. fim resolve no close; se um neto segurar o canal depois de o processo sair, 2 s depois do
// exit.
export function lancar(etapa, opcoes = {}) {
  const proc = spawn(etapa.cmd, etapa.args, {
    ...opcoes,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  })
  emCurso.add(proc)
  let saida = ''
  let stdout = ''
  proc.stdout.setEncoding('utf8')
  proc.stderr.setEncoding('utf8')
  proc.stdout.on('data', d => {
    saida += d
    stdout += d
  })
  proc.stderr.on('data', d => (saida += d))
  const fim = new Promise(resolve => {
    let espera
    const acabar = status => {
      clearTimeout(espera)
      emCurso.delete(proc)
      resolve({ status, saida, stdout, pid: proc.pid })
    }
    proc.on('exit', (code, sinal) => {
      espera = setTimeout(() => acabar(code ?? (sinal ? 1 : null) ?? 1), 2000)
    })
    proc.on('close', (code, sinal) => acabar(code ?? (sinal ? 1 : null) ?? 1))
    proc.on('error', e => {
      saida += String(e)
      acabar(1)
    })
  })
  return { proc, fim, saida: () => saida }
}

// Encerra o processo e os descendentes. Windows: taskkill /T /F (processo que já saiu devolve erro,
// ignorado). Fora dele: SIGTERM ao grupo, e SIGKILL 2 s depois se ainda não saiu.
export function encerrar(proc) {
  if (!proc?.pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    return
  }
  const matar = sinal => {
    try {
      process.kill(-proc.pid, sinal)
    } catch (e) {
      if (e.code !== 'ESRCH') throw e
    }
  }
  matar('SIGTERM')
  if (proc.exitCode === null && proc.signalCode === null) {
    const t = setTimeout(() => matar('SIGKILL'), 2000)
    proc.once('exit', () => clearTimeout(t))
  }
}

export function encerrarTodas() {
  for (const p of emCurso) encerrar(p)
}

// O estado de uma etapa que terminou sozinha.
export function julgar(etapa, r) {
  const status = r.status ?? 1
  if (status === 0) return etapaConferiu(etapa.nome, r.stdout ?? '') ? { estado: 'passou', codigo: 0 } : { estado: 'naoConferiu', codigo: 1 }
  return { estado: etapa.bloqueia ? 'falhou' : 'aviso', codigo: status }
}
const bloqueou = est => est.estado === 'falhou' || est.estado === 'naoConferiu'

// Roda o grupo: lança todas de uma vez; aoTerminar(etapa, estado) a cada uma que termina sozinha, na
// ordem em que terminam. Na primeira falha que bloqueia, encerra as que ainda rodam e espera cada uma
// fechar, até `teto` ms (a que não fecha volta com naoFechou). Devolve Map nome → estado
// ({ estado: passou | falhou | naoConferiu | aviso | encerrada, codigo, saida, pid, causa }).
export function rodarGrupo(grupo, { opcoes = () => ({}), aoTerminar = () => {}, teto = 10000 } = {}) {
  const estados = new Map()
  if (!grupo.length) return Promise.resolve(estados)
  return new Promise(tudo => {
    let falhou = null
    let faltam = grupo.length
    const tetos = []
    const corridas = grupo.map(e => ({ e, ...lancar(e, opcoes(e.cmd)) }))
    const fechar = (e, est) => {
      if (estados.has(e.nome)) return
      estados.set(e.nome, est)
      if (--faltam > 0) return
      tetos.forEach(clearTimeout)
      tudo(estados)
    }
    for (const c of corridas) {
      c.fim.then(r => {
        if (estados.has(c.e.nome)) return
        // Depois de pedido o encerramento, o que fecha é encerrado (no Windows o taskkill /F devolve 1,
        // igual a uma falha própria).
        if (falhou) return fechar(c.e, { estado: 'encerrada', causa: falhou, codigo: r.status, saida: r.saida, pid: r.pid })
        const est = { ...julgar(c.e, r), saida: r.saida, pid: r.pid }
        aoTerminar(c.e, est)
        if (bloqueou(est)) {
          falhou = c.e.nome
          for (const o of corridas) {
            if (o === c || estados.has(o.e.nome)) continue
            encerrar(o.proc)
            tetos.push(setTimeout(() => fechar(o.e, { estado: 'encerrada', causa: falhou, naoFechou: true, pid: o.proc.pid }), teto))
          }
        }
        fechar(c.e, est)
      })
    }
  })
}

// As linhas do resumo final, na ordem da lista, quaisquer que sejam a ordem e o jeito como terminaram.
export function linhasDoResumo(etapas, estados) {
  return etapas.map(({ nome, roda }) => {
    if (!roda) return `--    ${nome} (pulada no hook: os arquivos dela não mudaram)`
    const est = estados.get(nome)
    if (!est) return `--    ${nome} (não rodou)`
    switch (est.estado) {
      case 'passou':
        return `ok    ${nome}`
      case 'falhou':
        return `FALHA ${nome} (exit ${est.codigo})`
      case 'naoConferiu':
        return `FALHA ${nome} (a etapa não conferiu nada: o script saiu sem a linha de resumo)`
      case 'aviso':
        return `AVISO ${nome} (exit ${est.codigo}, não bloqueia)`
      case 'encerrada':
        return `--    ${nome} (encerrada: ${est.causa} falhou)`
      default:
        return `--    ${nome} (não rodou)`
    }
  })
}
