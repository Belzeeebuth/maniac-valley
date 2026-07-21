// ============================================================================
// Tooltip — infobulle au survol d'un objet : nom coloré par rareté, type,
// statistiques et description.
// ============================================================================

import { ITEMS, RARITY, itemStats } from '../systems/Inventory.js';

export class Tooltip {
  constructor() {
    this.el = document.getElementById('tooltip');
  }

  show(id, clientX, clientY) {
    const it = ITEMS[id];
    if (!it) return;
    const rar = RARITY[it.rarity || 'common'];
    const typeLabel = {
      tool: 'Outil', material: 'Matériau', ore: 'Minerai', seed: 'Graine',
      crop: 'Récolte', product: 'Produit', food: 'Nourriture',
      placeable: 'Construction', upgrade_token: 'Amélioration',
    }[it.type] || 'Objet';
    const stats = itemStats(id).map(s => `<div class="tt-stat">${s}</div>`).join('');
    this.el.innerHTML =
      `<div class="tt-name rarity-${rar.cls}">${it.name}</div>` +
      `<div class="tt-type">${typeLabel} · <span class="rarity-${rar.cls}">${rar.label}</span></div>` +
      stats +
      (it.desc ? `<div class="tt-desc">${it.desc}</div>` : '');
    this.el.style.display = 'block';
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    let x = clientX + 16, y = clientY + 16;
    if (x + w > window.innerWidth) x = clientX - w - 16;
    if (y + h > window.innerHeight) y = clientY - h - 16;
    this.el.style.left = Math.max(4, x) + 'px';
    this.el.style.top = Math.max(4, y) + 'px';
  }

  hide() { this.el.style.display = 'none'; }
}
