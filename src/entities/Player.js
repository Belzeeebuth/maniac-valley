// ============================================================================
// Player — stats, déplacement 8 directions avec collisions, esquive (dodge),
// gestion des i-frames et de l'animation d'attaque.
// ============================================================================

import { TILE } from '../world/TileMap.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 20; this.h = 24;
    this.facing = 'down';
    this.speed = 150;

    this.hp = 100; this.maxHp = 100;
    this.stamina = 100; this.maxStamina = 100;
    this.hunger = 100; this.maxHunger = 100;
    this.gold = 60;

    this.swordLevel = 0; this.pickLevel = 0; this.axeLevel = 0;

    this.iframes = 0;
    this.attackTimer = 0; this.attackDur = 0.2; this.attackCooldown = 0;
    this.moving = false; this.animT = 0;

    // esquive (roulade)
    this.dodging = false; this.dodgeTimer = 0; this.dodgeCooldown = 0;
    this.dodgeVX = 0; this.dodgeVY = 0;

    this.kills = { slime: 0, skeleton: 0, bat: 0 };
    this.crafted = {};
    this.mined = { copper: 0, iron: 0, gold_ore: 0, diamond: 0 };
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  facingOffset() {
    return { down: { x: 0, y: 1 }, up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[this.facing];
  }

  frontTile() {
    const o = this.facingOffset();
    const fx = this.cx + o.x * TILE * 0.8;
    const fy = this.cy + o.y * TILE * 0.8;
    return { gx: Math.floor(fx / TILE), gy: Math.floor(fy / TILE), wx: fx, wy: fy };
  }

  startDodge() {
    if (this.dodgeCooldown > 0 || this.stamina < 10) return false;
    const o = this.facingOffset();
    this.dodging = true; this.dodgeTimer = 0.28; this.dodgeCooldown = 0.7;
    this.dodgeVX = o.x * 420; this.dodgeVY = o.y * 420;
    this.iframes = Math.max(this.iframes, 0.32);
    this.stamina -= 10;
    return true;
  }

  // dt, input vector, et une fonction blocked(px,py,w,h) fournie par le monde.
  update(dt, move, blocked) {
    if (this.iframes > 0) this.iframes -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;

    let vx = 0, vy = 0;
    if (this.dodging) {
      this.dodgeTimer -= dt;
      vx = this.dodgeVX; vy = this.dodgeVY;
      this.dodgeVX *= 0.88; this.dodgeVY *= 0.88;
      this.moving = true; this.animT += dt * 14;
      if (this.dodgeTimer <= 0) this.dodging = false;
    } else {
      this.moving = (move.dx !== 0 || move.dy !== 0);
      if (this.moving) {
        if (Math.abs(move.dx) > Math.abs(move.dy)) this.facing = move.dx > 0 ? 'right' : 'left';
        else if (move.dy !== 0) this.facing = move.dy > 0 ? 'down' : 'up';
        vx = move.dx * this.speed; vy = move.dy * this.speed;
        this.animT += dt * 8;
      }
    }

    const nx = this.x + vx * dt, ny = this.y + vy * dt;
    if (!blocked(nx, this.y, this.w, this.h)) this.x = nx;
    if (!blocked(this.x, ny, this.w, this.h)) this.y = ny;
  }

  clampToScene(sceneW, sceneH) {
    this.x = Math.min(Math.max(this.x, TILE), sceneW * TILE - TILE - this.w);
    this.y = Math.min(Math.max(this.y, TILE), sceneH * TILE - TILE - this.h);
  }

  canAttack() { return this.attackCooldown <= 0 && !this.dodging; }
}
