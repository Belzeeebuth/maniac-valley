// ============================================================================
// MineGenerator — génère procéduralement un étage de mine (15 au total).
// Creusage par marche aléatoire (connectivité garantie), veines de minerai
// selon la profondeur, escalier placé au point le plus éloigné (BFS), et
// ennemis/boss. Étages 5 et 10 : boss avec escalier scellé.
// ============================================================================

import { TILE, MT, TileMap, makeGrid } from './TileMap.js';
// (biomeFor / BIOMES définis plus bas, exportés pour le rendu et Game)
import { makeEnemy } from '../entities/Enemy.js';
import { makeGigaSlime, makeMoleKing } from '../entities/Boss.js';

export const MINE_W = 26, MINE_H = 20;
export const MAX_FLOOR = 15;

// Biomes par profondeur : palettes et dangers distincts.
export const BIOMES = {
  rock: { name: 'Roche',  floorA: '#43392f', floorB: '#3d342b', wallEdge: '#211b16', wallFace: '#4a4038', wallHi: '#5a4d3f', grade: [{ op: 'multiply', color: '#28324a', alpha: 0.34 }, { op: 'soft-light', color: '#1e3e50', alpha: 0.40 }] },
  ice:  { name: 'Glace',  floorA: '#3a4a5c', floorB: '#344254', wallEdge: '#1a2430', wallFace: '#4c6478', wallHi: '#6c8ca4', grade: [{ op: 'multiply', color: '#2a3a5c', alpha: 0.34 }, { op: 'soft-light', color: '#3a6a9a', alpha: 0.40 }] },
  lava: { name: 'Lave',   floorA: '#4a2f24', floorB: '#42291f', wallEdge: '#2a140c', wallFace: '#5c3a2c', wallHi: '#7a4a34', grade: [{ op: 'multiply', color: '#4a2018', alpha: 0.34 }, { op: 'soft-light', color: '#8a3a1a', alpha: 0.40 }] },
};
export function biomeFor(level) { return level <= 5 ? 'rock' : level <= 10 ? 'ice' : 'lava'; }

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

  // BFS depuis l'entrée (avec parents pour protéger le chemin vers l'escalier)
  const dist = makeGrid(MINE_W, MINE_H, -1);
  const prev = makeGrid(MINE_W, MINE_H, null);
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
      dist[ny][nx] = d + 1; prev[ny][nx] = [x, y]; q.push([nx, ny]);
    }
  }

  const isBoss = (level === 5 || level === 10);
  grid[far.y][far.x] = isBoss ? MT.STAIRS_SEALED : MT.STAIRS;
  grid[entrance.y][entrance.x] = MT.ENTRANCE;

  // Chemin protégé entrée → escalier (jamais transformé en gouffre)
  const protectedPath = new Set();
  { let cur = [far.x, far.y];
    while (cur) { protectedPath.add(cur[0] + ',' + cur[1]); cur = prev[cur[1]][cur[0]]; } }

  // Gouffres (étage 4+) : blobs de vide infranchissables — se traversent en
  // plaçant des Passerelles (construction avec des blocs).
  if (level >= 4) {
    const floorList = [...carved].map(s => s.split(',').map(Number));
    const pitCount = 2 + Math.floor(level / 3);
    for (let i = 0; i < pitCount; i++) {
      const seed = choice(floorList);
      let [x, y] = seed;
      const size = ri(2, 5);
      for (let n = 0; n < size; n++) {
        const key = x + ',' + y;
        if (grid[y][x] === MT.FLOOR && !protectedPath.has(key) &&
            !(x === entrance.x && y === entrance.y)) grid[y][x] = MT.PIT;
        const d = ri(0, 3);
        if (d === 0) x = clamp(x + 1, 1, MINE_W - 2); else if (d === 1) x = clamp(x - 1, 1, MINE_W - 2);
        else if (d === 2) y = clamp(y + 1, 1, MINE_H - 2); else y = clamp(y - 1, 1, MINE_H - 2);
      }
    }
  }

  // Veines de minerai : blobs de 2-6 blocs qui poussent depuis un mur exposé.
  for (let y = 1; y < MINE_H - 1; y++) for (let x = 1; x < MINE_W - 1; x++)
    if (grid[y][x] === MT.WALL) hp[y][x] = 3;
  const exposedWalls = [];
  for (let y = 1; y < MINE_H - 1; y++) for (let x = 1; x < MINE_W - 1; x++) {
    if (grid[y][x] !== MT.WALL) continue;
    if (grid[y][x + 1] === MT.FLOOR || grid[y][x - 1] === MT.FLOOR ||
        grid[y + 1][x] === MT.FLOOR || grid[y - 1][x] === MT.FLOOR) exposedWalls.push([x, y]);
  }
  const growVein = (oreT, count, sizeMin, sizeMax) => {
    for (let i = 0; i < count && exposedWalls.length; i++) {
      let [x, y] = choice(exposedWalls);
      const size = ri(sizeMin, sizeMax);
      for (let n = 0; n < size; n++) {
        if (grid[y][x] === MT.WALL) { grid[y][x] = oreT; hp[y][x] = 4; }
        const opts = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
          .filter(([nx, ny]) => nx >= 1 && ny >= 1 && nx < MINE_W - 1 && ny < MINE_H - 1 && grid[ny][nx] === MT.WALL);
        if (!opts.length) break;
        [x, y] = choice(opts);
      }
    }
  };
  growVein(MT.ORE_COPPER, 5 + (level <= 5 ? 2 : 0), 2, 6);
  if (level >= 2) growVein(MT.ORE_IRON, 3 + (level / 3 | 0), 2, 5);
  if (level >= 3) growVein(MT.ORE_GOLD, 2 + (level / 4 | 0), 2, 4);
  if (level >= 5) growVein(MT.ORE_DIAMOND, 1 + (level / 6 | 0), 1, 3);

  // Ennemis (jamais sur un gouffre)
  const enemies = [];
  const floors = [...carved].map(s => { const [x, y] = s.split(',').map(Number); return { x, y }; })
    .filter(t => grid[t.y][t.x] === MT.FLOOR && dist[t.y][t.x] > 6);
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

  // Pièges : piques partout, flaques de lave dans le biome Lave,
  // plaques de glace glissantes dans le biome Glace.
  const biome = biomeFor(level);
  const traps = [];
  const trapSpots = floors.filter(t => !(t.x === far.x && t.y === far.y));
  const nTraps = 2 + Math.floor(level / 2);
  for (let i = 0; i < nTraps && trapSpots.length; i++) {
    const t = trapSpots.splice(Math.random() * trapSpots.length | 0, 1)[0];
    let type = 'spikes';
    if (biome === 'lava' && Math.random() < 0.5) type = 'lava';
    else if (biome === 'ice' && Math.random() < 0.5) type = 'ice';
    traps.push({ gx: t.x, gy: t.y, type, cd: 0, ph: Math.random() * 6.28 });
  }

  return {
    level, biome, tilemap: new TileMap(grid, 'mine'), hp,
    w: MINE_W, h: MINE_H, entrance, stairsPos: far,
    isBoss, stairsUnlocked: !isBoss,
    enemies, boss, traps, placed: [], ground: [], id: nid(),
  };
}
