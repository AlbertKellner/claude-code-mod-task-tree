// Where this session's git is: the repository (its folder's name) and the branch, read off the
// files alone, with no process: `$.session.root()` for the root (it follows /cd and a worktree) and
// `$.fs.read` for `<root>/.git/HEAD`, or, where `.git` is a file ("gitdir: <path>", a worktree or
// a submodule), `<path>/HEAD`. "ref: refs/heads/<branch>" names the branch; a bare hash is a
// detached head, shown by its first 7 characters. The app gives no branch of its own
// (get_session has the cwd only), so each session reads its own and publishes it for its card
// (the person's words: "qual repositório e qual branch a sessão está trabalhando"). Anything
// missing or unreadable (no repository, no leave to read) gives nothing, and nothing is drawn.

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

export async function readGit($: any): Promise<GitInfo | undefined> {
  try {
    const root = String((await $.session.root()) ?? '')
    if (root === '') return undefined
    let head: string | undefined
    try {
      head = String(await $.fs.read(`${root}/.git/HEAD`))
    } catch {}
    if (head === undefined) {
      // `.git` is not a folder here: a file pointing at the git dir (a worktree, a submodule).
      const dot = String(await $.fs.read(`${root}/.git`))
      const m = /^gitdir:\s*(.+)$/m.exec(dot)
      if (!m) return undefined
      const dir = m[1].trim()
      const abs = /^([a-zA-Z]:[\\/]|[\\/])/.test(dir) ? dir : `${root}/${dir}`
      head = String(await $.fs.read(`${abs}/HEAD`))
    }
    const parsed = parseHead(head)
    if (!parsed) return undefined
    return { repo: basename(root), branch: parsed.branch, ...(parsed.detached ? { detached: true } : {}) }
  } catch {
    return undefined
  }
}
