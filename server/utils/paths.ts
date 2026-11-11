import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'

// os.homedir() reads HOME on Linux/macOS and USERPROFILE on Windows, where HOME is usually unset.
export function homeDir(): string {
  return homedir()
}

export function defaultDbPath(): string {
  return join(homeDir(), '.board', 'board.db')
}

export function docsRoot(): string {
  return process.env.BOARD_DOCS_ROOT || join(homeDir(), 'Documents', 'Claude')
}

const gitRoots = new Map<string, string | null>()

// Nearest folder holding .git (cached: notes are listed often, folders rarely change).
export function gitRoot(dir: string): string | null {
  if (gitRoots.has(dir)) return gitRoots.get(dir)!
  let current = dir
  let found: string | null = null
  while (true) {
    if (existsSync(join(current, '.git'))) {
      found = current
      break
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  gitRoots.set(dir, found)
  return found
}

// Path of `child` relative to `parent`, or null when `child` is not strictly inside it.
// path.relative is case-insensitive on Windows, so C:\Users\X and c:\users\x match.
export function relativeInside(parent: string, child: string): string | null {
  const rel = relative(parent, child)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return null
  }
  return rel
}
