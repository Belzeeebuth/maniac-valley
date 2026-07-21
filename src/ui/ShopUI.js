// ============================================================================
// ShopUI — boutique PNJ : onglet Acheter (graines, foin) et onglet Vendre
// (tout objet vendable du sac). Prix d'achat = 3x prix de vente.
// ============================================================================

import { ITEMS } from '../systems/Inventory.js';
import { Sprites } from '../graphics/SpriteSheetGenerator.js';

const BUYABLE = ['seed_wheat', 'seed_strawberry', 'seed_pumpkin', 'seed_tomato', 'seed_carrot', 'seed_corn', 'seed_blueberry', 'hay', 'fishingrod'];

export class ShopUI {
  constructor(game) {
    this.game = game;
    this.tabs = document.getElementById('shopTabs');
    this.grid = document.getElementById('shopGrid');
    this.tab = 'buy';
  }

  buyPrice(id) {
    if (id === 'fishingrod') return 150;
    return Math.max(2, (ITEMS[id].sell || 3) * 3);
  }

  render() {
    const g = this.game;
    this.tabs.innerHTML = '';
    for (const [id, label] of [['buy', 'Acheter'], ['sell', 'Vendre']]) {
      const b = document.createElement('div');
      b.className = 'tab-btn' + (this.tab === id ? ' active' : '');
      b.textContent = label;
      b.addEventListener('click', () => { this.tab = id; this.render(); g.sound.play('ui'); });
      this.tabs.appendChild(b);
    }

    this.grid.innerHTML = '';
    if (this.tab === 'buy') {
      for (const id of BUYABLE) this.grid.appendChild(this._buyCell(id));
    } else {
      const ids = g.inventory.sellableIds();
      if (!ids.length) {
        const p = document.createElement('div');
        p.className = 'shop-name'; p.style.gridColumn = '1/3'; p.textContent = 'Aucun objet vendable dans votre sac.';
        this.grid.appendChild(p);
      }
      for (const id of ids) this.grid.appendChild(this._sellCell(id));
    }
  }

  _cellBase(id) {
    const cell = document.createElement('div'); cell.className = 'shop-item';
    const cv = document.createElement('canvas'); cv.width = 36; cv.height = 36;
    Sprites.itemIcon(cv.getContext('2d'), id, 2, 2, 32);
    cell.appendChild(cv);
    return cell;
  }

  _buyCell(id) {
    const g = this.game, price = this.buyPrice(id);
    const cell = this._cellBase(id);
    const name = document.createElement('div'); name.className = 'shop-name'; name.textContent = ITEMS[id].name;
    const p = document.createElement('div'); p.className = 'shop-price'; p.textContent = price + ' or';
    const btn = document.createElement('button'); btn.textContent = 'Acheter';
    btn.addEventListener('click', () => {
      if (g.player.gold >= price) { g.player.gold -= price; g.inventory.add(id, 1); g.loot(id, 1); g.sound.play('buy'); g.hud.renderHotbar(); }
      else g.toast("Pas assez d'or.");
    });
    cell.append(name, p, btn);
    return cell;
  }

  _sellCell(id) {
    const g = this.game;
    const cell = this._cellBase(id);
    const name = document.createElement('div'); name.className = 'shop-name';
    name.textContent = `${ITEMS[id].name} (x${g.inventory.count(id)})`;
    const p = document.createElement('div'); p.className = 'shop-price'; p.textContent = ITEMS[id].sell + ' or/u';
    const btn = document.createElement('button'); btn.textContent = 'Vendre 1';
    btn.addEventListener('click', () => {
      g.inventory.remove(id, 1); g.player.gold += ITEMS[id].sell; g.sound.play('sell');
      this.render(); g.hud.renderHotbar();
    });
    cell.append(name, p, btn);
    return cell;
  }
}
