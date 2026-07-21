// ============================================================================
// SaveManager — sauvegarde/chargement complet via LocalStorage.
// Sauvegarde automatique : à chaque nouveau jour, toutes les 45 s et à la
// fermeture de l'onglet. Les mines (roguelite) ne sont pas persistées : au
// chargement le joueur se réveille chez lui.
// ============================================================================

const KEY = 'maniac-valley-save-v1';

export class SaveManager {
  constructor(game) {
    this.g = game;
    this.autosaveT = 0;
    window.addEventListener('beforeunload', () => { if (this.g.running) this.save(); });
  }

  hasSave() {
    try { return localStorage.getItem(KEY) !== null; } catch (e) { return false; }
  }

  clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* stockage indisponible */ }
  }

  save() {
    const g = this.g;
    if (!g.player || !g.overworld) return false;
    try {
      const ow = g.overworld;
      const data = {
        v: 1,
        time: { day: g.time.day, hour: Math.min(g.time.hour, 25.5), weather: g.time.weather },
        player: {
          x: g.player.x, y: g.player.y,
          hp: g.player.hp, stamina: g.player.stamina, hunger: g.player.hunger,
          gold: g.player.gold,
          swordLevel: g.player.swordLevel, pickLevel: g.player.pickLevel, axeLevel: g.player.axeLevel,
          kills: g.player.kills, crafted: g.player.crafted, mined: g.player.mined,
        },
        inventory: { hotbar: g.inventory.hotbar, backpack: g.inventory.backpack, selected: g.inventory.selected },
        quests: g.quests.quests,
        friendship: g.friendship,
        world: {
          grid: ow.tilemap.grid,
          farmland: ow.farmland,
          placed: ow.placed,
          treeHp: ow.treeHp, rockHp: ow.rockHp,
          treeTimers: ow.treeTimers, rockTimers: ow.rockTimers,
          bushes: ow.bushes,
          animalsFed: ow.animals.map(a => !!a.fed),
        },
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Applique une sauvegarde sur un monde fraîchement généré.
  // À appeler après game.init(). Retourne true si le chargement a réussi.
  load() {
    const g = this.g;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.v !== 1) return false;

      g.time.day = d.time.day; g.time.hour = d.time.hour; g.time.weather = d.time.weather;

      Object.assign(g.player, {
        x: d.player.x, y: d.player.y,
        hp: d.player.hp, stamina: d.player.stamina, hunger: d.player.hunger,
        gold: d.player.gold,
        swordLevel: d.player.swordLevel, pickLevel: d.player.pickLevel, axeLevel: d.player.axeLevel,
        kills: d.player.kills || {}, crafted: d.player.crafted || {}, mined: d.player.mined || {},
      });

      g.inventory.hotbar = d.inventory.hotbar;
      g.inventory.backpack = d.inventory.backpack;
      g.inventory.selected = d.inventory.selected || 0;

      if (Array.isArray(d.quests) && d.quests.length) g.quests.quests = d.quests;
      g.friendship = d.friendship || {};

      const ow = g.overworld, w = d.world;
      if (w.grid && w.grid.length === ow.tilemap.h) ow.tilemap.grid = w.grid;
      ow.farmland = w.farmland || {};
      ow.placed = w.placed || [];
      ow.treeHp = w.treeHp || {}; ow.rockHp = w.rockHp || {};
      ow.treeTimers = w.treeTimers || {}; ow.rockTimers = w.rockTimers || {};
      if (w.bushes) ow.bushes = w.bushes;
      if (Array.isArray(w.animalsFed)) ow.animals.forEach((a, i) => { a.fed = !!w.animalsFed[i]; });

      g.scene = 'overworld';
      g.camera.snap(g.player, ow.w, ow.h, g.canvas.width, g.canvas.height);
      g.sceneMgr && g.renderer && g.renderer.resize();
      g.hud.renderHotbar();
      g.toast('Partie chargée — Jour ' + g.time.day);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Auto-save périodique, appelé depuis la boucle de jeu.
  update(dt) {
    if (!this.g.running) return;
    this.autosaveT += dt;
    if (this.autosaveT >= 45) {
      this.autosaveT = 0;
      if (this.save()) this.g.floatText(this.g.player.cx, this.g.player.y - 20, '💾', '#9ad0ff');
    }
  }
}
