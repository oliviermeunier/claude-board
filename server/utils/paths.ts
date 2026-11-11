import { homedir } from 'node:os'
import { isAbsolute, join, relative, sep } from 'node:path'

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

// Path of `child` relative to `parent`, or null when `child` is not strictly inside it.
// path.relative is case-insensitive on Windows, so C:\Users\X and c:\users\x match.
export function relativeInside(parent: string, child: string): string | null {
  const rel = relative(parent, child)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return null
  }
  return rel
}
