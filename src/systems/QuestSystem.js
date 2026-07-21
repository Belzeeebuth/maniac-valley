// ============================================================================
// QuestSystem — 3 quêtes actives tirées d'un pool (livraison, chasse, craft,
// minage), suivi de progression, validation et récompense en or.
// ============================================================================

const POOL = [
  { id: 'deliver_strawberry', text: 'Livrer 5 Fraises',      type: 'deliver', item: 'crop_strawberry', qty: 5, gold: 80 },
  { id: 'deliver_wheat',      text: 'Livrer 8 Blé',          type: 'deliver', item: 'crop_wheat',      qty: 8, gold: 70 },
  { id: 'deliver_pumpkin',    text: 'Livrer 3 Citrouilles',  type: 'deliver', item: 'crop_pumpkin',    qty: 3, gold: 90 },
  { id: 'deliver_tomato',     text: 'Livrer 5 Tomates',      type: 'deliver', item: 'crop_tomato',     qty: 5, gold: 75 },
  { id: 'deliver_egg',        text: 'Livrer 4 Œufs',         type: 'deliver', item: 'egg',             qty: 4, gold: 60 },
  { id: 'deliver_milk',       text: 'Livrer 3 Lait',         type: 'deliver', item: 'milk',            qty: 3, gold: 65 },
  { id: 'kill_slime',         text: 'Tuer 8 Slimes',         type: 'kill',    enemy: 'slime',    qty: 8, gold: 100 },
  { id: 'kill_skeleton',      text: 'Tuer 5 Squelettes',     type: 'kill',    enemy: 'skeleton', qty: 5, gold: 120 },
  { id: 'kill_bat',           text: 'Tuer 6 Chauves-souris', type: 'kill',    enemy: 'bat',      qty: 6, gold: 110 },
  { id: 'craft_fence',        text: 'Fabriquer 3 Clôtures',  type: 'craft',   recipe: 'fence',   qty: 3, gold: 50 },
  { id: 'craft_torch',        text: 'Fabriquer 5 Torches',   type: 'craft',   recipe: 'torch',   qty: 5, gold: 55 },
  { id: 'mine_copper',        text: 'Miner 5 Cuivre',        type: 'mine',    ore: 'copper',     qty: 5, gold: 60 },
  { id: 'mine_iron',          text: 'Miner 4 Fer',           type: 'mine',    ore: 'iron',       qty: 4, gold: 85 },
  { id: 'mine_gold',          text: 'Miner 2 Or brut',       type: 'mine',    ore: 'gold_ore',   qty: 2, gold: 130 },
  { id: 'mine_diamond',       text: 'Miner 1 Diamant',       type: 'mine',    ore: 'diamond',    qty: 1, gold: 200 },
];

const ORE_TO_MINEKEY = { copper: 'copper', iron: 'iron', gold_ore: 'gold_ore', diamond: 'diamond' };

export class QuestSystem {
  constructor(game) { this.game = game; this.quests = []; }

  _instance(def) {
    const p = this.game.player;
    return {
      ...def, progress: 0, done: false,
      startKill: def.type === 'kill' ? (p.kills[def.enemy] || 0) : 0,
      startMine: def.type === 'mine' ? (p.mined[ORE_TO_MINEKEY[def.ore]] || 0) : 0,
      startCraft: def.type === 'craft' ? (p.crafted[def.recipe] || 0) : 0,
    };
  }

  generate() {
    const pool = POOL.slice();
    this.quests = [];
    while (this.quests.length < 3 && pool.length) {
      this.quests.push(this._instance(pool.splice(Math.random() * pool.length | 0, 1)[0]));
    }
  }

  replace(oldId) {
    const active = new Set(this.quests.map(q => q.id));
    const avail = POOL.filter(q => !active.has(q.id));
    const idx = this.quests.findIndex(q => q.id === oldId);
    if (idx < 0) return;
    if (!avail.length) { this.quests.splice(idx, 1); return; }
    this.quests[idx] = this._instance(avail[Math.random() * avail.length | 0]);
  }

  onKill(kind) {
    const p = this.game.player;
    for (const q of this.quests) if (q.type === 'kill' && q.enemy === kind) q.progress = (p.kills[kind] || 0) - q.startKill;
  }
  onMine(ore) {
    const p = this.game.player, key = ORE_TO_MINEKEY[ore];
    if (!key) return;
    for (const q of this.quests) if (q.type === 'mine' && q.ore === ore) q.progress = (p.mined[key] || 0) - q.startMine;
  }
  onCraft(recipeId) {
    const p = this.game.player;
    for (const q of this.quests) if (q.type === 'craft' && q.recipe === recipeId) q.progress = (p.crafted[recipeId] || 0) - q.startCraft;
  }

  // Progression affichée (les livraisons se basent sur l'inventaire courant).
  progressOf(q) {
    if (q.type === 'deliver') return Math.min(q.qty, this.game.inventory.count(q.item));
    return Math.min(q.qty, q.progress);
  }
  isComplete(q) { return this.progressOf(q) >= q.qty; }

  turnIn(q) {
    if (!this.isComplete(q)) return false;
    const g = this.game;
    if (q.type === 'deliver') g.inventory.remove(q.item, q.qty);
    g.player.gold += q.gold;
    g.sound.play('questdone');
    g.toast(`Quête terminée : +${q.gold} or !`);
    this.replace(q.id);
    return true;
  }
}
