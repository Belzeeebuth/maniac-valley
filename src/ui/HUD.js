// ============================================================================
// HUD — barres Vie/Énergie/Faim (clignotement aux dégâts), or, horloge, saison
// et météo, label de zone, barre de vie de boss, et rendu de la Hotbar.
// ============================================================================

import { ITEMS, RARITY } from '../systems/Inventory.js';
import { Sprites } from '../graphics/SpriteSheetGenerator.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      hp: document.getElementById('hpFill'), hpText: document.getElementById('hpText'),
      stam: document.getElementById('stamFill'), stamText: document.getElementById('stamText'),
      hunger: document.getElementById('hungerFill'), hungerText: document.getElementById('hungerText'),
      gold: document.getElementById('goldVal'),
      clock: document.getElementById('clockVal'), weather: document.getElementById('weatherIcon'),
      season: document.getElementById('seasonVal'), day: document.getElementById('dayVal'),
      scene: document.getElementById('sceneLabel'),
      bossBar: document.getElementById('bossBar'), bossName: document.getElementById('bossName'),
      bossFill: document.getElementById('bossFill'),
      hotbar: document.getElementById('hotbar'),
    };
    this.buildHotbar();
  }

  buildHotbar() {
    const hb = this.el.hotbar;
    hb.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.index = i;
      const key = document.createElement('div'); key.className = 'key'; key.textContent = (i + 1) % 10;
      const cv = document.createElement('canvas'); cv.width = 46; cv.height = 46;
      const count = document.createElement('div'); count.className = 'count';
      slot.append(key, cv, count);
      slot.addEventListener('click', () => { this.game.selectHotbar(i); });
      slot.addEventListener('mouseenter', (e) => {
        const s = this.game.inventory.hotbar[i];
        if (s) this.game.tooltip.show(s.id, e.clientX, e.clientY);
      });
      slot.addEventListener('mousemove', (e) => {
        const s = this.game.inventory.hotbar[i];
        if (s) this.game.tooltip.show(s.id, e.clientX, e.clientY);
      });
      slot.addEventListener('mouseleave', () => this.game.tooltip.hide());
      // cible de drop depuis l'inventaire
      slot.addEventListener('dragover', (e) => { e.preventDefault(); });
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData('text/plain');
        if (from) this.game.inventoryUI.dropOnHotbar(parseInt(from, 10), i);
      });
      hb.appendChild(slot);
    }
  }

  renderHotbar() {
    const inv = this.game.inventory;
    for (let i = 0; i < 10; i++) {
      const slot = this.el.hotbar.children[i];
      slot.classList.toggle('selected', i === inv.selected);
      const cv = slot.querySelector('canvas');
      const c = cv.getContext('2d');
      c.clearRect(0, 0, 46, 46);
      const s = inv.hotbar[i];
      const count = slot.querySelector('.count');
      slot.className = 'slot' + (i === inv.selected ? ' selected' : '');
      if (s) {
        Sprites.itemIcon(c, s.id, 7, 7, 32);
        const it = ITEMS[s.id];
        count.textContent = (it.stack > 1 && s.count > 1) ? s.count : '';
        const rar = (it.rarity || 'common');
        if (rar !== 'common') slot.classList.add('border-' + RARITY[rar].cls);
      } else count.textContent = '';
    }
  }

  update() {
    const g = this.game, p = g.player, t = g.time;
    const pct = (v, m) => Math.max(0, Math.min(100, v / m * 100)) + '%';
    this.el.hp.style.width = pct(p.hp, p.maxHp);
    this.el.stam.style.width = pct(p.stamina, p.maxStamina);
    this.el.hunger.style.width = pct(p.hunger, p.maxHunger);
    this.el.hpText.textContent = Math.ceil(p.hp) + '/' + p.maxHp;
    this.el.stamText.textContent = Math.ceil(p.stamina);
    this.el.hungerText.textContent = Math.ceil(p.hunger);
    this.el.gold.textContent = p.gold;
    this.el.clock.textContent = t.clockString();
    const w = t.weatherLabel();
    this.el.weather.textContent = w.icon;
    this.el.season.textContent = t.seasonName;
    this.el.day.textContent = t.day;
    this.el.scene.textContent = g.scene === 'overworld' ? 'Ferme & Village' : ('Mine — Étage ' + g.mine.level);

    if (g.scene === 'mine' && g.mine.boss) {
      this.el.bossBar.classList.add('show');
      this.el.bossName.textContent = g.mine.boss.name;
      this.el.bossFill.style.width = pct(g.mine.boss.hp, g.mine.boss.maxHp);
    } else this.el.bossBar.classList.remove('show');
  }

  flashHp() {
    this.el.hp.classList.remove('flash');
    void this.el.hp.offsetWidth;
    this.el.hp.classList.add('flash');
  }
}
