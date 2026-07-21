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
- **Village vivant** : plusieurs maisons aux toits colorés et des **habitants nommés** regroupés en foyers (seul, couple, famille, aîné) qui déambulent avec une IA simple ; fenêtres allumées la nuit.
- **Amitié & cadeaux** : chaque villageois a une jauge de cœurs (♥) ; parlez-leur chaque jour (+2) ou offrez-leur un objet (+8, +15 pour la nourriture/récoltes/poissons, 1 cadeau/jour) — leurs **dialogues évoluent** avec votre relation.
- **Pêche** 🎣 : canne à pêche (boutique ou fabrication), lancer sur l'eau visée, attendre la touche (« ! ») puis réussir le **mini-jeu de timing** (curseur dans la zone verte) — 4 poissons dont le légendaire *Poisson Roi*, la précision augmente la rareté.
- **Sauvegarde automatique** (LocalStorage) : à chaque nuit, toutes les 45 s et à la fermeture ; bouton **CONTINUER** sur l'écran-titre. Monde, inventaire, quêtes, amitiés et progression sont persistés.
- **Biomes de mine** : Roche (1-5), **Glace** (6-10, plaques glissantes) et **Lave** (11-15, flaques incandescentes) avec palettes et ambiances dédiées, plus des **pièges** (piques, lave). Les veines de minerai apparaissent en **amas** (or dès l'étage 3, diamant dès le 5) ; on remonte **un étage à la fois**.
- **Gouffres & passerelles** : les mines profondes (4+) sont trouées de **gouffres** infranchissables qu'on traverse en **posant des passerelles** (craftables en bois) — utilisables aussi pour enjamber la rivière en surface.
- **Bosquet aux Baies** (prairie sud) : buissons à **baies cueillables** qui repoussent tous les 2-3 jours, et un étang de pêche.
- **Ciblage à la souris** : labourer, arroser, planter, miner et construire **sur la tuile pointée par le curseur** (le joueur se tourne vers elle), jusqu'à **2 cases** de portée, avec réticule de visée vert/rouge.
- **Cycle jour/nuit** en temps réel (06:00 → 02:00), teinte d'ambiance progressive et halo de lumière autour du joueur et des torches.
- **Saisons & météo** : 4 saisons (28 jours chacune) qui conditionnent les cultures plantables ; météo dynamique (soleil, pluie qui arrose les champs, neige, et **éclipse maniaque** qui renforce les ennemis).
- **Survie** : jauges de Santé, Énergie, Faim, or à gagner/dépenser ; évanouissement et réveil le lendemain avec perte d'or.
- **Agriculture** : labourer, arroser, planter (**7 cultures** : blé, fraise, citrouille, tomate, carotte, maïs, myrtille — selon la saison) et récolter au fil des stades de pousse.
- **Élevage** : poules & vaches avec IA d'errance ; nourries au foin, elles produisent œufs et lait chaque jour.
- **Fabrication & construction** : clôtures, coffres, fourneau, épouvantail, torches, forge de lingots, cuisine et améliorations d'outils par paliers, avec prévisualisation de placement verte/rouge.
- **Mines procédurales** : 15 étages générés aléatoirement (veines de cuivre/fer/or/diamant, escaliers), combat à l'épée (hitbox orientée, coups **critiques**, recul, i-frames, dégâts flottants) contre slimes, squelettes et chauves-souris.
- **Boss** avec barre de vie dédiée : **Giga Slime Maniac** (étage 5 — se divise, ondes de choc) et **Roi des Taupes Mutant** (étage 10 — s'enfouit, charge, fait tomber des rochers).
- **Quêtes & boutique** : 3 quêtes actives tirées d'un pool (livraison, chasse, fabrication, minage) ; boutique PNJ d'achat/revente.
- **UI style Stardew/Terraria** : panneaux bois/pierre, Hotbar 10 slots, inventaire 4×8 avec **drag-and-drop**, **infobulles de rareté** (Commun / Rare / Épique / Maniaque), **dégâts flottants** colorés et **popups de butin**.
- **Rendu & post-traitement ("shaders" Canvas 2D)** : pixel art ombré en 3 tons avec ombres portées directionnelles (selon l'heure du soleil), **bloom / lumières émissives** floutées (torches, fourneau, lanterne du joueur, lucioles, récoltes prêtes, aura des boss), **color grading** cinématographique (golden hour, nuit bleutée, éclipse pourpre, pluie désaturée, teinte de mine), **particules d'ambiance** (pétales au printemps, feuilles en automne, poussières en été, lucioles la nuit), **grain de film**, fines scanlines et vignette.
- **Effets & vie** : **système de particules** (poussière de pas, étincelles de minage, éclats de mort, embers de torche, fumée de cheminée & de fourneau, feuilles), **screen shake** (dégâts, coups critiques, boss, minage), **eau animée** avec caustiques et reflets, **éclairs** pendant les orages (flash + foudre + tonnerre), **ombres de nuages** qui défilent, et **papillons** le jour.
- **Écran-titre animé** : ciel crépusculaire, lune et halo, étoiles scintillantes, collines en parallaxe, silhouettes d'arbres et lucioles.
- **Musique procédurale** (Web Audio) : ambiance générée à la volée qui s'adapte à la scène (ferme paisible / mine tendue / combat de boss), coupable avec **M**. Aucun fichier audio.

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
- **Architecture en gestionnaires** : `Game.js` (orchestrateur) délègue à `SceneManager` (monde/scènes), `RenderManager` (pipeline de rendu) et `SaveManager` (persistance LocalStorage).
- **Rendu Canvas 2D** : tous les sprites dessinés par le code, avec **cache offscreen des tuiles statiques** (herbe, chemins, murs, sols/minerais de mine) blittées via `drawImage` pour la performance.
- **Entrées multi-supports** : clavier/souris, **tactile** (joystick virtuel + boutons d'action/esquive sur mobile) et **manette** (Gamepad API : stick = déplacement, A = action, B = esquive, LB/RB = hotbar, Start = inventaire).
- **Audio Web Audio API** : effets sonores et musique d'ambiance générative synthétisés à la volée.
