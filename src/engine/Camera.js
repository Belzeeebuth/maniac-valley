// ============================================================================
// Camera — suit le joueur (défilement fluide, clamp) + screen shake juteux.
// La position exposée (x,y) inclut la secousse ; la base lissée est interne.
// ============================================================================

import { TILE } from '../world/TileMap.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;      // position finale (avec shake)
    this._bx = 0; this._by = 0;  // base lissée
    this.smooth = 8;
    this.shakeT = 0; this.shakeDur = 1; this.shakeMag = 0;
  }

  _clampTarget(target, sceneW, sceneH, viewW, viewH) {
    const maxX = Math.max(0, sceneW * TILE - viewW);
    const maxY = Math.max(0, sceneH * TILE - viewH);
    return {
      x: Math.min(Math.max(target.x + target.w / 2 - viewW / 2, 0), maxX),
      y: Math.min(Math.max(target.y + target.h / 2 - viewH / 2, 0), maxY),
    };
  }

  follow(target, sceneW, sceneH, viewW, viewH, dt) {
    const c = this._clampTarget(target, sceneW, sceneH, viewW, viewH);
    const k = 1 - Math.exp(-this.smooth * dt);
    this._bx += (c.x - this._bx) * k;
    this._by += (c.y - this._by) * k;
    this._applyShake(dt);
  }

  snap(target, sceneW, sceneH, viewW, viewH) {
    const c = this._clampTarget(target, sceneW, sceneH, viewW, viewH);
    this._bx = c.x; this._by = c.y;
    this.shakeT = 0; this.shakeMag = 0;
    this.x = c.x; this.y = c.y;
  }

  shake(mag, dur) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    if (this.shakeT <= 0 || dur > this.shakeDur) this.shakeDur = dur;
    this.shakeT = Math.max(this.shakeT, dur);
  }

  _applyShake(dt) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const f = Math.max(0, this.shakeT / this.shakeDur);
      const m = this.shakeMag * f;
      this.x = this._bx + (Math.random() * 2 - 1) * m;
      this.y = this._by + (Math.random() * 2 - 1) * m;
      if (this.shakeT <= 0) this.shakeMag = 0;
    } else {
      this.x = this._bx; this.y = this._by;
    }
  }
}
