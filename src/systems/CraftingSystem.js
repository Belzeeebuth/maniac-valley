// ============================================================================
// CraftingSystem — recettes de construction, de forge (fourneau requis),
// de cuisine et d'amélioration d'outils (coût dynamique par palier).
// ============================================================================

import { TILE } from '../world/TileMap.js';
import { ITEMS } from './Inventory.js';

export const RECIPES = [
  { id: 'fence',     name: 'Clôture en bois',    cat: 'build', cost: { wood: 5 },              result: 'fence_item',     qty: 1 },
  { id: 'chest',     name: 'Coffre de stockage', cat: 'build', cost: { wood: 15 },             result: 'chest_item',     qty: 1 },
  { id: 'furnace',   name: 'Fourneau',           cat: 'build', cost: { stone: 25, copper: 3 }, result: 'furnace_item',   qty: 1 },
  { id: 'scarecrow', name: 'Épouvantail',        cat: 'build', cost: { wood: 20, stone: 5 },   result: 'scarecrow_item', qty: 1 },
  { id: 'torch',     name: 'Torches (x3)',       cat: 'build', cost: { wood: 2, coal: 1 },     result: 'torch_item',     qty: 3 },
  { id: 'fishingrod', name: 'Canne à pêche',     cat: 'build', cost: { wood: 8, copper: 2 },   result: 'fishingrod',     qty: 1 },
  { id: 'bridge',     name: 'Passerelles (x2)',  cat: 'build', cost: { wood: 4 },              result: 'bridge_item',    qty: 2 },

  { id: 'bar_copper', name: 'Lingot de Cuivre', cat: 'forge', cost: { copper: 3, coal: 1 },   result: 'bar_copper', qty: 1, needFurnace: true },
  { id: 'bar_iron',   name: 'Lingot de Fer',    cat: 'forge', cost: { iron: 3, coal: 2 },     result: 'bar_iron',   qty: 1, needFurnace: true },
  { id: 'bar_gold',   name: "Lingot d'Or",      cat: 'forge', cost: { gold_ore: 3, coal: 3 }, result: 'bar_gold',   qty: 1, needFurnace: true },

  { id: 'cooked_meal', name: 'Ragoût Maniaque', cat: 'cook', cost: { crop_pumpkin: 1, milk: 1, egg: 1 }, result: 'cooked_meal', qty: 1 },

  { id: 'sword_upgrade',   name: "Améliorer l'Épée",   cat: 'upgrade', dyn: 'sword',   result: 'sword_upgrade',   qty: 1 },
  { id: 'pickaxe_upgrade', name: 'Améliorer la Pioche', cat: 'upgrade', dyn: 'pickaxe', result: 'pickaxe_upgrade', qty: 1 },
  { id: 'axe_upgrade',     name: 'Améliorer la Hache',  cat: 'upgrade', dyn: 'axe',     result: 'axe_upgrade',     qty: 1 },
];

export const UPGRADE_TIERS = [
  { mat: 'bar_copper', qty: 2 },
  { mat: 'bar_iron', qty: 2 },
  { mat: 'bar_gold', qty: 2 },
  { mat: 'diamond', qty: 3 },
];

export const CRAFT_CATS = [['build', 'Construire'], ['forge', 'Forger'], ['cook', 'Cuisiner'], ['upgrade', 'Améliorer']];

export class CraftingSystem {
  constructor(game) { this.game = game; }

  toolLevel(which) {
    const p = this.game.player;
    return which === 'sword' ? p.swordLevel : which === 'pickaxe' ? p.pickLevel : p.axeLevel;
  }

  // Retourne { cost, maxed, tierLabel } pour une recette (gère le coût dynamique).
  resolveCost(r) {
    if (!r.dyn) return { cost: r.cost, maxed: false, tierLabel: '' };
    const lvl = this.toolLevel(r.dyn);
    if (lvl >= UPGRADE_TIERS.length) return { cost: null, maxed: true, tierLabel: 'NIVEAU MAX' };
    const tier = UPGRADE_TIERS[lvl];
    return { cost: { [tier.mat]: tier.qty }, maxed: false, tierLabel: 'Niveau ' + (lvl + 1) };
  }

  nearFurnace() {
    const g = this.game, s = g.curScene();
    return s.placed.some(o => o.type === 'furnace' &&
      Math.hypot(g.player.cx - (o.gx * TILE + TILE / 2), g.player.cy - (o.gy * TILE + TILE / 2)) < TILE * 2.5);
  }

  canCraft(r) {
    const { cost, maxed } = this.resolveCost(r);
    if (maxed || !cost) return false;
    if (!this.game.inventory.has(cost)) return false;
    if (r.needFurnace && !this.nearFurnace()) return false;
    return true;
  }

  craft(r) {
    if (!this.canCraft(r)) return false;
    const g = this.game;
    const { cost } = this.resolveCost(r);
    g.inventory.consume(cost);
    if (r.dyn) {
      const p = g.player;
      if (r.dyn === 'sword') p.swordLevel++;
      else if (r.dyn === 'pickaxe') p.pickLevel++;
      else p.axeLevel++;
      g.sound.play('levelup');
      g.toast(`${r.name} → Niveau ${this.toolLevel(r.dyn)}`);
    } else {
      g.inventory.add(r.result, r.qty);
      g.loot(r.result, r.qty);
      g.sound.play('craft');
      g.toast(`${r.name} fabriqué !`);
    }
    g.player.crafted[r.id] = (g.player.crafted[r.id] || 0) + 1;
    g.quests.onCraft(r.id);
    return true;
  }
}
