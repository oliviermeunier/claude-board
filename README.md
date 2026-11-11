# Claude Board

Petite app locale qui affiche les notes que Claude Code (ou n'importe quel terminal) t'envoie : texte, commandes,
code, plans. Les notes sont rendues en markdown avec coloration syntaxique, copiables en un clic, et rangées par
projet.

- Linux, macOS et Windows
- Serveur Nuxt 4 sur `http://127.0.0.1:4848` (boucle locale uniquement, pas d'authentification)
- Stockage SQLite dans `~/.board/board.db`
- Mise à jour en direct dans le navigateur (Server-Sent Events)

## Installation

Prérequis :

- [Node.js](https://nodejs.org) 20.19+, 22.12+ ou plus récent (24 recommandé, c'est la version testée) ;
- git ;
- [Claude Code](https://claude.com/claude-code), pour la capture automatique des notes (facultatif : sans lui,
  `board-note` et l'API marchent quand même).

Les commandes sont les mêmes sous Linux, macOS et Windows (PowerShell ou Git Bash) :

```bash
git clone https://github.com/oliviermeunier/claude-board.git
cd claude-board
npm install
npm run setup
```

Puis ouvrir <http://127.0.0.1:4848>.

`npm run setup` :

1. construit l'app ;
2. installe les commandes `board-note` et `board-server` dans `~/.local/bin` (sous Windows :
   `%USERPROFILE%\.local\bin`) ;
3. ajoute deux hooks Claude Code dans `~/.claude/settings.json` : au démarrage de chaque session Claude Code, le
   serveur est lancé s'il ne tourne pas ; à la fin de chaque réponse, les notes sont envoyées au board. Les autres
   réglages et hooks sont conservés, et une copie est faite dans `settings.json.board-backup` ;
4. lance aussi le serveur à l'ouverture de session de l'ordinateur : service systemd utilisateur (Linux),
   LaunchAgent (macOS), raccourci dans le dossier Démarrage (Windows) ;
5. démarre le serveur.

Options :

- `npm run setup -- --no-autostart` : pas de lancement à l'ouverture de session de l'ordinateur ; le serveur démarre
  alors avec la première session Claude Code, ou avec `board-server start` ;
- `npm run setup -- --no-claude` : pas de hooks Claude Code ;
- `npm run setup:remove` : désinstalle tout ; les notes restent dans `~/.board/board.db`.

Les sessions Claude Code déjà ouvertes ne voient pas les hooks : les relancer après l'installation.

### Ajouter `~/.local/bin` au PATH

L'installation prévient si ce dossier n'est pas dans le `PATH`. Sans lui, tout fonctionne, sauf qu'il faut taper le
chemin complet de `board-note` et `board-server`.

- Linux, macOS : ajouter `export PATH="$HOME/.local/bin:$PATH"` à `~/.bashrc` ou `~/.zshrc`, puis ouvrir un nouveau
  terminal.
- Windows (PowerShell), puis ouvrir un nouveau terminal :

  ```powershell
  [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ";$env:USERPROFILE\.local\bin", 'User')
  ```

### Mise à jour

```bash
git pull
npm install
npm run setup
```

Relancer ensuite les sessions Claude Code ouvertes.

**Depuis une ancienne version installée avec `scripts/install.sh`** (lien `~/.local/bin/board-note` et service
`board.service` qui lançait `scripts/start.sh`) : ces scripts n'existent plus. La même procédure de mise à jour suffit,
`npm run setup` remplace le lien et le service. Tant qu'elle n'est pas faite, le service ne pourra plus redémarrer.

### En cas d'échec de `npm install`

`better-sqlite3` est un module natif : des binaires précompilés existent pour les systèmes courants. Si aucun ne
correspond, `npm install` le compile et il faut des outils de compilation : `build-essential` et `python3` (Linux),
les Command Line Tools de Xcode (macOS), les Build Tools de Visual Studio avec « Développement Desktop en C++ »
(Windows).

### État des tests

À chaque modification, la CI lance les tests puis une installation réelle (`npm run setup`, envoi d'une note,
désinstallation) sous Linux, macOS et Windows. Le lancement à l'ouverture de session n'y est pas couvert : il a été
vérifié sous Windows 11, mais pas encore avec le service systemd (Linux) ni le LaunchAgent (macOS). Ouvrir une issue
si le serveur ne démarre pas à l'ouverture de session.

## Envoyer une note

### Depuis Claude Code

Rien à faire de plus après `npm run setup`. Au démarrage de chaque session, un hook indique à Claude comment écrire une
note ; il suffit de lui en demander une (« fais-moi une note avec les commandes »). Claude écrit dans sa réponse :

```text
<note>
Titre de la note
Corps en **markdown**, blocs de code compris.
</note>
```

À la fin de la réponse, le hook `Stop` envoie le bloc au board. Les règles :

- `<note>` doit commencer une ligne et `</note>` en finir une : une mention dans une phrase est ignorée, comme un
  exemple placé dans un bloc de code ;
- la première ligne est le titre ; une note d'une seule ligne n'a pas de titre ;
- `<note pin>` au lieu de `<note>` crée une note épinglée ;
- le hook relit tout le transcript à chaque fois, donc une note manquée (serveur arrêté) est rattrapée à la réponse
  suivante. Une note déjà reçue n'est jamais recréée, même si tu l'as supprimée entre-temps.

### Depuis un terminal

```bash
# corps en markdown sur l'entrée standard
board-note "Titre" <<'EOF'
## Hello
EOF

echo "## Note rapide" | board-note "Titre"

# fichiers joints (--file est répétable) : téléchargeables et ouvrables depuis la note
board-note --file plan.md --file plan.pdf "Plan v2" <<< "## Ce qui change"

# modifier la note #42 : seul ce qui est fourni est remplacé
board-note --edit 42 <<< "## Nouveau corps"
board-note --edit 42 "Nouveau titre"
board-note --edit 42 --file plan-v2.md

# épingler : à la création, ou après coup (--unpin pour désépingler)
board-note --pin "Commandes de déploiement" <<< "..."
board-note --edit 42 --pin
```

Windows : depuis PowerShell 5.1, un pipe vers une commande externe perd les accents ; utiliser Git Bash ou lancer
d'abord `$OutputEncoding = [Text.UTF8Encoding]::new()`.

## Interface

- **Un onglet par projet.** Le projet d'une note est, dans l'ordre :
  1. le premier dossier sous `BOARD_DOCS_ROOT` (défaut `~/Documents/Claude`) de son premier fichier joint ;
  2. sinon le dossier depuis lequel elle a été envoyée : le premier dossier sous `BOARD_DOCS_ROOT`, sinon le dépôt
     git qui le contient (une note écrite dans `~/code/mon-app/src` va dans « mon-app »), sinon le dossier lui-même ;
  3. sinon « Autres » (note envoyée depuis le dossier personnel, par exemple).
- À l'ouverture, l'onglet affiché est celui de la note la plus récente ; une note arrivée ailleurs y pose une pastille.
- **Épingler** (punaise au survol de l'en-tête) : la note passe en haut de son onglet, avec un liseré sarcelle, et
  « Tout effacer » ne la touche pas.
- **Recherche** dans toutes les notes, tous projets confondus (titre et contenu) ; le projet de chaque résultat est
  indiqué devant son titre. « Tout effacer » ne vide que l'onglet courant.
- Cliquer une note pour la déplier. Au survol de l'en-tête : modifier (Ctrl+Entrée enregistre, Échap annule), copier
  le markdown, supprimer. Chaque bloc de code a son bouton copier.
- **Reprendre la session** : une note venue de Claude Code affiche, dépliée, le dossier de la session et un bouton qui
  copie la commande pour rouvrir cette conversation (`cd <dossier> && claude --resume <session>`), à coller dans un
  terminal.
- **Annuler une suppression** : une note supprimée, ou un onglet vidé avec « Tout effacer », peut être récupéré avec le
  bouton « Annuler » qui s'affiche quelques secondes en bas de l'écran. Les notes supprimées restent 7 jours dans une
  corbeille avant d'être effacées pour de bon.
- **Exporter** : télécharge les notes de l'onglet dans un fichier markdown (épinglées en premier).
- **Notifications** (cloche en haut à droite) : une alerte du bureau quand une note arrive alors que le board n'est
  pas affiché.
- **Raccourcis clavier** (`?` pour la liste) : `/` rechercher, `j` / `k` note suivante / précédente, `Entrée` déplier,
  `e` modifier, `p` épingler, `c` copier, `Suppr` supprimer, `h` / `l` onglet précédent / suivant, `Échap` fermer.
- En haut à droite : taille du texte (compact, normal, grand) et thème (système, clair, sombre), mémorisés dans le
  navigateur.

## Serveur

```bash
board-server status
board-server start      # si le lancement automatique n'est pas installé
board-server stop
```

Journal : `~/.board/server.log` (Windows, et Linux sans systemd), `journalctl --user -u board` (Linux avec systemd).

Variables d'environnement (à définir avant `npm run setup` pour le service) :

| Variable | Défaut | Rôle |
|---|---|---|
| `NITRO_PORT` | `4848` | port |
| `NITRO_HOST` | `127.0.0.1` | interface d'écoute |
| `BOARD_DB_PATH` | `~/.board/board.db` | base SQLite |
| `BOARD_DOCS_ROOT` | `~/Documents/Claude` | dossier racine des projets (voir onglets) |
| `BOARD_URL` | `http://127.0.0.1:4848` | adresse utilisée par `board-note` et les hooks |

## API

| Verbe | Route | Description |
|---|---|---|
| GET | `/api/notes?q=…` | Liste anté-chrono, filtre optionnel |
| POST | `/api/notes` | `{title?, body, files?: string[], cwd?, session_id?, pinned?}` → crée (`file_path` seul encore accepté) |
| POST | `/api/capture` | `{cwd?, session_id?, notes: [{title?, body, pinned?}]}` → crée les notes jamais reçues (utilisé par le hook) |
| PATCH | `/api/notes/:id` | `{title?, body?, files?, pinned?}` → modifie seulement les champs envoyés (`title: null` efface le titre ; épingler ne marque pas la note « modifiée ») |
| GET | `/api/notes/:id/files/:index` | Télécharge le n-ième fichier joint |
| DELETE | `/api/notes/:id` | Envoie la note à la corbeille (vidée après 7 jours) |
| DELETE | `/api/notes` | Envoie à la corbeille toutes les notes non épinglées → `{deleted: ids}` |
| DELETE | `/api/notes?project=X` | Idem pour le projet `X` (`project=` vide : notes sans projet) |
| POST | `/api/notes/restore` | `{ids}` → sort ces notes de la corbeille → `{restored: notes}` |
| GET | `/api/stream` | SSE : `note.created`, `note.updated`, `note.deleted`, `note.restored`, `note.cleared` (`project` si effacement ciblé) |
| POST | `/api/open` | `{path}` → ouvre le fichier (xdg-open, open, explorer.exe ; limité au dossier personnel) |
| POST | `/api/reveal` | `{path}` → montre le fichier dans le gestionnaire de fichiers (dossier parent sous Linux) |

Chaque note renvoyée porte `files` (chemins joints, dans l'ordre), `project` (`null` hors projet), `cwd`,
`session_id`, `pinned_at` (`null` si pas épinglée) et `updated_at` (`null` si jamais modifiée).

## Développement

```bash
npm run dev      # nuxt dev sur 4848 avec rechargement à chaud
npm test         # tests (lance son propre serveur sur 4849)
```

```
app/                  frontend Vue 3 (components/, composables/)
server/api/           routes Nitro
server/utils/         db, validation, projets, chemins, ouverture de fichiers
scripts/
  setup.mjs           installation multiplateforme
  board-note.mjs      CLI d'envoi de notes
  board-server.mjs    démarrer / arrêter / état du serveur
  claude-hook.mjs     hooks Claude Code (SessionStart, Stop)
  lib/                fonctions partagées (serveur, lecture du transcript, réglages Claude)
tests/
```

## Contribuer

Les issues et les pull requests sont bienvenues : voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[MIT](LICENSE)
