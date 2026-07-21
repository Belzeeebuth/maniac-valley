// ============================================================================
// CombatSystem — coup d'épée en arc orienté, dégâts + coups critiques, recul
// (knockback), i-frames, IA des ennemis et patterns des boss, ondes de choc et
// chutes de rochers.
// ============================================================================

import { TILE } from '../world/TileMap.js';
import { MT } from '../world/TileMap.js';
import { makeEnemy } from '../entities/Enemy.js';

const rand = (a, b) => Math.random() * (b - a) + a;
function aabb(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

export class CombatSystem {
  constructor(game) { this.game = game; }

  // ---------------- Attaque du joueur ----------------
  swingSword() {
    const g = this.game, p = g.player;
    if (!p.canAttack()) return;
    if (p.stamina >= 3) p.stamina -= 3; else p.stamina = 0;
    p.attackTimer = p.attackDur; p.attackCooldown = 0.32;
    g.sound.play('swing');

    if (g.scene !== 'mine') return;
    const o = p.facingOffset();
    const hbW = 46 + p.swordLevel * 4, hbH = 46 + p.swordLevel * 4;
    const hbx = p.cx + o.x * 26 - hbW / 2 + o.x * 8;
    const hby = p.cy + o.y * 26 - hbH / 2 + o.y * 8;

    const targets = [...g.mine.enemies];
    if (g.mine.boss) targets.push(g.mine.boss);
    let hit = false;
    for (const e of targets) {
      if (e.iframes > 0) continue;
      const ew = e.w, eh = e.h;
      if (aabb(hbx, hby, hbW, hbH, e.x - ew / 2, e.y - eh / 2, ew, eh)) {
        const crit = Math.random() < 0.15;
        let dmg = 12 + p.swordLevel * 8;
        if (crit) dmg = Math.round(dmg * 1.8);
        this.damageEnemy(e, dmg, crit);
        hit = true;
      }
    }
    if (hit) g.sound.play('hit');
  }

  damageEnemy(e, dmg, crit) {
    const g = this.game, p = g.player;
    e.hp -= dmg;
    e.iframes = 0.25;
    g.floatText(e.x, e.y - 20, (crit ? '✦' : '') + '-' + dmg, crit ? '#ffe24a' : '#ff5050', crit);
    g.sound.play(e.kind.startsWith('boss') ? 'boss_hit' : (crit ? 'crit' : 'enemyhit'));
    const ang = Math.atan2(e.y - p.cy, e.x - p.cx);
    e.vx = Math.cos(ang) * 260; e.vy = Math.sin(ang) * 260;

    if (e.kind === 'boss_gigaslime') {
      const ratio = e.hp / e.maxHp;
      for (const th of [75, 50, 25]) {
        if (ratio <= th / 100 && !e.splitDone[th]) { e.splitDone[th] = true; this.splitGigaSlime(e); }
      }
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  splitGigaSlime(boss) {
    const g = this.game;
    for (let i = 0; i < 3; i++) {
      const a = rand(0, Math.PI * 2);
      const mini = makeEnemy('slime', boss.x + Math.cos(a) * 40, boss.y + Math.sin(a) * 40, g.mine.level);
      mini.hp = Math.max(10, Math.floor(boss.maxHp / 12)); mini.maxHp = mini.hp;
      mini.tint = '#9a4aba';
      g.mine.enemies.push(mini);
    }
    g.toast('Le Giga Slime se divise !');
  }

  killEnemy(e) {
    const g = this.game;
    g.sound.play('death');
    if (e.kind === 'slime' || e.kind === 'skeleton' || e.kind === 'bat') {
      g.player.kills[e.kind] = (g.player.kills[e.kind] || 0) + 1;
      g.quests.onKill(e.kind);
      const idx = g.mine.enemies.indexOf(e);
      if (idx >= 0) g.mine.enemies.splice(idx, 1);
      g.mine.ground.push({ id: e.id, kind: 'gold', x: e.x, y: e.y, amount: 2 + (Math.random() * 7 | 0) });
      if (Math.random() < 0.3) {
        const item = ['stone', 'coal', 'wood'][Math.random() * 3 | 0];
        g.mine.ground.push({ id: e.id + 1, kind: 'item', item, x: e.x + 8, y: e.y + 4 });
      }
    } else if (e.kind === 'boss_gigaslime' || e.kind === 'boss_moleking') {
      g.mine.boss = null;
      g.mine.stairsUnlocked = true;
      g.mine.tilemap.set(g.mine.stairsPos.x, g.mine.stairsPos.y, MT.STAIRS);
      g.toast('🏆 Boss vaincu ! L\'escalier est ouvert.');
      g.sound.play('levelup');
      g.mine.ground.push({ id: e.id, kind: 'gold', x: e.x, y: e.y, amount: 100 + g.mine.level * 10 });
      const drop = e.kind === 'boss_gigaslime' ? 'bar_gold' : 'diamond';
      g.inventory.add(drop, 2); g.loot(drop, 2);
    }
  }

  // ---------------- IA ennemis ----------------
  updateEnemies(dt) {
    const g = this.game;
    if (g.scene !== 'mine') return;
    const m = g.mine, p = g.player;
    for (const e of m.enemies) {
      if (e.iframes > 0) e.iframes -= dt;
      if (e.contactCd > 0) e.contactCd -= dt;
      e.vx *= 0.9; e.vy *= 0.9;
      const d = dist(e.x, e.y, p.cx, p.cy);
      let mvx = 0, mvy = 0;

      if (e.kind === 'slime') {
        e.jumpT -= dt;
        if (e.squish > 0) e.squish -= dt * 4;
        if (e.jumpT <= 0 && d < TILE * 7) {
          e.jumpT = rand(1.0, 1.6);
          const ang = Math.atan2(p.cy - e.y, p.cx - e.x);
          e.vx += Math.cos(ang) * 140; e.vy += Math.sin(ang) * 140; e.squish = 1;
        }
      } else if (e.kind === 'skeleton') {
        if (d < TILE * 8 && d > 2) {
          const ang = Math.atan2(p.cy - e.y, p.cx - e.x);
          mvx = Math.cos(ang) * e.speed; mvy = Math.sin(ang) * e.speed;
        }
      } else if (e.kind === 'bat') {
        e.wavePhase += dt * 6;
        if (d < TILE * 9) {
          const ang = Math.atan2(p.cy - e.y, p.cx - e.x) + Math.sin(e.wavePhase) * 0.6;
          mvx = Math.cos(ang) * e.speed; mvy = Math.sin(ang) * e.speed;
        }
      }

      let nx = e.x + (mvx + e.vx) * dt, ny = e.y + (mvy + e.vy) * dt;
      if (e.kind !== 'bat') { // les chauves-souris ignorent les obstacles
        if (g.blocked(nx - e.w / 2, e.y - e.h / 2, e.w, e.h)) nx = e.x;
        if (g.blocked(e.x - e.w / 2, ny - e.h / 2, e.w, e.h)) ny = e.y;
      }
      e.x = nx; e.y = ny;

      if (e.contactCd <= 0 && d < (e.w / 2 + p.w / 2) * 0.85 && p.iframes <= 0) {
        this.damagePlayer(e.dmg, e.x, e.y); e.contactCd = 0.8;
      }
    }
    if (m.boss) this.updateBoss(dt);
  }

  // ---------------- IA boss ----------------
  updateBoss(dt) {
    const g = this.game, b = g.mine.boss, p = g.player;
    if (b.iframes > 0) b.iframes -= dt;
    if (b.contactCd > 0) b.contactCd -= dt;
    if (b.kind === 'boss_gigaslime') this._giga(b, dt);
    else this._mole(b, dt);

    const d = dist(b.x, b.y, p.cx, p.cy);
    if (b.contactCd <= 0 && d < (b.w / 2 + p.w / 2) * 0.75 && p.iframes <= 0 && b.phase !== 'burrowed') {
      this.damagePlayer(b.dmg, b.x, b.y); b.contactCd = 0.9;
    }
  }

  _giga(b, dt) {
    const g = this.game, p = g.player;
    b.vx *= 0.9; b.vy *= 0.9;
    b.jumpT -= dt;
    if (b.squish > 0) b.squish -= dt * 3;
    if (b.jumpT <= 0) {
      b.jumpT = rand(2.0, 3.2);
      const ang = Math.atan2(p.cy - b.y, p.cx - b.x);
      b.vx += Math.cos(ang) * 90; b.vy += Math.sin(ang) * 90; b.squish = 1;
      b._landTimer = 0.4;
    }
    if (b._landTimer > 0) {
      b._landTimer -= dt;
      if (b._landTimer <= 0) this.spawnShockwave(b.x, b.y);
    }
    b.x = Math.min(Math.max(b.x + b.vx * dt, TILE * 1.5), g.mine.w * TILE - TILE * 1.5);
    b.y = Math.min(Math.max(b.y + b.vy * dt, TILE * 1.5), g.mine.h * TILE - TILE * 1.5);
  }

  _mole(b, dt) {
    const g = this.game, p = g.player;
    b.stateT -= dt;
    if (b.state === 'idle') {
      b.phase = 'ground';
      const ang = Math.atan2(p.cy - b.y, p.cx - b.x);
      b.x += Math.cos(ang) * b.speed * 0.5 * dt;
      b.y += Math.sin(ang) * b.speed * 0.5 * dt;
      if (b.stateT <= 0) { b.state = 'burrow'; b.stateT = 1.4; g.sound.play('burrow'); }
    } else if (b.state === 'burrow') {
      b.phase = 'burrowed';
      if (b.stateT <= 0) {
        b.state = 'emerge'; b.stateT = 0.5;
        b.x = Math.min(Math.max(p.cx + rand(-40, 40), TILE * 2), g.mine.w * TILE - TILE * 2);
        b.y = Math.min(Math.max(p.cy + rand(-40, 40), TILE * 2), g.mine.h * TILE - TILE * 2);
      }
    } else if (b.state === 'emerge') {
      b.phase = 'ground';
      if (b.stateT <= 0) {
        g.sound.play('boss_roar');
        this.spawnFallingRocks(b.x, b.y, 5);
        b.state = 'charge'; b.stateT = 1.0;
        const ang = Math.atan2(p.cy - b.y, p.cx - b.x);
        b.chargeVX = Math.cos(ang) * 280; b.chargeVY = Math.sin(ang) * 280;
      }
    } else if (b.state === 'charge') {
      b.x = Math.min(Math.max(b.x + b.chargeVX * dt, TILE * 1.5), g.mine.w * TILE - TILE * 1.5);
      b.y = Math.min(Math.max(b.y + b.chargeVY * dt, TILE * 1.5), g.mine.h * TILE - TILE * 1.5);
      if (b.stateT <= 0) { b.state = 'idle'; b.stateT = 2.2; }
    }
  }

  spawnShockwave(x, y) {
    this.game.effects.shockwaves.push({ x, y, r: 10, maxR: 120, life: 0.6, hit: false });
    this.game.sound.play('shockwave');
  }
  spawnFallingRocks(x, y, n) {
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2), r = rand(20, 90);
      this.game.effects.fallingRocks.push({ x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r, t: 0, warn: 0.7, done: false });
    }
  }

  // ---------------- Dégâts joueur ----------------
  damagePlayer(dmg, sx, sy) {
    const g = this.game, p = g.player;
    p.hp = Math.max(0, p.hp - dmg);
    p.iframes = 1.0;
    g.sound.play('hurt');
    g.flashHp();
    g.floatText(p.cx, p.y - 6, '-' + dmg, '#ff5a5a');
    const ang = Math.atan2(p.cy - sy, p.cx - sx);
    const nx = p.x + Math.cos(ang) * 22, ny = p.y + Math.sin(ang) * 22;
    if (!g.blocked(nx, p.y, p.w, p.h)) p.x = nx;
    if (!g.blocked(p.x, ny, p.w, p.h)) p.y = ny;
    if (p.hp <= 0) g.collapse();
  }

  updateEffects(dt) {
    const g = this.game, p = g.player, e = g.effects;
    for (const sw of e.shockwaves) {
      sw.life -= dt; sw.r = Math.min(sw.maxR, sw.r + dt * 260);
      if (!sw.hit && sw.r > 30) {
        if (dist(p.cx, p.cy, sw.x, sw.y) < sw.r + 10 && p.iframes <= 0) this.damagePlayer(14, sw.x, sw.y);
        sw.hit = true;
      }
    }
    e.shockwaves = e.shockwaves.filter(s => s.life > 0);
    for (const r of e.fallingRocks) {
      if (r.done) continue;
      r.t += dt;
      if (r.t >= r.warn) { r.done = true; if (dist(p.cx, p.cy, r.x, r.y) < 26 && p.iframes <= 0) this.damagePlayer(12, r.x, r.y); }
    }
    e.fallingRocks = e.fallingRocks.filter(r => r.t < r.warn + 0.4);
  }
}
