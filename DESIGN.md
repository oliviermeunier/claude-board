# Charte graphique de Claude Board

Un outil calme, qu'on garde ouvert à côté du terminal. Fonds sombres ou clairs presque neutres, et deux couleurs
seulement, chacune avec un rôle précis : on doit pouvoir lire l'état du board d'un coup d'œil.

## Les deux couleurs

| | Rôle | Sombre | Clair |
|---|---|---|---|
| **Lagune** (sarcelle) `--primary` | Ce qui est interactif : onglet actif, liens, focus, boutons principaux, fichiers joints | `#2EC4B6` | `#0B7A70` |
| **Ambre** `--highlight` | Ce qui vient d'arriver : pastilles de notes non lues, bordure gauche d'une note nouvelle, bandeau « nouvelles notes » | `#FFB547` | `#F59E0B` (fond), `#8A4B00` (texte) |

Règles :

- **Lagune = « je peux agir », Ambre = « c'est nouveau ».** Ne jamais utiliser l'ambre pour un bouton, ni la sarcelle
  pour signaler une nouveauté.
- L'ambre disparaît quand la note est lue : il ne doit jamais rester à l'écran sans raison.
- Le **vermillon** `--danger`, un rouge tirant sur l'orange (complémentaire de la Lagune), n'apparaît que pour la
  suppression : « Tout effacer » (fond teinté au repos, plein au survol), bouton de suppression armé, erreurs.
  Sombre `#FF6B4A`, clair `#C4401C`.
- Texte sur fond sarcelle : `--on-primary` ; sur fond ambre : `--on-highlight`. En thème clair, la sarcelle est
  assombrie pour garder un contraste d'au moins 4,5:1 sur blanc.

## Neutres

Gris légèrement teintés de sarcelle, pour que les deux couleurs restent les seules vives.

| Jeton | Usage | Sombre | Clair |
|---|---|---|---|
| `--bg` | fond de page | `#0B1214` | `#F4F7F6` |
| `--bg-elev` | cartes, champ de recherche | `#111B1E` | `#FFFFFF` |
| `--bg-elev-2` | survol, pastilles neutres | `#182529` | `#EBF1F0` |
| `--border` | bordures, séparateurs | `#23343A` | `#D9E3E1` |
| `--text` | texte | `#E4EEF0` | `#102221` |
| `--text-dim` | dates, compteurs, aide | `#8A9EA4` | `#5A6E6C` |
| `--code-bg` | blocs de code | `#0D181B` | `#F1F6F5` |

Un halo sarcelle très léger (`--glow`) éclaire le haut de la page.

## Typographie

- Texte : Inter si installée, sinon la police système (Segoe UI Variable, San Francisco, Roboto).
- Code : Cascadia Code, JetBrains Mono, sinon la police monospace du système.
- Base 16 px, interligne 1,6 (1,65 dans les notes). Toutes les tailles sont en `rem` : le réglage A / A / A
  (14,5 / 16 / 18 px) agrandit tout le board d'un coup.
- Titres de notes en semi-gras (600) ; logotype « Claude Board » en gras serré (750, approche -0,03 em), « Board » en Lagune.

## Formes

- Rayon : 12 px pour les cartes et le champ de recherche, 8 px pour les boutons, pilule pour les pastilles et les
  fichiers joints.
- Ombre seulement sur une note dépliée.
- Une note non lue porte un liseré ambre de 3 px à gauche ; une note épinglée, un liseré sarcelle (l'ambre l'emporte tant
  qu'elle n'est pas lue). La section « Épinglées » a son intitulé en sarcelle.

## Logo

Une fiche sarcelle posée sur une autre plus pâle, avec la pastille ambre « nouvelle note » dans le coin
(`app/components/BrandMark.vue`, favicon `public/favicon.svg`). Il reprend les deux rôles de la palette : la note et
son arrivée.

Les couleurs sont définies une seule fois, en variables CSS dans `app/app.vue`.
