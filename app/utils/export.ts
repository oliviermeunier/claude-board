// Markdown export of a tab's notes, pinned ones first.

export interface ExportableNote {
  title: string | null
  body: string
  created_at: string
  pinned_at: string | null
  files: string[]
}

function headline(note: ExportableNote): string {
  if (note.title?.trim()) return note.title.trim()
  const firstLine = note.body.split('\n').find((line) => line.trim()) ?? ''
  return firstLine.replace(/^#+\s*/, '').slice(0, 120) || '(sans titre)'
}

// Note bodies have their own headings: they are pushed down two levels so they stay under the note's title.
function demoteHeadings(body: string): string {
  let inFence = false
  return body
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
      if (inFence) return line
      return line.replace(/^(#{1,4})(\s)/, '##$1$2')
    })
    .join('\n')
}

export function notesToMarkdown(label: string, notes: ExportableNote[], now: Date = new Date()): string {
  const ordered = [...notes.filter((n) => n.pinned_at), ...notes.filter((n) => !n.pinned_at)]
  const parts = [
    `# ${label}`,
    '',
    `_${ordered.length} note${ordered.length > 1 ? 's' : ''} exportée${ordered.length > 1 ? 's' : ''} de Claude Board le ${now.toLocaleString('fr-FR')}_`,
  ]
  for (const note of ordered) {
    const meta = [new Date(note.created_at).toLocaleString('fr-FR'), note.pinned_at ? 'épinglée' : null]
      .filter(Boolean)
      .join(' · ')
    parts.push('', '---', '', `## ${headline(note)}`, '', `_${meta}_`, '', demoteHeadings(note.body.trim()))
    if (note.files.length > 0) {
      parts.push('', 'Fichiers joints :', '', ...note.files.map((file) => `- \`${file}\``))
    }
  }
  return `${parts.join('\n')}\n`
}

export function exportFileName(label: string, now: Date = new Date()): string {
  const slug =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'notes'
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `claude-board-${slug}-${day}.md`
}
