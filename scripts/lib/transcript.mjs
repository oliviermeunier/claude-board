// Finds the <note> blocks Claude writes in its answers.
//
// A block opens with a line that starts with <note> and closes with a line that ends with </note>.
// The first line is the title, the rest is the markdown body. Mentions inside a sentence
// (`<note>` in inline code) and examples inside code fences outside a block are ignored;
// code fences inside a block belong to the body.

const OPEN = /^\s*<note>/
const CLOSE = /<\/note>\s*$/
const FENCE = /^\s*(```|~~~)/

export function extractNotes(text) {
  const notes = []
  let inFence = false
  let block = null

  for (const line of text.split(/\r?\n/)) {
    if (block) {
      if (CLOSE.test(line)) {
        block.push(line.replace(CLOSE, ''))
        const note = toNote(block.join('\n'))
        if (note) notes.push(note)
        block = null
      } else {
        block.push(line)
      }
      continue
    }
    if (FENCE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence || !OPEN.test(line)) continue

    const rest = line.replace(OPEN, '')
    if (CLOSE.test(rest)) {
      const note = toNote(rest.replace(CLOSE, ''))
      if (note) notes.push(note)
    } else {
      block = [rest]
    }
  }
  return notes
}

function toNote(inner) {
  const content = inner.trim()
  if (!content) return null
  const newline = content.indexOf('\n')
  const title = (newline === -1 ? content : content.slice(0, newline)).replace(/^#+\s*/, '').trim()
  const body = newline === -1 ? '' : content.slice(newline + 1).trim()
  // The board needs a body: a one-line note becomes an untitled note.
  if (!body) return { title: null, body: title }
  return { title: title || null, body }
}

// Text of the assistant messages of a Claude Code transcript (JSON Lines).
export function assistantTexts(jsonl) {
  const texts = []
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    if (event?.type !== 'assistant') continue
    const content = event.message?.content
    if (typeof content === 'string') texts.push(content)
    else if (Array.isArray(content)) {
      for (const part of content) {
        if (part?.type === 'text' && typeof part.text === 'string') texts.push(part.text)
      }
    }
  }
  return texts
}

export function notesFromTranscript(jsonl) {
  return assistantTexts(jsonl).flatMap(extractNotes)
}
