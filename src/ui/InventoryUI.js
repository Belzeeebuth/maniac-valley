// ============================================================================
// InventoryUI — sac à dos 4x8 avec drag-and-drop (entre cases et vers la
// Hotbar) et infobulles de survol.
// ============================================================================

import { ITEMS, RARITY } from '../systems/Inventory.js';
import { Sprites } from '../graphics/SpriteSheetGenerator.js';

export class InventoryUI {
  constructor(game) {
    this.game = game;
    this.grid = document.getElementById('inventoryGrid');
    this.built = false;
  }

  build() {
    this.grid.innerHTML = '';
    for (let i = 0; i < 32; i++) {
      const cell = document.createElement('div');
      cell.className = 'inv-slot';
      cell.dataset.index = i;
      const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40;
      const count = document.createElement('div'); count.className = 'count';
      cell.append(cv, count);

      cell.setAttribute('draggable', 'true');
      cell.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); });
      cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', (e) => {
        e.preventDefault(); cell.classList.remove('drag-over');
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        this.dropBetweenBackpack(from, i);
      });
      // clic : échange avec le slot Hotbar sélectionné
      cell.addEventListener('click', () => {
        this.game.inventory.swap(this.game.inventory.selected, i);
        this.render(); this.game.hud.renderHotbar();
        this.game.sound.play('ui');
      });
      cell.addEventListener('mouseenter', (e) => {
        const s = this.game.inventory.backpack[i];
        if (s) this.game.tooltip.show(s.id, e.clientX, e.clientY);
      });
      cell.addEventListener('mousemove', (e) => {
        const s = this.game.inventory.backpack[i];
        if (s) this.game.tooltip.show(s.id, e.clientX, e.clientY);
      });
      cell.addEventListener('mouseleave', () => this.game.tooltip.hide());
      this.grid.appendChild(cell);
    }
    this.built = true;
  }

  dropBetweenBackpack(from, to) {
    if (from === to) return;
    const bp = this.game.inventory.backpack;
    const t = bp[from]; bp[from] = bp[to]; bp[to] = t;
    this.render();
    this.game.sound.play('ui');
  }

  dropOnHotbar(backpackIndex, hotbarIndex) {
    const inv = this.game.inventory;
    const t = inv.hotbar[hotbarIndex];
    inv.hotbar[hotbarIndex] = inv.backpack[backpackIndex];
    inv.backpack[backpackIndex] = t;
    this.render(); this.game.hud.renderHotbar();
    this.game.sound.play('ui');
  }

  render() {
    if (!this.built) this.build();
    const inv = this.game.inventory;
    for (let i = 0; i < 32; i++) {
      const cell = this.grid.children[i];
      const cv = cell.querySelector('canvas');
      const c = cv.getContext('2d');
      c.clearRect(0, 0, 40, 40);
      const count = cell.querySelector('.count');
      cell.className = 'inv-slot';
      const s = inv.backpack[i];
      if (s) {
        Sprites.itemIcon(c, s.id, 4, 4, 32);
        const it = ITEMS[s.id];
        count.textContent = (it.stack > 1 && s.count > 1) ? s.count : '';
        const rar = it.rarity || 'common';
        if (rar !== 'common') cell.classList.add('border-' + RARITY[rar].cls);
      } else count.textContent = '';
    }
  }
}
