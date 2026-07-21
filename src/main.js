// ============================================================================
// main.js — point d'entrée : instancie le jeu, gère Nouvelle partie /
// Continuer (sauvegarde LocalStorage) et démarre depuis l'écran-titre.
// ============================================================================

import { Game } from './engine/Game.js';
import { SoundFX } from './engine/SoundFX.js';
import { Sprites } from './graphics/SpriteSheetGenerator.js';

const game = new Game();
// Exposé pour le débogage en console (et les tests automatisés).
window.MV = game;
window.Sprites = Sprites;

// Fond d'écran-titre animé (rendu sur le canvas, derrière l'UI d'accueil).
game.startTitle();

const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startButton');
const continueBtn = document.getElementById('continueButton');

if (game.saves.hasSave()) {
  continueBtn.style.display = 'block';
  startBtn.textContent = '▶ NOUVELLE PARTIE';
}

startBtn.addEventListener('click', () => {
  SoundFX.ensure();
  startScreen.style.display = 'none';
  game.start(false);
});
continueBtn.addEventListener('click', () => {
  SoundFX.ensure();
  startScreen.style.display = 'none';
  game.start(true);
});

// Réactive le contexte audio au premier geste utilisateur (politique navigateur).
window.addEventListener('pointerdown', () => SoundFX.ensure(), { once: true });
window.addEventListener('keydown', () => SoundFX.ensure(), { once: true });
