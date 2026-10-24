// Where this session's git is: the repository (its folder's name) and the branch, read off the
// files alone, with no process: `$.session.root()` for the root (it follows /cd and a worktree), then
// up the folders from there to the first one with a `.git` (a session in a subfolder of a repository
// shows the repository and its branch, as at its root), and `$.fs.read` for `<dir>/.git/HEAD`, or,
// where `.git` is a file ("gitdir: <path>", a worktree or a submodule), `<path>/HEAD`.
// "ref: refs/heads/<branch>" names the branch; a bare hash is a detached head, shown by its first 7
// characters. The app gives no branch of its own (get_session has the cwd only), so each session
// reads its own and publishes it for its card (the person's words: "qual repositório e qual branch a
// sessão está trabalhando"). With no repository up the folders, or a `.git` that cannot be read as
// one, the session's folder itself, its path shortened (`~` for the home folder), as a folder with
// no branch (the person's words: "o ícone GIT deve ser trocado para uma pasta ... não deve ser
// mostrada a informação de branch"). No root (a working folder gone) gives nothing.

import type { GitInfo } from '../types'

// The branch a HEAD file names, or the detached head's short hash; nothing for a text neither.
export function parseHead(text: string): { branch: string; detached?: boolean } | undefined {
  const line = (text.trim().split('\n')[0] ?? '').trim()
  const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(line)
  if (ref) return { branch: ref[1].trim() }
  if (/^[0-9a-f]{7,64}$/i.test(line)) return { branch: line.slice(0, 7), detached: true }
  return undefined
}
// The last segment of a path, either slash.
export const basename = (path: string) => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? path
// The folder a path is in, either slash; none at the top of the disk ("C:\", "/").
export function parent(path: string): string | undefined {
  const p = path.replace(/[\\/]+$/, '')
  const at = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  if (at < 0) return undefined
  const up = p.slice(0, at)
  return up === '' ? p.slice(0, 1) : /^[a-zA-Z]:$/.test(up) ? `${up}${p[at]}` : up
}
// A path with the home folder at its start written `~` (case aside, either slash), the separators
// kept as they are; the cut to the room it has is the drawing's.
export function shortPath(path: string, home: string | undefined): string {
  const p = path.replace(/[\\/]+$/, '')
  if (!home) return p
  const h = home.replace(/[\\/]+$/, '')
  const norm = (s: string) => s.replace(/\\/g, '/').toLowerCase()
  if (norm(p) === norm(h)) return '~'
  if (norm(p).startsWith(`${norm(h)}/`)) return `~${p.slice(h.length)}`
  return p
}

// How far up the folders a `.git` is looked for.
const UP = 40

export async function readGit($: any): Promise<GitInfo | undefined> {
  let root = ''
  try {
    root = String((await $.session.root()) ?? '')
  } catch {}
  if (root === '') return undefined
  const folder = async (): Promise<GitInfo> => {
    let home: string | undefined
    try {
      home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? undefined
    } catch {}
    return { kind: 'folder', repo: shortPath(root, home) }
  }
  let dir: string | undefined = root
  for (let i = 0; i < UP && dir !== undefined; i++, dir = parent(dir)) {
    let has = false
    try {
      has = (await $.fs.exists(`${dir}/.git`)) === true
    } catch {}
    if (!has) continue
    // The first `.git` up the folders is the repository; one that cannot be read as one makes the
    // session's folder a plain folder.
    try {
      let head: string | undefined
      try {
        head = String(await $.fs.read(`${dir}/.git/HEAD`))
      } catch {}
      if (head === undefined) {
        // `.git` is not a folder here: a file pointing at the git dir (a worktree, a submodule).
        const dot = String(await $.fs.read(`${dir}/.git`))
        const m = /^gitdir:\s*(.+)$/m.exec(dot)
        if (!m) return await folder()
        const gd = m[1].trim()
        const abs = /^([a-zA-Z]:[\\/]|[\\/])/.test(gd) ? gd : `${dir}/${gd}`
        head = String(await $.fs.read(`${abs}/HEAD`))
      }
      const parsed = parseHead(head)
      if (!parsed) return await folder()
      return { repo: basename(dir), branch: parsed.branch, ...(parsed.detached ? { detached: true } : {}) }
    } catch {
      return await folder()
    }
  }
  return await folder()
}
