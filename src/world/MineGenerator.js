// ============================================================================
// MineGenerator — génère procéduralement un étage de mine (15 au total).
// Creusage par marche aléatoire (connectivité garantie), veines de minerai
// selon la profondeur, escalier placé au point le plus éloigné (BFS), et
// ennemis/boss. Étages 5 et 10 : boss avec escalier scellé.
// ============================================================================

import { TILE, MT, TileMap, makeGrid } from './TileMap.js';
import { makeEnemy } from '../entities/Enemy.js';
import { makeGigaSlime, makeMoleKing } from '../entities/Boss.js';

export const MINE_W = 26, MINE_H = 20;
export const MAX_FLOOR = 15;

let uid = 100000;
const nid = () => uid++;

function choice(a) { return a[Math.floor(Math.random() * a.length)]; }
function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function generateMine(level) {
  level = clamp(level, 1, MAX_FLOOR);
  const grid = makeGrid(MINE_W, MINE_H, MT.WALL);
  const hp = makeGrid(MINE_W, MINE_H, 0);
  const entrance = { x: 2, y: Math.floor(MINE_H / 2) };
  grid[entrance.y][entrance.x] = MT.FLOOR;

  const carved = new Set();
  const carve = (sx, sy, steps) => {
    let x = sx, y = sy;
    for (let i = 0; i < steps; i++) {
      grid[y][x] = MT.FLOOR; carved.add(x + ',' + y);
      const d = ri(0, 3);
      if (d === 0) x += 1; else if (d === 1) x -= 1; else if (d === 2) y += 1; else y -= 1;
      x = clamp(x, 1, MINE_W - 2); y = clamp(y, 1, MINE_H - 2);
    }
  };
  carve(entrance.x, entrance.y, 900);
  for (let i = 0; i < 6; i++) carve(ri(3, MINE_W - 4), ri(3, MINE_H - 4), 260);

  // BFS depuis l'entrée → tuile la plus éloignée pour l'escalier
  const dist = makeGrid(MINE_W, MINE_H, -1);
  dist[entrance.y][entrance.x] = 0;
  const q = [[entrance.x, entrance.y]];
  let far = { x: entrance.x, y: entrance.y, d: 0 };
  while (q.length) {
    const [x, y] = q.shift();
    const d = dist[y][x];
    if (d > far.d) far = { x, y, d };
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= MINE_W || ny >= MINE_H) continue;
      if (grid[ny][nx] !== MT.FLOOR || dist[ny][nx] !== -1) continue;
      dist[ny][nx] = d + 1; q.push([nx, ny]);
    }
  }

  const isBoss = (level === 5 || level === 10);
  grid[far.y][far.x] = isBoss ? MT.STAIRS_SEALED : MT.STAIRS;
  grid[entrance.y][entrance.x] = MT.ENTRANCE;

  // Veines de minerai sur les murs bordant un sol
  const depthF = level / MAX_FLOOR;
  for (let y = 1; y < MINE_H - 1; y++) {
    for (let x = 1; x < MINE_W - 1; x++) {
      if (grid[y][x] !== MT.WALL) continue;
      hp[y][x] = 3;
      const adj = grid[y][x + 1] === MT.FLOOR || grid[y][x - 1] === MT.FLOOR ||
                  grid[y + 1][x] === MT.FLOOR || grid[y - 1][x] === MT.FLOOR;
      if (!adj) continue;
      const r = Math.random();
      if (r < 0.04 + depthF * 0.12 && level >= 6) grid[y][x] = MT.ORE_DIAMOND;
      else if (r < 0.10 + depthF * 0.16 && level >= 4) grid[y][x] = MT.ORE_GOLD;
      else if (r < 0.20 + depthF * 0.16 && level >= 2) grid[y][x] = MT.ORE_IRON;
      else if (r < 0.34) grid[y][x] = MT.ORE_COPPER;
      if (grid[y][x] !== MT.WALL) hp[y][x] = 4;
    }
  }

  // Ennemis
  const enemies = [];
  const floors = [...carved].map(s => { const [x, y] = s.split(',').map(Number); return { x, y }; })
    .filter(t => dist[t.y][t.x] > 6);
  const count = 4 + level;
  for (let i = 0; i < count && floors.length; i++) {
    const t = choice(floors);
    const kinds = level <= 2 ? ['slime']
      : level <= 5 ? ['slime', 'slime', 'skeleton']
      : level <= 10 ? ['slime', 'skeleton', 'skeleton', 'bat']
      : ['skeleton', 'bat', 'bat', 'slime'];
    enemies.push(makeEnemy(choice(kinds), t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, level));
  }

  let boss = null;
  if (isBoss) {
    const bx = far.x * TILE + TILE / 2, by = far.y * TILE + TILE / 2;
    boss = level === 5 ? makeGigaSlime(bx, by) : makeMoleKing(bx, by);
  }

  return {
    level, tilemap: new TileMap(grid, 'mine'), hp,
    w: MINE_W, h: MINE_H, entrance, stairsPos: far,
    isBoss, stairsUnlocked: !isBoss,
    enemies, boss, placed: [], ground: [], id: nid(),
  };
}
