# 🌾 Maniac Valley

Un **farming sim × action-RPG roguelite** en 2D, mêlant l'agriculture/survie de *Stardew Valley* et l'exploration/minage/combat de *Terraria* — avec une touche maniaque. Architecture **Vite + JavaScript ES6 modulaire**, rendu **Canvas 2D** et audio **Web Audio API**. Aucune image ni son importés : tout est généré procéduralement au runtime.

## ▶️ Lancer le jeu

### Version modulaire (Vite)
```bash
npm install
npm run dev      # serveur de développement (http://localhost:5173)
# ou
npm run build && npm run preview   # build de production
```

### Version classique (fichier unique, zéro build)
Le jeu existe aussi en un **unique `public/classic.html`** ouvrable directement dans le navigateur, sans installation. Un lien vers cette version figure sur l'écran d'accueil.

## 🎮 Contrôles

| Action | Touche |
|---|---|
| Se déplacer | `ZQSD` / `WASD` / Flèches |
| Utiliser l'outil / Attaquer / Interagir | `Clic gauche` |
| Esquive (roulade) | `Espace` |
| Sélection Hotbar | `1` à `0` |
| Inventaire | `E` |
| Fabrication | `C` |
| Journal de Quêtes | `J` |
| Fermer un menu | `Échap` |

## 🕹️ Fonctionnalités

- **Monde & zones** : ferme, village (boutique + panneau de quêtes) et entrée de mine, caméra à défilement fluide, collisions strictes.
- **Cycle jour/nuit** en temps réel (06:00 → 02:00), teinte d'ambiance progressive et halo de lumière autour du joueur et des torches.
- **Saisons & météo** : 4 saisons (28 jours chacune) qui conditionnent les cultures plantables ; météo dynamique (soleil, pluie qui arrose les champs, neige, et **éclipse maniaque** qui renforce les ennemis).
- **Survie** : jauges de Santé, Énergie, Faim, or à gagner/dépenser ; évanouissement et réveil le lendemain avec perte d'or.
- **Agriculture** : labourer, arroser, planter (blé, fraise, citrouille, tomate — selon la saison) et récolter au fil des stades de pousse.
- **Élevage** : poules & vaches avec IA d'errance ; nourries au foin, elles produisent œufs et lait chaque jour.
- **Fabrication & construction** : clôtures, coffres, fourneau, épouvantail, torches, forge de lingots, cuisine et améliorations d'outils par paliers, avec prévisualisation de placement verte/rouge.
- **Mines procédurales** : 15 étages générés aléatoirement (veines de cuivre/fer/or/diamant, escaliers), combat à l'épée (hitbox orientée, coups **critiques**, recul, i-frames, dégâts flottants) contre slimes, squelettes et chauves-souris.
- **Boss** avec barre de vie dédiée : **Giga Slime Maniac** (étage 5 — se divise, ondes de choc) et **Roi des Taupes Mutant** (étage 10 — s'enfouit, charge, fait tomber des rochers).
- **Quêtes & boutique** : 3 quêtes actives tirées d'un pool (livraison, chasse, fabrication, minage) ; boutique PNJ d'achat/revente.
- **UI style Stardew/Terraria** : panneaux bois/pierre, Hotbar 10 slots, inventaire 4×8 avec **drag-and-drop**, **infobulles de rareté** (Commun / Rare / Épique / Maniaque), **dégâts flottants** colorés et **popups de butin**.

## 📁 Architecture

```
maniac-valley/
├── index.html                  # Point d'entrée Vite
├── package.json
├── style.css                   # Skin UI rétro (bois/pierre)
├── public/
│   └── classic.html            # Version jouable en fichier unique
└── src/
    ├── main.js                 # Bootstrap
    ├── engine/
    │   ├── Game.js             # Boucle 60 FPS, état, rendu, monde
    │   ├── Camera.js           # Suivi fluide
    │   ├── InputHandler.js     # Clavier / souris
    │   └── SoundFX.js          # Synthétiseur Web Audio
    ├── world/
    │   ├── TileMap.js          # Grille, tuiles, collisions
    │   ├── DayNightCycle.js    # Horloge, saisons, météo
    │   └── MineGenerator.js    # Génération procédurale des mines
    ├── entities/
    │   ├── Player.js  Animal.js  Crop.js  Enemy.js  Boss.js
    ├── systems/
    │   ├── FarmingSystem.js  CombatSystem.js  CraftingSystem.js
    │   ├── QuestSystem.js    Inventory.js
    ├── ui/
    │   ├── HUD.js  InventoryUI.js  CraftingUI.js
    │   ├── QuestUI.js  ShopUI.js  Tooltip.js
    └── graphics/
        └── SpriteSheetGenerator.js   # Pixel art procédural
```

## 🛠️ Technique
- **Vanilla JavaScript (ES Modules)** — aucune bibliothèque de jeu, bundlé par Vite.
- **Rendu Canvas 2D** : tous les sprites (joueur, tuiles, plantes, animaux, monstres, boss, objets) dessinés par le code.
- **Audio Web Audio API** : chaque effet sonore synthétisé à la volée (oscillateurs + bruit filtré).
