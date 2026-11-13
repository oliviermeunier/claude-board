# Contribuer à Claude Board

Merci de ton intérêt. Le projet est petit et maintenu sur du temps libre : les réponses peuvent prendre quelques jours.

## Avant de coder

- Pour un bug : ouvre une issue avec le modèle « Bug », en précisant ton système et ta version de Node.
- Pour une nouvelle fonctionnalité ou un changement visible : ouvre d'abord une issue « Idée », pour en discuter avant
  d'écrire du code. Les petites corrections (typo, doc) peuvent aller directement en pull request.

## Mettre en place l'environnement

Node 22.12 ou plus récent (24 recommandé).

```bash
git clone https://github.com/<ton-compte>/claude-board.git
cd claude-board
npm install
npm run dev        # serveur de développement sur http://127.0.0.1:4848
npm test           # tests (lancent leur propre serveur sur le port 4849)
```

Si tu as aussi installé le board avec `npm run setup`, arrête-le avant `npm run dev` (`board-server stop`, ou
`systemctl --user stop board` sous Linux), sinon le port 4848 est déjà pris.

## Conventions

- **Code** (identifiants, commentaires techniques) en anglais ; **interface et documentation** en français.
- **Multiplateforme** : le board tourne sous Linux, macOS et Windows. Passer par `node:path` et `os.homedir()`, ne
  jamais supposer `/` comme séparateur ni la variable `HOME`. La CI teste les trois systèmes.
- **Tests** : toute modification de l'API ou des scripts vient avec un test (`tests/`).
- **Design** : respecter `DESIGN.md` (Lagune pour l'interactif, Ambre pour le nouveau, vermillon pour la suppression,
  tailles en `rem`). Les couleurs ne se définissent que dans `app/app.vue`.
- **Commits** : messages en français, préfixés `feat:`, `fix:`, `docs:`, `chore:`…, une modification cohérente par
  commit.
- **Pull requests** : petites et ciblées, à partir d'une branche de ton fork. La CI doit être verte avant la fusion.

## Licence

En contribuant, tu acceptes que ta contribution soit publiée sous la licence MIT du projet (voir `LICENSE`).
