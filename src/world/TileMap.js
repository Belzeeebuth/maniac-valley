// ============================================================================
// TileMap — grille 2D générique + constantes de tuiles + tests de collision.
// ============================================================================

export const TILE = 32;

// Tuiles overworld
export const OT = {
  GRASS: 0, PATH: 1, WATER: 2, TREE: 3, ROCK: 4, FENCE: 5, WALL: 6,
  MINE_ENTRANCE: 7, BED: 8, QUESTBOARD: 9, SHOPCOUNTER: 10, FARMLAND: 11,
  BUSH: 12, BRIDGE: 13,
};
const OT_SOLID = new Set([OT.WATER, OT.TREE, OT.ROCK, OT.FENCE, OT.WALL, OT.QUESTBOARD, OT.SHOPCOUNTER, OT.BUSH]);

// Tuiles mine
export const MT = {
  WALL: 0, FLOOR: 1, ORE_COPPER: 2, ORE_IRON: 3, ORE_GOLD: 4, ORE_DIAMOND: 5,
  STAIRS: 6, STAIRS_SEALED: 7, ENTRANCE: 8, PIT: 9, BRIDGE: 10,
};
const MT_SOLID = new Set([MT.WALL, MT.ORE_COPPER, MT.ORE_IRON, MT.ORE_GOLD, MT.ORE_DIAMOND, MT.STAIRS_SEALED, MT.PIT]);
const MT_ORE = new Set([MT.ORE_COPPER, MT.ORE_IRON, MT.ORE_GOLD, MT.ORE_DIAMOND]);

export class TileMap {
  constructor(grid, kind) {
    this.grid = grid;
    this.kind = kind; // 'overworld' | 'mine'
    this.h = grid.length;
    this.w = grid[0].length;
  }

  inBounds(gx, gy) { return gx >= 0 && gy >= 0 && gx < this.w && gy < this.h; }
  get(gx, gy) { return this.inBounds(gx, gy) ? this.grid[gy][gx] : -1; }
  set(gx, gy, v) { if (this.inBounds(gx, gy)) this.grid[gy][gx] = v; }

  isSolid(gx, gy) {
    const t = this.get(gx, gy);
    if (t === -1) return true;
    return this.kind === 'overworld' ? OT_SOLID.has(t) : MT_SOLID.has(t);
  }

  static isOreMine(t) { return MT_ORE.has(t); }

  // Une AABB (px,py,w,h) est-elle en collision avec une tuile solide ?
  boxHitsSolid(px, py, w, h) {
    const gx0 = Math.floor(px / TILE), gy0 = Math.floor(py / TILE);
    const gx1 = Math.floor((px + w) / TILE), gy1 = Math.floor((py + h) / TILE);
    for (let gy = gy0; gy <= gy1; gy++)
      for (let gx = gx0; gx <= gx1; gx++)
        if (this.isSolid(gx, gy)) return true;
    return false;
  }
}

export function makeGrid(w, h, fill) {
  const g = new Array(h);
  for (let y = 0; y < h; y++) g[y] = new Array(w).fill(fill);
  return g;
}
