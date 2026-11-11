import { spawn } from 'node:child_process'
import { dirname } from 'node:path'

export interface OpenCommand {
  command: string
  args: string[]
}

// explorer.exe ouvre un fichier avec son application par défaut, sans passer par cmd (pas de souci d'échappement).
export function openCommand(path: string, platform: NodeJS.Platform = process.platform): OpenCommand {
  if (platform === 'win32') return { command: 'explorer.exe', args: [path] }
  return { command: platform === 'darwin' ? 'open' : 'xdg-open', args: [path] }
}

// xdg-open ne sait pas sélectionner un fichier : sous Linux on ouvre son dossier.
// Sous Windows, « /select, » et le chemin en deux arguments : Node met le chemin entre guillemets s'il contient des espaces.
export function revealCommand(path: string, platform: NodeJS.Platform = process.platform): OpenCommand {
  if (platform === 'darwin') return { command: 'open', args: ['-R', path] }
  if (platform === 'win32') return { command: 'explorer.exe', args: ['/select,', path] }
  return { command: 'xdg-open', args: [dirname(path)] }
}

export function launch({ command, args }: OpenCommand): void {
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true })
  // Sans écouteur, une commande introuvable ferait tomber le serveur.
  child.on('error', (err) => console.error(`[board] ${command} a échoué :`, err.message))
  child.unref()
}
