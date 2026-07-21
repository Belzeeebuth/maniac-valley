// ============================================================================
// CraftingUI — onglets de catégories, liste des recettes avec coûts colorés
// (manque en rouge) et bouton de fabrication.
// ============================================================================

import { RECIPES, CRAFT_CATS } from '../systems/CraftingSystem.js';
import { ITEMS } from '../systems/Inventory.js';
import { Sprites } from '../graphics/SpriteSheetGenerator.js';

export class CraftingUI {
  constructor(game) {
    this.game = game;
    this.tabs = document.getElementById('craftingTabs');
    this.list = document.getElementById('craftingList');
    this.tab = 'build';
  }

  render() {
    this.tabs.innerHTML = '';
    for (const [id, label] of CRAFT_CATS) {
      const b = document.createElement('div');
      b.className = 'tab-btn' + (this.tab === id ? ' active' : '');
      b.textContent = label;
      b.addEventListener('click', () => { this.tab = id; this.render(); this.game.sound.play('ui'); });
      this.tabs.appendChild(b);
    }

    this.list.innerHTML = '';
    const cs = this.game.crafting;
    for (const r of RECIPES.filter(r => r.cat === this.tab)) {
      const row = document.createElement('div'); row.className = 'craft-row';
      const cv = document.createElement('canvas'); cv.width = 36; cv.height = 36;
      Sprites.itemIcon(cv.getContext('2d'), r.result, 2, 2, 32);
      row.appendChild(cv);

      const info = document.createElement('div'); info.className = 'craft-info';
      const name = document.createElement('div'); name.className = 'craft-name'; name.textContent = r.name;
      info.appendChild(name);

      const { cost, maxed, tierLabel } = cs.resolveCost(r);
      const costEl = document.createElement('div'); costEl.className = 'craft-cost';
      if (maxed || !cost) {
        costEl.textContent = tierLabel || 'Indisponible';
      } else {
        const parts = Object.keys(cost).map(k => {
          const lack = this.game.inventory.count(k) < cost[k];
          return `${ITEMS[k].name} x${cost[k]}${lack ? ' (manque)' : ''}`;
        });
        costEl.textContent = (tierLabel ? tierLabel + ' — ' : '') + parts.join(', ') + (r.needFurnace ? ' [Fourneau]' : '');
        if (!cs.canCraft(r)) costEl.classList.add('bad');
      }
      info.appendChild(costEl);
      row.appendChild(info);

      const btn = document.createElement('button'); btn.className = 'craft-btn'; btn.textContent = 'Fabriquer';
      btn.disabled = !cs.canCraft(r);
      btn.addEventListener('click', () => { if (cs.craft(r)) { this.render(); this.game.hud.renderHotbar(); } });
      row.appendChild(btn);
      this.list.appendChild(row);
    }
  }
}
