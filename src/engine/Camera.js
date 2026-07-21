// ============================================================================
// Camera — suit le joueur avec un défilement fluide (lerp) et clamp sur la carte.
// ============================================================================

import { TILE } from '../world/TileMap.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.smooth = 8; // vitesse de suivi
  }

  follow(target, sceneW, sceneH, viewW, viewH, dt) {
    const tx = target.x + target.w / 2 - viewW / 2;
    const ty = target.y + target.h / 2 - viewH / 2;
    const maxX = Math.max(0, sceneW * TILE - viewW);
    const maxY = Math.max(0, sceneH * TILE - viewH);
    const cx = Math.min(Math.max(tx, 0), maxX);
    const cy = Math.min(Math.max(ty, 0), maxY);
    // lerp temporel indépendant du framerate
    const k = 1 - Math.exp(-this.smooth * dt);
    this.x += (cx - this.x) * k;
    this.y += (cy - this.y) * k;
  }

  snap(target, sceneW, sceneH, viewW, viewH) {
    const maxX = Math.max(0, sceneW * TILE - viewW);
    const maxY = Math.max(0, sceneH * TILE - viewH);
    this.x = Math.min(Math.max(target.x + target.w / 2 - viewW / 2, 0), maxX);
    this.y = Math.min(Math.max(target.y + target.h / 2 - viewH / 2, 0), maxY);
  }
}
