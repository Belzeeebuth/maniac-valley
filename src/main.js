// ============================================================================
// main.js — point d'entrée : instancie le jeu et démarre au clic sur COMMENCER.
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
document.getElementById('startButton').addEventListener('click', () => {
  SoundFX.ensure();
  startScreen.style.display = 'none';
  game.start();
});

// Réactive le contexte audio au premier geste utilisateur (politique navigateur).
window.addEventListener('pointerdown', () => SoundFX.ensure(), { once: true });
window.addEventListener('keydown', () => SoundFX.ensure(), { once: true });
