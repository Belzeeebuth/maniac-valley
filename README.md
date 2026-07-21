# 🌾 Maniac Valley

Un farming sim x action-RPG roguelite en 2D, inspiré de *Stardew Valley* et *Zelda* avec une touche maniaque — entièrement contenu dans un **unique fichier `index.html`**, sans aucune dépendance externe, sans image ni son importés.

## ▶️ Jouer

Aucune installation requise :

1. Télécharge `index.html`.
2. Ouvre-le dans n'importe quel navigateur moderne (Chrome, Firefox, Edge...).
3. Clique sur **COMMENCER**.

C'est tout — pas de serveur, pas de build, pas de dépendances.

## 🎮 Contrôles

| Action | Touche |
|---|---|
| Se déplacer | `ZQSD` / `WASD` / Flèches |
| Utiliser l'outil / Attaquer / Interagir | `Espace` ou Clic gauche |
| Inventaire | `E` |
| Fabrication | `C` |
| Journal de Quêtes | `J` |
| Sélection Hotbar | `1` à `0` |
| Fermer un menu | `Échap` |

## 🕹️ Fonctionnalités

- **Monde vivant** : ferme, village et entrée de mine sur une seule carte, avec caméra suivant le joueur et collisions (eau, arbres, rochers, clôtures, bâtiments).
- **Cycle jour/nuit** en temps réel, avec filtre de couleur progressif et halo de lumière autour du joueur (et des torches) la nuit. Dormir dans son lit fait avancer le jour, restaure les stats et fait pousser les cultures.
- **Survie** : jauges de Santé, Énergie et Faim, plus de l'or à gagner et dépenser.
- **Agriculture** : labourer, arroser, planter (blé, fraise, citrouille, tomate) et récolter au fil de plusieurs stades de pousse.
- **Élevage** : poules et vaches avec IA de déplacement simple ; nourries au foin, elles produisent œufs et lait chaque jour.
- **Artisanat & construction** : clôtures, coffres, fourneau, épouvantail, torches et améliorations d'outils, avec prévisualisation de placement verte/rouge.
- **Mines procédurales** : 10 niveaux générés aléatoirement (rochers, filons de cuivre/fer/or/diamant, escaliers), avec combat à l'épée (hitbox orientée, recul, frames d'invulnérabilité, dégâts flottants) contre slimes, squelettes et chauves-souris.
- **Deux boss** avec barre de vie dédiée : le **Giga Slime Maniac** (étage 5, se divise et déclenche des ondes de choc) et le **Roi des Taupes Mutant** (étage 10, s'enfouit, charge et fait tomber des rochers).
- **Quêtes & boutique** : panneau de quêtes rotatif (livraison, chasse, artisanat, minage) et boutique du village pour acheter des graines et vendre récoltes/minerais/produits animaux.
- **Interface complète** : hotbar 10 emplacements, inventaire en grille 4x8, menus de fabrication/quêtes/boutique.

## 🛠️ Technique

- **100% vanilla JavaScript** — aucune librairie, aucun framework.
- **Rendu** : Canvas 2D, tous les graphismes (personnage, tuiles, plantes, animaux, monstres, boss, objets) sont dessinés procéduralement au moment de l'exécution.
- **Audio** : tous les effets sonores sont synthétisés à la volée via la Web Audio API (oscillateurs et bruit filtré) — aucun fichier audio.
- Un seul fichier `index.html` contient le HTML, le CSS et le JavaScript.
