// ============================================================================
// Inventory — base de données des objets (avec rareté) + gestion de la Hotbar
// (10 slots) et du sac à dos (32 slots), stacks et transferts.
// ============================================================================

import { CROPS } from '../entities/Crop.js';

// Raretés : common / rare / epic / maniac
export const RARITY = {
  common: { label: 'Commun', cls: 'common' },
  rare: { label: 'Rare', cls: 'rare' },
  epic: { label: 'Épique', cls: 'epic' },
  maniac: { label: 'Maniaque', cls: 'maniac' },
};

export const ITEMS = {
  // Outils
  hoe:         { name: 'Houe',     type: 'tool', tool: 'hoe',   stack: 1, rarity: 'common', desc: 'Laboure la terre.' },
  wateringcan: { name: 'Arrosoir', type: 'tool', tool: 'water', stack: 1, rarity: 'common', desc: 'Arrose les cultures.' },
  axe:         { name: 'Hache',    type: 'tool', tool: 'axe',   stack: 1, rarity: 'common', desc: 'Coupe les arbres.' },
  pickaxe:     { name: 'Pioche',   type: 'tool', tool: 'pickaxe', stack: 1, rarity: 'common', desc: 'Casse rochers et minerais.' },
  sword:       { name: 'Épée',     type: 'tool', tool: 'sword', stack: 1, rarity: 'common', desc: 'Arme de mêlée.' },
  fishingrod:  { name: 'Canne à pêche', type: 'tool', tool: 'fish', stack: 1, rarity: 'rare', desc: 'Lancez près de l\'eau et visez juste !' },

  // Matériaux & minerais
  wood:      { name: 'Bois',            type: 'material', stack: 99, sell: 2,  rarity: 'common' },
  stone:     { name: 'Pierre',          type: 'material', stack: 99, sell: 2,  rarity: 'common' },
  coal:      { name: 'Charbon',         type: 'material', stack: 99, sell: 5,  rarity: 'common' },
  copper:    { name: 'Cuivre',          type: 'ore', stack: 99, sell: 8,  rarity: 'common' },
  iron:      { name: 'Fer',             type: 'ore', stack: 99, sell: 14, rarity: 'rare' },
  gold_ore:  { name: 'Or brut',         type: 'ore', stack: 99, sell: 26, rarity: 'rare' },
  diamond:   { name: 'Diamant',         type: 'ore', stack: 99, sell: 80, rarity: 'epic' },
  bar_copper:{ name: 'Lingot de Cuivre',type: 'material', stack: 99, sell: 20, rarity: 'common' },
  bar_iron:  { name: 'Lingot de Fer',   type: 'material', stack: 99, sell: 36, rarity: 'rare' },
  bar_gold:  { name: "Lingot d'Or",     type: 'material', stack: 99, sell: 70, rarity: 'epic' },

  // Graines
  seed_wheat:      { name: 'Graine de Blé',        type: 'seed', cropId: 'wheat',      stack: 99, sell: 4,  rarity: 'common' },
  seed_strawberry: { name: 'Graine de Fraise',     type: 'seed', cropId: 'strawberry', stack: 99, sell: 7,  rarity: 'common' },
  seed_pumpkin:    { name: 'Graine de Citrouille', type: 'seed', cropId: 'pumpkin',    stack: 99, sell: 10, rarity: 'rare' },
  seed_tomato:     { name: 'Graine de Tomate',     type: 'seed', cropId: 'tomato',     stack: 99, sell: 6,  rarity: 'common' },
  seed_carrot:     { name: 'Graine de Carotte',    type: 'seed', cropId: 'carrot',     stack: 99, sell: 3,  rarity: 'common' },
  seed_corn:       { name: 'Graine de Maïs',       type: 'seed', cropId: 'corn',       stack: 99, sell: 9,  rarity: 'rare' },
  seed_blueberry:  { name: 'Graine de Myrtille',   type: 'seed', cropId: 'blueberry',  stack: 99, sell: 8,  rarity: 'rare' },

  // Récoltes (comestibles)
  crop_wheat:      { name: 'Blé',        type: 'crop', cropId: 'wheat',      stack: 99, sell: CROPS.wheat.sell,      rarity: 'common', food: CROPS.wheat.food },
  crop_strawberry: { name: 'Fraise',     type: 'crop', cropId: 'strawberry', stack: 99, sell: CROPS.strawberry.sell, rarity: 'rare',   food: CROPS.strawberry.food },
  crop_pumpkin:    { name: 'Citrouille', type: 'crop', cropId: 'pumpkin',    stack: 99, sell: CROPS.pumpkin.sell,    rarity: 'epic',   food: CROPS.pumpkin.food },
  crop_tomato:     { name: 'Tomate',     type: 'crop', cropId: 'tomato',     stack: 99, sell: CROPS.tomato.sell,     rarity: 'common', food: CROPS.tomato.food },
  crop_carrot:     { name: 'Carotte',    type: 'crop', cropId: 'carrot',     stack: 99, sell: CROPS.carrot.sell,     rarity: 'common', food: CROPS.carrot.food },
  crop_corn:       { name: 'Maïs',       type: 'crop', cropId: 'corn',       stack: 99, sell: CROPS.corn.sell,       rarity: 'rare',   food: CROPS.corn.food },
  crop_blueberry:  { name: 'Myrtille',   type: 'crop', cropId: 'blueberry',  stack: 99, sell: CROPS.blueberry.sell,  rarity: 'rare',   food: CROPS.blueberry.food },

  // Poissons (pêche)
  fish_perch: { name: 'Perche',       type: 'fish', stack: 99, sell: 18, rarity: 'common', food: { hunger: 16, hp: 4, stam: 8 } },
  fish_carp:  { name: 'Carpe',        type: 'fish', stack: 99, sell: 14, rarity: 'common', food: { hunger: 14, hp: 3, stam: 6 } },
  fish_trout: { name: 'Truite',       type: 'fish', stack: 99, sell: 32, rarity: 'rare',   food: { hunger: 22, hp: 8, stam: 12 } },
  fish_king:  { name: 'Poisson Roi',  type: 'fish', stack: 99, sell: 120, rarity: 'maniac', food: { hunger: 40, hp: 25, stam: 30 }, desc: 'La légende du lac maniaque.' },

  // Produits animaux
  egg:  { name: 'Œuf',  type: 'product', stack: 99, sell: 10, rarity: 'common', food: { hunger: 10, hp: 2, stam: 5 } },
  milk: { name: 'Lait', type: 'product', stack: 99, sell: 15, rarity: 'rare',   food: { hunger: 14, hp: 3, stam: 8 } },
  hay:  { name: 'Foin', type: 'material', stack: 99, sell: 3, rarity: 'common', desc: 'Pour nourrir les animaux.' },

  // Plat cuisiné
  cooked_meal: { name: 'Ragoût Maniaque', type: 'food', stack: 20, sell: 50, rarity: 'epic', food: { hunger: 50, hp: 30, stam: 40 }, desc: 'Restaure tout, ou presque.' },

  // Constructions
  fence_item:     { name: 'Clôture',     type: 'placeable', placeType: 'fence',     stack: 99, rarity: 'common' },
  chest_item:     { name: 'Coffre',      type: 'placeable', placeType: 'chest',     stack: 99, rarity: 'common' },
  furnace_item:   { name: 'Fourneau',    type: 'placeable', placeType: 'furnace',   stack: 99, rarity: 'rare' },
  scarecrow_item: { name: 'Épouvantail', type: 'placeable', placeType: 'scarecrow', stack: 99, rarity: 'common' },
  torch_item:     { name: 'Torche',      type: 'placeable', placeType: 'torch',     stack: 99, rarity: 'common' },

  // Améliorations (résultat de craft "upgrade")
  sword_upgrade:   { name: "Amélioration d'Épée",   type: 'upgrade_token', upgrade: 'sword',   stack: 99, rarity: 'maniac' },
  pickaxe_upgrade: { name: 'Amélioration de Pioche', type: 'upgrade_token', upgrade: 'pickaxe', stack: 99, rarity: 'maniac' },
  axe_upgrade:     { name: 'Amélioration de Hache',  type: 'upgrade_token', upgrade: 'axe',     stack: 99, rarity: 'maniac' },
};

export function itemStats(id) {
  const it = ITEMS[id];
  if (!it) return [];
  const s = [];
  if (it.food) {
    if (it.food.hunger) s.push(`+${it.food.hunger} Faim`);
    if (it.food.hp) s.push(`+${it.food.hp} PV`);
    if (it.food.stam) s.push(`+${it.food.stam} Énergie`);
  }
  if (it.type === 'seed') s.push('Se plante sur terre labourée');
  if (it.type === 'placeable') s.push('Objet plaçable');
  if (typeof it.sell === 'number') s.push(`Vente : ${it.sell} or`);
  return s;
}

export class Inventory {
  constructor() {
    this.hotbar = new Array(10).fill(null);
    this.backpack = new Array(32).fill(null);
    this.selected = 0;
  }

  get selectedItem() { return this.hotbar[this.selected]; }

  _addToArray(arr, id, qty, max) {
    for (let i = 0; i < arr.length && qty > 0; i++) {
      const s = arr[i];
      if (s && s.id === id && s.count < max) {
        const add = Math.min(max - s.count, qty);
        s.count += add; qty -= add;
      }
    }
    for (let i = 0; i < arr.length && qty > 0; i++) {
      if (!arr[i]) { const add = Math.min(max, qty); arr[i] = { id, count: add }; qty -= add; }
    }
    return qty;
  }

  add(id, qty = 1) {
    const max = ITEMS[id].stack || 99;
    qty = this._addToArray(this.hotbar, id, qty, max);
    qty = this._addToArray(this.backpack, id, qty, max);
    return qty <= 0;
  }

  count(id) {
    let n = 0;
    for (const s of this.hotbar) if (s && s.id === id) n += s.count;
    for (const s of this.backpack) if (s && s.id === id) n += s.count;
    return n;
  }

  remove(id, qty) {
    let need = qty;
    const eat = (arr) => {
      for (let i = 0; i < arr.length && need > 0; i++) {
        const s = arr[i];
        if (s && s.id === id) {
          const take = Math.min(s.count, need); s.count -= take; need -= take;
          if (s.count <= 0) arr[i] = null;
        }
      }
    };
    eat(this.hotbar); eat(this.backpack);
    return need <= 0;
  }

  has(cost) { for (const k in cost) if (this.count(k) < cost[k]) return false; return true; }
  consume(cost) { for (const k in cost) this.remove(k, cost[k]); }

  swap(hotbarIndex, backpackIndex) {
    const t = this.hotbar[hotbarIndex];
    this.hotbar[hotbarIndex] = this.backpack[backpackIndex];
    this.backpack[backpackIndex] = t;
  }

  sellableIds() {
    const set = new Set();
    for (const s of this.hotbar) if (s && ITEMS[s.id].sell) set.add(s.id);
    for (const s of this.backpack) if (s && ITEMS[s.id].sell) set.add(s.id);
    return [...set];
  }
}
