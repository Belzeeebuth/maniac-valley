// ============================================================================
// SceneManager — construction du monde extérieur, entrée/sortie des mines,
// scène courante et collisions. Extrait de Game.js.
// ============================================================================

import { TILE, OT, TileMap, makeGrid } from '../world/TileMap.js';
import { generateMine, MAX_FLOOR } from '../world/MineGenerator.js';
import { makeAnimal } from '../entities/Animal.js';
import { makeVillager, NAMES } from '../entities/Villager.js';
import { empowerEnemy } from '../entities/Enemy.js';

export const OW_W = 56, OW_H = 42;
const rand = (a, b) => Math.random() * (b - a) + a;
const ri = (a, b) => Math.floor(rand(a, b + 1));

export class SceneManager {
  constructor(game) { this.g = game; }

  buildOverworld() {
    const g = this.g;
    const grid = makeGrid(OW_W, OW_H, OT.GRASS);
    const set = (x, y, v) => { if (grid[y] && grid[y][x] !== undefined) grid[y][x] = v; };

    for (let x = 0; x < OW_W; x++) { grid[0][x] = OT.WATER; grid[OW_H - 1][x] = OT.WATER; }
    for (let y = 0; y < OW_H; y++) { grid[y][0] = OT.WATER; grid[y][OW_W - 1] = OT.WATER; }

    const riverX = 28;
    for (let y = 1; y < OW_H - 1; y++) { grid[y][riverX] = OT.WATER; if (Math.random() < 0.5) grid[y][riverX + 1] = OT.WATER; }
    for (let y = 18; y <= 20; y++) { grid[y][riverX] = OT.PATH; grid[y][riverX + 1] = OT.PATH; }
    for (let x = 2; x < OW_W - 2; x++) grid[20][x] = OT.PATH;
    for (let y = 2; y < OW_H - 2; y++) { grid[y][8] = OT.PATH; grid[y][40] = OT.PATH; }

    for (let i = 0; i < 220; i++) {
      const x = ri(2, OW_W - 3), y = ri(2, OW_H - 3);
      if (grid[y][x] === OT.GRASS) {
        const nearBorder = x < 6 || x > OW_W - 7 || y < 6 || y > OW_H - 7;
        const nearRiver = Math.abs(x - riverX) < 2;
        if (!nearRiver && ((nearBorder && Math.random() < 0.85) || (!nearBorder && Math.random() < 0.12))) grid[y][x] = OT.TREE;
      }
    }
    for (let i = 0; i < 60; i++) {
      const x = ri(2, OW_W - 3), y = ri(2, OW_H - 3);
      if (grid[y][x] === OT.GRASS && Math.random() < 0.4) grid[y][x] = OT.ROCK;
    }

    // Maison du joueur
    const buildings = [];
    const hx = 6, hy = 6, hw = 6, hh = 5;
    for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++)
      set(x, y, (x === hx || x === hx + hw - 1 || y === hy || y === hy + hh - 1) ? OT.WALL : OT.PATH);
    set(hx + 2, hy + hh - 1, OT.PATH); set(hx + 3, hy + hh - 1, OT.PATH);
    set(hx + 2, hy + 1, OT.BED);
    g.bedPos = { x: (hx + 2) * TILE + TILE / 2, y: (hy + 1) * TILE + TILE / 2 };
    buildings.push({ x: hx, y: hy, w: hw, h: hh, type: 'home', roof: '#8a3a34' });

    for (let y = hy + hh + 1; y < hy + hh + 9; y++) for (let x = hx - 2; x < hx + 12; x++)
      if (grid[y] && grid[y][x] !== undefined && grid[y][x] !== OT.WATER) grid[y][x] = OT.GRASS;

    // Enclos animaux
    const px = hx - 2, py = hy + hh + 2, pw = 9, ph = 6;
    for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++)
      set(x, y, (x === px || x === px + pw - 1 || y === py || y === py + ph - 1) ? OT.FENCE : OT.GRASS);
    set(px + 4, py + ph - 1, OT.GRASS); set(px + 5, py + ph - 1, OT.GRASS);
    const penBounds = { x1: (px + 1) * TILE, y1: (py + 1) * TILE, x2: (px + pw - 1) * TILE, y2: (py + ph - 1) * TILE };

    // Champ pré-labouré
    const farmland = {};
    for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) {
      const gx = hx + 7 + x, gy = hy + 1 + y;
      if (grid[gy] && grid[gy][gx] === OT.GRASS) {
        grid[gy][gx] = OT.FARMLAND;
        farmland[gx + ',' + gy] = { tilled: true, watered: false, cropId: null, stage: 0 };
      }
    }

    // Boutique & panneau de quêtes
    set(38, 10, OT.SHOPCOUNTER); set(39, 10, OT.SHOPCOUNTER);
    g.shopPos = { x: 38 * TILE + TILE, y: 10 * TILE + TILE / 2 };
    for (let x = 37; x <= 40; x++) for (let y = 8; y < 10; y++) set(x, y, OT.PATH);
    set(38, 16, OT.QUESTBOARD);
    g.boardPos = { x: 38 * TILE + TILE / 2, y: 16 * TILE + TILE / 2 };

    const deco = (bx, by, bw, bh, roof) => {
      for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++)
        set(x, y, (x === bx || x === bx + bw - 1 || y === by || y === by + bh - 1) ? OT.WALL : OT.PATH);
      const b = { x: bx, y: by, w: bw, h: bh, type: 'deco', roof: roof || '#8a3a34' };
      buildings.push(b);
      return b;
    };

    // Habitants (foyers) — noms stables pour l'amitié sauvegardée.
    const villagers = [];
    const AD = [
      { skin: '#e8b98a', hair: '#3a2a18', shirt: '#3f78c4' },
      { skin: '#c98a5a', hair: '#5a3a20', shirt: '#c0392b' },
      { skin: '#f0cba0', hair: '#e8c860', shirt: '#3a8a3a' },
      { skin: '#8a5a3a', hair: '#2a2018', shirt: '#8a4aa8' },
      { skin: '#e8b98a', hair: '#b03020', shirt: '#d98c33' },
      { skin: '#d8a878', hair: '#3a2a18', shirt: '#2aa0a0' },
    ];
    const ELDER = { skin: '#e8c8a8', hair: '#c8c8c8', shirt: '#6a6a7a' };
    const CHILD = [
      { skin: '#f0cba0', hair: '#5a3a20', shirt: '#e0a030' },
      { skin: '#e8b98a', hair: '#2a2018', shirt: '#e05a8a' },
    ];
    let adIdx = 0, nameIdx = 0;
    const spawnFoyer = (b, comp) => {
      const bounds = {
        x1: Math.max(2, b.x - 1) * TILE, y1: (b.y + b.h) * TILE,
        x2: Math.min(OW_W - 2, b.x + b.w + 1) * TILE, y2: Math.min(OW_H - 2, b.y + b.h + 3) * TILE,
      };
      const cx = (b.x + b.w / 2) * TILE, cy = (b.y + b.h + 1) * TILE;
      for (const who of comp) {
        const look = who === 'child' ? CHILD[adIdx % CHILD.length] : who === 'elder' ? ELDER : AD[adIdx % AD.length];
        if (who !== 'child') adIdx++;
        const name = NAMES[nameIdx % NAMES.length]; nameIdx++;
        villagers.push(makeVillager(who, cx + rand(-18, 18), cy + rand(-4, 14), bounds, look, name));
      }
    };

    const h1 = deco(44, 8, 5, 4, '#8a3a34');
    const h2 = deco(44, 16, 5, 4, '#3a6a8a');
    const h3 = deco(34, 26, 5, 4, '#6a8a3a');
    const h4 = deco(33, 10, 5, 4, '#8a6a3a');
    const h5 = deco(44, 24, 5, 4, '#7a3a7a');
    const h6 = deco(31, 18, 5, 4, '#8a5a34');
    spawnFoyer(h1, ['adult', 'adult']);
    spawnFoyer(h2, ['adult', 'adult', 'child']);
    spawnFoyer(h3, ['adult']);
    spawnFoyer(h4, ['elder']);
    spawnFoyer(h5, ['adult', 'adult']);
    spawnFoyer(h6, ['adult', 'adult', 'child']);

    // Entrée de mine
    const mx = 42, my = 32;
    for (let y = my - 2; y <= my + 2; y++) for (let x = mx - 3; x <= mx + 3; x++)
      if (grid[y] && grid[y][x] === OT.GRASS && Math.random() < 0.7) grid[y][x] = OT.ROCK;
    for (let y = my; y < my + 3; y++) set(mx, y, OT.PATH);
    set(mx, my, OT.MINE_ENTRANCE);
    g.minePos = { x: mx * TILE + TILE / 2, y: (my + 1) * TILE + TILE / 2 };

    const animals = [];
    for (let i = 0; i < 3; i++) animals.push(makeAnimal('chicken', rand(penBounds.x1 + 10, penBounds.x2 - 10), rand(penBounds.y1 + 10, penBounds.y2 - 10)));
    for (let i = 0; i < 2; i++) animals.push(makeAnimal('cow', rand(penBounds.x1 + 10, penBounds.x2 - 10), rand(penBounds.y1 + 10, penBounds.y2 - 10)));

    return {
      tilemap: new TileMap(grid, 'overworld'), w: OW_W, h: OW_H,
      farmland, animals, penBounds, placed: [], ground: [], buildings, villagers,
      treeHp: {}, rockHp: {}, treeTimers: {}, rockTimers: {},
    };
  }

  curScene() { return this.g.scene === 'overworld' ? this.g.overworld : this.g.mine; }

  blocked(px, py, w, h) {
    const s = this.curScene();
    if (s.tilemap.boxHitsSolid(px, py, w, h)) return true;
    for (const o of s.placed) {
      if (o.type === 'torch' || o.type === 'fence') continue;
      if (px < o.gx * TILE + TILE - 2 && px + w > o.gx * TILE + 2 &&
          py < o.gy * TILE + TILE - 2 && py + h > o.gy * TILE + 2) return true;
    }
    return false;
  }

  enterMine(level) {
    const g = this.g;
    level = Math.min(Math.max(level, 1), MAX_FLOOR);
    g.mine = generateMine(level);
    if (g.time.isEclipse) for (const e of g.mine.enemies) empowerEnemy(e);
    g.scene = 'mine';
    g.fishing.cancel();
    const ex = g.mine.entrance.x * TILE + TILE / 2, ey = (g.mine.entrance.y + 1) * TILE;
    g.player.x = ex - g.player.w / 2; g.player.y = ey;
    g.camera.snap(g.player, g.mine.w, g.mine.h, g.canvas.width, g.canvas.height);
    g.sound.play('stairs');
    g.toast(`Mine — Étage ${level} · Biome ${{ rock: 'Roche', ice: 'Glace', lava: 'Lave' }[g.mine.biome]}`);
    if (g.mine.isBoss) setTimeout(() => { if (g.mine && g.mine.boss) { g.toast('⚠ Un boss garde ce niveau !'); g.sound.play('boss_roar'); g.camera.shake(9, 0.6); } }, 400);
  }

  exitMine() {
    const g = this.g;
    g.scene = 'overworld';
    g.player.x = g.minePos.x - g.player.w / 2; g.player.y = g.minePos.y + TILE;
    g.camera.snap(g.player, g.overworld.w, g.overworld.h, g.canvas.width, g.canvas.height);
    g.sound.play('stairs');
    g.toast('Retour à la surface.');
  }
}
