// ============================================================================
// FarmingSystem — outils (houe, arrosoir, hache, pioche), plantation des
// graines, récolte, et minage dans les mines. Gère les PV des arbres/rochers
// et leur repousse programmée.
// ============================================================================

import { TILE, OT, MT, TileMap } from '../world/TileMap.js';
import { CROPS, isReady } from '../entities/Crop.js';
import { ITEMS } from './Inventory.js';

export class FarmingSystem {
  constructor(game) { this.game = game; }

  spendStamina(cost) {
    const p = this.game.player;
    if (p.stamina >= cost) { p.stamina -= cost; }
    else { p.stamina = 0; p.hp -= 2; }
  }

  useTool(tool) {
    const g = this.game, p = g.player;
    const f = p.frontTile();

    if (tool === 'sword') { g.combat.swingSword(); return; }

    if (g.scene === 'overworld') {
      const ow = g.overworld;
      const t = ow.tilemap.get(f.gx, f.gy);
      if (tool === 'hoe') {
        if (t === OT.GRASS) {
          this.spendStamina(4);
          ow.tilemap.set(f.gx, f.gy, OT.FARMLAND);
          ow.farmland[f.gx + ',' + f.gy] = { tilled: true, watered: false, cropId: null, stage: 0 };
          g.sound.play('till');
        } else g.toast('Impossible de labourer ici.');
        return;
      }
      if (tool === 'water') {
        if (t === OT.FARMLAND) {
          this.spendStamina(2);
          ow.farmland[f.gx + ',' + f.gy].watered = true;
          g.sound.play('water');
          g.floatText(f.wx, f.wy, '💧', '#6cf');
        } else g.toast("Rien à arroser ici.");
        return;
      }
      if (tool === 'axe') {
        if (t === OT.TREE) {
          this.spendStamina(5);
          const key = f.gx + ',' + f.gy;
          ow.treeHp[key] = (ow.treeHp[key] ?? 3) - (1 + p.axeLevel);
          g.sound.play('chop');
          g.floatText(f.wx, f.wy - 10, '-' + (1 + p.axeLevel), '#8a6238');
          if (ow.treeHp[key] <= 0) {
            ow.tilemap.set(f.gx, f.gy, OT.GRASS);
            delete ow.treeHp[key];
            ow.treeTimers[key] = g.time.day + 2 + (Math.random() * 3 | 0);
            const n = 3 + (Math.random() * 4 | 0);
            g.inventory.add('wood', n); g.loot('wood', n);
          }
        } else g.toast("Il n'y a pas d'arbre ici.");
        return;
      }
      if (tool === 'pickaxe') {
        if (t === OT.ROCK) {
          this.spendStamina(6);
          const key = f.gx + ',' + f.gy;
          ow.rockHp[key] = (ow.rockHp[key] ?? 3) - (1 + p.pickLevel);
          g.sound.play('mine');
          g.floatText(f.wx, f.wy - 10, '-' + (1 + p.pickLevel), '#999');
          if (ow.rockHp[key] <= 0) {
            ow.tilemap.set(f.gx, f.gy, OT.GRASS);
            delete ow.rockHp[key];
            ow.rockTimers[key] = g.time.day + 3 + (Math.random() * 3 | 0);
            const n = 2 + (Math.random() * 3 | 0);
            g.inventory.add('stone', n); g.loot('stone', n);
            if (Math.random() < 0.3) { g.inventory.add('coal', 1); g.loot('coal', 1); }
          }
        } else g.toast("Rien à miner ici.");
        return;
      }
    } else {
      // Mine
      if (tool === 'pickaxe' || tool === 'axe') this.mineMineTile(f.gx, f.gy);
      else g.toast("Cet outil est inutile ici.");
    }
  }

  mineMineTile(gx, gy) {
    const g = this.game, p = g.player, m = g.mine;
    const t = m.tilemap.get(gx, gy);
    if (t !== MT.WALL && !TileMap.isOreMine(t)) { g.toast("Rien à miner ici."); return; }
    this.spendStamina(6);
    m.hp[gy][gx] -= (1 + p.pickLevel);
    g.sound.play('mine');
    const wx = gx * TILE + TILE / 2, wy = gy * TILE + TILE / 2;
    g.floatText(wx, wy - 10, '-' + (1 + p.pickLevel), '#999');
    if (m.hp[gy][gx] <= 0) {
      let drop;
      if (t === MT.ORE_COPPER) { drop = 'copper'; p.mined.copper++; }
      else if (t === MT.ORE_IRON) { drop = 'iron'; p.mined.iron++; }
      else if (t === MT.ORE_GOLD) { drop = 'gold_ore'; p.mined.gold_ore++; }
      else if (t === MT.ORE_DIAMOND) { drop = 'diamond'; p.mined.diamond++; }
      else drop = Math.random() < 0.25 ? 'coal' : 'stone';
      const n = drop === 'stone' ? (1 + (Math.random() * 3 | 0)) : 1;
      g.inventory.add(drop, n); g.loot(drop, n);
      g.quests.onMine(drop);
      m.tilemap.set(gx, gy, MT.FLOOR);
    }
  }

  plantSeed(seedId) {
    const g = this.game;
    if (g.scene !== 'overworld') { g.toast('On ne plante pas dans la mine.'); return false; }
    const f = g.player.frontTile();
    const plot = g.overworld.farmland[f.gx + ',' + f.gy];
    if (!plot || !plot.tilled) { g.toast("Labourez d'abord la terre."); return false; }
    if (plot.cropId) { g.toast('Cette parcelle est déjà plantée.'); return false; }
    const cropId = ITEMS[seedId].cropId;
    const season = g.time.seasonKey;
    if (!CROPS[cropId].seasons.includes(season)) {
      g.toast(`${CROPS[cropId].name} ne pousse pas en ${g.time.seasonName}.`);
      return false;
    }
    plot.cropId = cropId; plot.stage = 0; plot.watered = false;
    g.inventory.remove(seedId, 1);
    g.sound.play('till');
    g.floatText(f.wx, f.wy, '🌱', '#7d5');
    return true;
  }

  harvest(gx, gy) {
    const g = this.game;
    const plot = g.overworld.farmland[gx + ',' + gy];
    if (!isReady(plot)) return false;
    const id = 'crop_' + plot.cropId;
    g.inventory.add(id, 1); g.loot(id, 1);
    g.floatText(gx * TILE + TILE / 2, gy * TILE, '+' + CROPS[plot.cropId].name, '#9f9');
    g.sound.play('pickup');
    plot.cropId = null; plot.stage = 0; plot.watered = false;
    return true;
  }
}
