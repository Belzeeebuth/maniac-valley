// ============================================================================
// SpriteSheetGenerator — tout le pixel art est dessiné procéduralement au
// runtime via des primitives Canvas. Aucune image externe.
// Toutes les méthodes prennent un contexte `c` afin de servir aussi bien le
// canvas du monde que les petits canvas des icônes d'UI.
// ============================================================================

import { TILE } from '../world/TileMap.js';
import { CROPS } from '../entities/Crop.js';

function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

export const Sprites = {
  // ---------------- Tuiles overworld ----------------
  grass(c, x, y, v) {
    rect(c, x, y, TILE, TILE, v % 2 === 0 ? '#3f8a44' : '#458f49');
    c.fillStyle = 'rgba(255,255,255,0.05)';
    if (v % 3 === 0) c.fillRect(x + 6, y + 8, 3, 3);
    if (v % 5 === 0) c.fillRect(x + 20, y + 18, 3, 3);
    c.fillStyle = 'rgba(0,0,0,0.06)';
    if (v % 4 === 0) c.fillRect(x + 14, y + 22, 4, 2);
  },
  grassAutumn(c, x, y, v) {
    rect(c, x, y, TILE, TILE, v % 2 === 0 ? '#8a6a2a' : '#946f2e');
    c.fillStyle = 'rgba(200,90,30,0.18)';
    if (v % 3 === 0) c.fillRect(x + 7, y + 9, 3, 3);
    if (v % 4 === 0) c.fillRect(x + 19, y + 17, 3, 3);
  },
  grassWinter(c, x, y, v) {
    rect(c, x, y, TILE, TILE, v % 2 === 0 ? '#d7e0e6' : '#c9d4dc');
    c.fillStyle = 'rgba(255,255,255,0.5)';
    if (v % 3 === 0) c.fillRect(x + 6, y + 8, 3, 3);
    c.fillStyle = 'rgba(120,140,160,0.2)';
    if (v % 5 === 0) c.fillRect(x + 20, y + 20, 4, 3);
  },
  path(c, x, y, v) {
    rect(c, x, y, TILE, TILE, '#c9a769');
    c.fillStyle = v % 2 === 0 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
    c.fillRect(x + 4, y + 6, 6, 4); c.fillRect(x + 18, y + 20, 7, 4);
  },
  water(c, x, y, t) {
    rect(c, x, y, TILE, TILE, '#2a6f9e');
    const w = Math.sin(t * 2 + x * 0.05) * 3;
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x + 2, y + 16 + w); c.lineTo(x + 30, y + 16 + w); c.stroke();
    c.beginPath(); c.moveTo(x + 2, y + 8 - w); c.lineTo(x + 30, y + 8 - w); c.stroke();
  },
  farmland(c, x, y, wet) {
    rect(c, x, y, TILE, TILE, wet ? '#4a2f18' : '#7a5230');
    c.strokeStyle = wet ? '#3a2210' : '#5e3d20'; c.lineWidth = 1;
    for (let i = 6; i < TILE; i += 8) { c.beginPath(); c.moveTo(x + 2, y + i); c.lineTo(x + TILE - 2, y + i); c.stroke(); }
  },
  tree(c, x, y, t, season) {
    const cx = x + TILE / 2;
    rect(c, cx - 4, y + TILE - 14, 8, 14, '#5b3a20');
    const sway = Math.sin(t + x * 0.01) * 2;
    if (season === 'winter') {
      circ(c, cx + sway, y + 16, 15, '#6b4a2b');
      c.fillStyle = 'rgba(255,255,255,0.7)';
      circ(c, cx + sway, y + 10, 8, 'rgba(255,255,255,0.55)');
      return;
    }
    const leaf = season === 'autumn' ? ['#b5651d', '#c9772a', '#d98c33']
                : season === 'summer' ? ['#2a6b2e', '#2f7a33', '#3d9a41']
                : ['#2d6b31', '#317a36', '#3d8a41'];
    circ(c, cx + sway, y + 16, 15, leaf[0]);
    circ(c, cx - 9 + sway, y + 22, 11, leaf[1]);
    circ(c, cx + 9 + sway, y + 22, 11, leaf[1]);
    circ(c, cx + sway, y + 10, 12, leaf[2]);
  },
  rock(c, x, y) {
    c.fillStyle = '#8a8a8a';
    c.beginPath();
    c.moveTo(x + 6, y + 28); c.lineTo(x + 3, y + 16); c.lineTo(x + 11, y + 6);
    c.lineTo(x + 22, y + 5); c.lineTo(x + 29, y + 15); c.lineTo(x + 26, y + 28);
    c.closePath(); c.fill();
    c.fillStyle = '#a8a8a8';
    c.beginPath(); c.moveTo(x + 11, y + 6); c.lineTo(x + 22, y + 5); c.lineTo(x + 18, y + 14); c.closePath(); c.fill();
    c.fillStyle = '#6a6a6a'; c.fillRect(x + 8, y + 22, 5, 4); c.fillRect(x + 18, y + 24, 6, 3);
  },
  fence(c, x, y) {
    rect(c, x + 4, y + 4, 5, 26, '#8a6a3a'); rect(c, x + 23, y + 4, 5, 26, '#8a6a3a');
    rect(c, x + 2, y + 9, 28, 4, '#6b4a2b'); rect(c, x + 2, y + 19, 28, 4, '#6b4a2b');
  },
  wall(c, x, y) {
    rect(c, x, y, TILE, TILE, '#7a5a3a');
    c.strokeStyle = '#4a3520'; c.lineWidth = 1;
    for (let r = 0; r < 4; r++) {
      const yy = y + r * 8;
      c.beginPath(); c.moveTo(x, yy); c.lineTo(x + TILE, yy); c.stroke();
      const off = (r % 2 === 0) ? 0 : 8;
      for (let cc = off; cc < TILE; cc += 16) { c.beginPath(); c.moveTo(x + cc, yy); c.lineTo(x + cc, yy + 8); c.stroke(); }
    }
  },
  bed(c, x, y) {
    rect(c, x + 2, y + 2, 28, 26, '#5a3d24');
    rect(c, x + 4, y + 4, 24, 10, '#c0392b');
    rect(c, x + 4, y + 14, 24, 12, '#8b3a3a');
    rect(c, x + 5, y + 5, 8, 7, '#f4e9d0');
  },
  questBoard(c, x, y) {
    rect(c, x + 14, y + 10, 4, 22, '#6b4a2b');
    rect(c, x + 4, y + 2, 24, 16, '#8a6a3a');
    c.strokeStyle = '#4a3520'; c.lineWidth = 2; c.strokeRect(x + 4, y + 2, 24, 16);
    c.fillStyle = '#f4e9d0'; c.fillRect(x + 9, y + 7, 14, 2); c.fillRect(x + 9, y + 11, 10, 2);
  },
  shopCounter(c, x, y) {
    rect(c, x, y + 10, TILE, 22, '#8a6a3a');
    rect(c, x, y + 10, TILE, 5, '#a8825a');
    c.strokeStyle = '#4a3520'; c.strokeRect(x + 2, y + 16, TILE - 4, 14);
  },
  mineEntrance(c, x, y) {
    rect(c, x, y + 4, TILE, 28, '#1a1a1a');
    c.fillStyle = '#5a5a5a';
    c.beginPath(); c.arc(x + 16, y + 16, 16, Math.PI, 0); c.fill();
    rect(c, x + 2, y + 4, 6, 26, '#6a6a6a'); rect(c, x + 24, y + 4, 6, 26, '#6a6a6a');
    rect(c, x + 7, y + 10, 18, 22, '#050505');
  },
  chest(c, x, y) {
    rect(c, x + 3, y + 14, 26, 14, '#7a5230');
    rect(c, x + 3, y + 8, 26, 10, '#8a6238');
    c.strokeStyle = '#4a3520'; c.lineWidth = 1; c.strokeRect(x + 3, y + 14, 26, 14);
    rect(c, x + 14, y + 18, 4, 4, '#3a2818');
  },
  furnace(c, x, y, t) {
    rect(c, x + 3, y + 2, 26, 28, '#4a4a4a');
    rect(c, x + 9, y + 16, 14, 12, '#ff8c1a');
    c.fillStyle = 'rgba(255,140,26,0.4)';
    c.beginPath(); c.arc(x + 16, y + 14, 10 + Math.sin(t * 6) * 2, 0, Math.PI * 2); c.fill();
    rect(c, x + 6, y + 4, 20, 3, '#333');
  },
  scarecrow(c, x, y) {
    rect(c, x + 14, y + 6, 4, 24, '#8a6a3a');
    rect(c, x + 6, y + 10, 20, 4, '#8a6a3a');
    circ(c, x + 16, y + 8, 6, '#e8c090');
    rect(c, x + 10, y + 2, 12, 5, '#5a3a20');
    rect(c, x + 8, y + 14, 16, 10, '#c9a769');
  },
  torch(c, x, y, t) {
    rect(c, x + 14, y + 14, 4, 18, '#6b4a2b');
    const f = 0.7 + Math.sin(t * 14 + x) * 0.3;
    c.fillStyle = `rgba(255,${140 + Math.floor(40 * f)},30,0.9)`;
    c.beginPath(); c.moveTo(x + 16, y + 2); c.lineTo(x + 22, y + 14); c.lineTo(x + 10, y + 14); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,220,120,0.9)';
    c.beginPath(); c.moveTo(x + 16, y + 6); c.lineTo(x + 19, y + 14); c.lineTo(x + 13, y + 14); c.closePath(); c.fill();
  },
  stairsDown(c, x, y, sealed) {
    if (sealed) {
      rect(c, x + 2, y + 8, 28, 22, '#5a4a3a');
      Sprites.rock(c, x - 2, y - 4);
      return;
    }
    rect(c, x + 2, y + 6, 28, 26, '#0a0a0a');
    for (let i = 0; i < 4; i++) rect(c, x + 4 + i * 1.5, y + 8 + i * 5, 26 - i * 3, 4, '#3a3a3a');
  },
  cropStage(c, x, y, cropId, stage) {
    const cd = CROPS[cropId];
    if (stage === 0) { rect(c, x + 13, y + 22, 6, 6, '#3a6b2a'); return; }
    if (stage === 1) { rect(c, x + 14, y + 16, 4, 14, '#3a6b2a'); circ(c, x + 16, y + 15, 4, '#4a8a3a'); return; }
    if (stage === 2) { rect(c, x + 13, y + 12, 6, 18, '#3a6b2a'); circ(c, x + 12, y + 14, 5, '#4a8a3a'); circ(c, x + 20, y + 16, 5, '#4a8a3a'); return; }
    rect(c, x + 13, y + 16, 6, 14, '#3a6b2a');
    circ(c, x + 16, y + 14, 8, cd.color);
    c.fillStyle = 'rgba(255,255,255,0.25)'; circ(c, x + 13, y + 11, 2.5, cd.color);
  },

  // ---------------- Tuiles mine ----------------
  mineFloor(c, x, y, v) {
    rect(c, x, y, TILE, TILE, '#403830');
    c.fillStyle = 'rgba(0,0,0,0.08)';
    if (v % 5 === 0) c.fillRect(x + 6, y + 8, 3, 3);
    if (v % 7 === 0) c.fillRect(x + 20, y + 18, 3, 3);
  },
  mineWall(c, x, y) {
    rect(c, x, y, TILE, TILE, '#26201c');
    rect(c, x + 2, y + 2, TILE - 4, TILE - 4, '#4a4038');
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + 4, y + 18, TILE - 8, 4);
  },
  mineOre(c, x, y, kind) {
    rect(c, x, y, TILE, TILE, '#26201c');
    rect(c, x + 2, y + 2, TILE - 4, TILE - 4, '#4a4038');
    const col = { copper: '#c9743a', iron: '#c0c0d0', gold: '#ffd700', diamond: '#7fe8e0' }[kind];
    circ(c, x + 11, y + 13, 4, col); circ(c, x + 21, y + 20, 4, col); circ(c, x + 18, y + 9, 3, col);
    c.fillStyle = 'rgba(255,255,255,0.4)'; circ(c, x + 10, y + 12, 1.5, col);
  },
  mineEntranceTile(c, x, y) {
    rect(c, x, y, TILE, TILE, '#403830');
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.beginPath(); c.arc(x + 16, y + 16, 13, 0, Math.PI * 2); c.fill();
  },

  // ---------------- Entités ----------------
  player(c, sx, sy, p) {
    const bob = p.moving ? Math.sin(p.animT) * 2 : 0;
    const flash = p.iframes > 0 && Math.floor(p.iframes * 12) % 2 === 0;
    c.save();
    if (p.dodging) c.globalAlpha = 0.7;
    if (flash) c.globalAlpha = 0.4;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(sx + p.w / 2, sy + p.h + 2, 11, 4, 0, 0, Math.PI * 2); c.fill();
    rect(c, sx + 4, sy + 18 + bob, 6, 8, '#3a3a5a'); rect(c, sx + p.w - 10, sy + 18 + bob, 6, 8, '#3a3a5a');
    rect(c, sx + 2, sy + 8 + bob, p.w - 4, 14, '#3d7fd9');
    rect(c, sx + 4, sy - 2 + bob, p.w - 8, 12, '#e8c090');
    rect(c, sx + 3, sy - 4 + bob, p.w - 6, 5, '#5a3a20');
    c.fillStyle = '#222';
    if (p.facing === 'down') { c.fillRect(sx + 7, sy + 2 + bob, 2, 2); c.fillRect(sx + p.w - 9, sy + 2 + bob, 2, 2); }
    else if (p.facing === 'left') c.fillRect(sx + 5, sy + 2 + bob, 2, 2);
    else if (p.facing === 'right') c.fillRect(sx + p.w - 7, sy + 2 + bob, 2, 2);
    c.restore();
  },
  swordSwing(c, sx, sy, p) {
    const off = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[p.facing];
    c.save();
    c.translate(sx + p.w / 2, sy + p.h / 2 - 4);
    const prog = 1 - p.attackTimer / p.attackDur;
    const ang = Math.atan2(off[1], off[0]) + (0.5 - prog) * 1.4;
    c.rotate(ang);
    const reach = 22 + p.swordLevel * 3;
    c.fillStyle = '#d8d8e8'; c.fillRect(6, -3, reach, 6);
    c.fillStyle = p.swordLevel > 0 ? '#ffe066' : '#c8c8d8'; c.fillRect(6 + reach, -2, 4, 4);
    c.fillStyle = '#8a6a3a'; c.fillRect(0, -4, 8, 8);
    c.globalAlpha = 0.3 * (1 - prog);
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, reach, -0.7, 0.7); c.stroke();
    c.restore();
  },
  chicken(c, sx, sy, a) {
    const bob = Math.sin(a.animT * 6) * 1.5;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(sx, sy + 10, 12, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f4f4f4'; c.beginPath(); c.ellipse(sx, sy + bob, 10, 8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8c090'; c.beginPath(); c.ellipse(sx, sy - 6 + bob, 6, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d9822b'; c.beginPath(); c.moveTo(sx + 6, sy - 6 + bob); c.lineTo(sx + 12, sy - 4 + bob); c.lineTo(sx + 6, sy - 2 + bob); c.fill();
    c.fillStyle = '#c0392b'; c.fillRect(sx - 2, sy - 12 + bob, 4, 4);
  },
  cow(c, sx, sy, a) {
    const bob = Math.sin(a.animT * 5) * 1.5;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(sx, sy + 12, 16, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f4f4f4'; c.beginPath(); c.ellipse(sx, sy + bob, 16, 11, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a2a2a'; c.beginPath(); c.ellipse(sx - 6, sy - 2 + bob, 5, 5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 7, sy + 4 + bob, 4, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8b0b0'; c.beginPath(); c.ellipse(sx + 15, sy + 2 + bob, 4, 3, 0, 0, Math.PI * 2); c.fill();
  },
  enemy(c, sx, sy, e) {
    const flash = e.iframes > 0 && Math.floor(e.iframes * 20) % 2 === 0;
    c.save(); if (flash) c.globalAlpha = 0.4;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(sx, sy + e.h / 2 + 2, 10, 4, 0, 0, Math.PI * 2); c.fill();
    if (e.kind === 'slime') {
      const sq = 1 + (e.squish || 0) * 0.35;
      c.fillStyle = e.tint || '#3ecb5e';
      c.beginPath(); c.ellipse(sx, sy + 4, 11 * sq, 9 / sq, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(sx, sy + 9, 10 * sq, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0a2a0a'; c.fillRect(sx - 5, sy, 2, 3); c.fillRect(sx + 3, sy, 2, 3);
    } else if (e.kind === 'skeleton') {
      rect(c, sx - 3, sy - 2, 6, 12, '#e8e8e0');
      circ(c, sx, sy - 9, 7, '#f0f0e8');
      c.fillStyle = '#111'; c.fillRect(sx - 3, sy - 10, 2, 2); c.fillRect(sx + 1, sy - 10, 2, 2);
      rect(c, sx - 8, sy, 4, 8, '#e8e8e0'); rect(c, sx + 4, sy, 4, 8, '#e8e8e0');
    } else if (e.kind === 'bat') {
      const flap = Math.sin(e.wavePhase) * 10;
      c.fillStyle = '#5a3a6a';
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - 14, sy - flap); c.lineTo(sx - 6, sy + 4); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 14, sy - flap); c.lineTo(sx + 6, sy + 4); c.closePath(); c.fill();
      circ(c, sx, sy, 7, '#3a2050');
      c.fillStyle = '#ff3030'; c.fillRect(sx - 3, sy - 2, 2, 2); c.fillRect(sx + 1, sy - 2, 2, 2);
    }
    c.restore();
    if (e.hp < e.maxHp) {
      c.fillStyle = '#300'; c.fillRect(sx - 12, sy - e.h / 2 - 10, 24, 4);
      c.fillStyle = '#e33'; c.fillRect(sx - 12, sy - e.h / 2 - 10, 24 * Math.max(0, e.hp / e.maxHp), 4);
    }
  },
  boss(c, sx, sy, b, t) {
    const flash = b.iframes > 0 && Math.floor(b.iframes * 20) % 2 === 0;
    c.save(); if (flash) c.globalAlpha = 0.5;
    if (b.kind === 'boss_gigaslime') {
      const sq = 1 + (b.squish || 0) * 0.3;
      c.fillStyle = '#7a2a9a';
      c.beginPath(); c.ellipse(sx, sy + 6, 30 * sq, 24 / sq, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5a1a7a'; c.beginPath(); c.ellipse(sx, sy + 18, 28 * sq, 10, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe066';
      c.beginPath(); c.moveTo(sx - 8, sy - 16); c.lineTo(sx - 4, sy - 26); c.lineTo(sx, sy - 16); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(sx, sy - 16); c.lineTo(sx + 4, sy - 26); c.lineTo(sx + 8, sy - 16); c.closePath(); c.fill();
      c.fillStyle = '#ff3030'; c.fillRect(sx - 10, sy, 4, 5); c.fillRect(sx + 6, sy, 4, 5);
    } else if (b.kind === 'boss_moleking') {
      if (b.phase === 'burrowed') {
        circ(c, sx, sy, 20 + Math.sin(t * 10) * 3, 'rgba(120,80,40,0.4)');
      } else {
        c.fillStyle = '#8a6a3a'; c.beginPath(); c.ellipse(sx, sy + 8, 32, 22, 0, 0, Math.PI * 2); c.fill();
        circ(c, sx, sy - 10, 16, '#6b4a2b');
        c.fillStyle = '#fff'; c.fillRect(sx - 8, sy - 6, 5, 8); c.fillRect(sx + 3, sy - 6, 5, 8);
        c.fillStyle = '#111'; c.fillRect(sx - 6, sy - 16, 3, 3); c.fillRect(sx + 3, sy - 16, 3, 3);
        c.fillStyle = '#c9743a';
        c.beginPath(); c.moveTo(sx - 26, sy + 4); c.lineTo(sx - 38, sy - 2); c.lineTo(sx - 30, sy + 12); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(sx + 26, sy + 4); c.lineTo(sx + 38, sy - 2); c.lineTo(sx + 30, sy + 12); c.closePath(); c.fill();
      }
    }
    c.restore();
  },
  shopkeeper(c, sx, sy) {
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(sx + 10, sy + 30, 11, 4, 0, 0, Math.PI * 2); c.fill();
    rect(c, sx + 2, sy + 14, 16, 16, '#8a3a3a');
    rect(c, sx + 4, sy, 12, 14, '#e8c090');
    rect(c, sx + 3, sy - 2, 14, 6, '#3a2818');
    c.fillStyle = '#222'; c.fillRect(sx + 7, sy + 6, 2, 2); c.fillRect(sx + 13, sy + 6, 2, 2);
  },
  groundGold(c, sx, sy, bob) { circ(c, sx, sy + bob, 6, '#ffd700'); circ(c, sx, sy + bob, 3, '#fff2a0'); },

  // ---------------- Icônes d'objets ----------------
  itemIcon(c, id, x, y, s) {
    c.save(); c.translate(x, y);
    (ICON[id] || ICON.default)(c, s);
    c.restore();
  },
};

function ir(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function ic(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

const ICON = {
  hoe(c, s) { ir(c, s * .45, s * .1, s * .1, s * .7, '#8a6a3a'); ir(c, s * .25, s * .72, s * .5, s * .14, '#999'); },
  wateringcan(c, s) { ir(c, s * .25, s * .4, s * .4, s * .35, '#3a7fc1'); ir(c, s * .6, s * .25, s * .28, s * .12, '#3a7fc1'); ir(c, s * .15, s * .3, s * .15, s * .15, '#3a7fc1'); },
  axe(c, s) { ir(c, s * .45, s * .15, s * .1, s * .7, '#8a6a3a'); ic(c, s * .5, s * .2, s * .18, '#b0b0b0'); },
  pickaxe(c, s) { ir(c, s * .45, s * .2, s * .1, s * .65, '#8a6a3a'); ir(c, s * .2, s * .12, s * .6, s * .14, '#909090'); },
  sword(c, s) { ir(c, s * .46, s * .15, s * .08, s * .55, '#d8d8e8'); ir(c, s * .3, s * .62, s * .4, s * .1, '#8a6a3a'); ir(c, s * .44, s * .72, s * .12, s * .16, '#6b4a2b'); },
  wood(c, s) { ir(c, s * .2, s * .35, s * .6, s * .3, '#8a6238'); ir(c, s * .2, s * .35, s * .6, s * .3, 'rgba(0,0,0,0.15)'); ic(c, s * .3, s * .5, s * .06, '#c9a769'); },
  stone(c, s) { ic(c, s * .5, s * .55, s * .32, '#9a9a9a'); ic(c, s * .38, s * .45, s * .1, '#b5b5b5'); },
  copper(c, s) { ic(c, s * .5, s * .55, s * .3, '#c9743a'); ic(c, s * .4, s * .45, s * .09, '#e0985a'); },
  iron(c, s) { ic(c, s * .5, s * .55, s * .3, '#b0b0c0'); ic(c, s * .4, s * .45, s * .09, '#d8d8e8'); },
  gold_ore(c, s) { ic(c, s * .5, s * .55, s * .3, '#d4af37'); ic(c, s * .4, s * .45, s * .09, '#ffe680'); },
  diamond(c, s) { c.fillStyle = '#7fe8e0'; c.beginPath(); c.moveTo(s * .5, s * .2); c.lineTo(s * .78, s * .5); c.lineTo(s * .5, s * .85); c.lineTo(s * .22, s * .5); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.moveTo(s * .5, s * .2); c.lineTo(s * .62, s * .5); c.lineTo(s * .5, s * .5); c.closePath(); c.fill(); },
  coal(c, s) { ic(c, s * .5, s * .55, s * .28, '#2a2a2a'); ic(c, s * .42, s * .46, s * .07, '#4a4a4a'); },
  bar_copper(c, s) { ir(c, s * .25, s * .4, s * .5, s * .22, '#c9743a'); ir(c, s * .28, s * .42, s * .44, s * .05, '#e0985a'); },
  bar_iron(c, s) { ir(c, s * .25, s * .4, s * .5, s * .22, '#c0c0d0'); ir(c, s * .28, s * .42, s * .44, s * .05, '#e8e8f0'); },
  bar_gold(c, s) { ir(c, s * .25, s * .4, s * .5, s * .22, '#e8c840'); ir(c, s * .28, s * .42, s * .44, s * .05, '#fff0a0'); },
  seed_wheat(c, s) { ir(c, s * .35, s * .3, s * .3, s * .4, '#e8d060'); ic(c, s * .5, s * .28, s * .1, '#c9a030'); },
  seed_strawberry(c, s) { ir(c, s * .35, s * .3, s * .3, s * .4, '#e8d060'); ic(c, s * .5, s * .28, s * .1, '#c0392b'); },
  seed_pumpkin(c, s) { ir(c, s * .35, s * .3, s * .3, s * .4, '#e8d060'); ic(c, s * .5, s * .28, s * .1, '#d9822b'); },
  seed_tomato(c, s) { ir(c, s * .35, s * .3, s * .3, s * .4, '#e8d060'); ic(c, s * .5, s * .28, s * .1, '#d43c2c'); },
  crop_wheat(c, s) { ir(c, s * .46, s * .2, s * .08, s * .55, '#c9a030'); ic(c, s * .5, s * .2, s * .16, '#e8d060'); },
  crop_strawberry(c, s) { ic(c, s * .5, s * .55, s * .28, '#c0392b'); ir(c, s * .42, s * .24, s * .16, s * .12, '#3a8a3a'); ic(c, s*.42,s*.55,s*.03,'#ffe'); ic(c, s*.58,s*.6,s*.03,'#ffe'); },
  crop_pumpkin(c, s) { ic(c, s * .5, s * .58, s * .32, '#d9822b'); ir(c, s * .46, s * .22, s * .08, s * .14, '#3a6b2a'); },
  crop_tomato(c, s) { ic(c, s * .5, s * .55, s * .28, '#d43c2c'); ir(c, s * .44, s * .26, s * .12, s * .1, '#3a8a3a'); },
  egg(c, s) { c.fillStyle = '#f0e8d0'; c.beginPath(); c.ellipse(s * .5, s * .55, s * .22, s * .3, 0, 0, Math.PI * 2); c.fill(); },
  milk(c, s) { ir(c, s * .3, s * .25, s * .4, s * .55, '#f0f0f0'); ir(c, s * .35, s * .2, s * .3, s * .1, '#3a7fc1'); },
  hay(c, s) { ir(c, s * .2, s * .35, s * .6, s * .35, '#d9b84a'); c.strokeStyle = '#a88a30'; c.beginPath(); c.moveTo(s * .25, s * .4); c.lineTo(s * .75, s * .65); c.stroke(); },
  fence_item(c, s) { ir(c, s * .28, s * .15, s * .12, s * .6, '#8a6a3a'); ir(c, s * .6, s * .15, s * .12, s * .6, '#8a6a3a'); ir(c, s * .2, s * .35, s * .6, s * .1, '#6b4a2b'); },
  chest_item(c, s) { ir(c, s * .15, s * .45, s * .7, s * .35, '#7a5230'); ir(c, s * .15, s * .3, s * .7, s * .18, '#8a6238'); },
  furnace_item(c, s) { ir(c, s * .2, s * .15, s * .6, s * .7, '#4a4a4a'); ir(c, s * .36, s * .5, s * .28, s * .25, '#ff8c1a'); },
  scarecrow_item(c, s) { ir(c, s * .46, s * .15, s * .08, s * .6, '#8a6a3a'); ic(c, s * .5, s * .2, s * .14, '#e8c090'); ir(c, s * .25, s * .4, s * .5, s * .2, '#c9a769'); },
  torch_item(c, s) { ir(c, s * .44, s * .4, s * .12, s * .5, '#6b4a2b'); ic(c, s * .5, s * .28, s * .16, '#ff8c1a'); },
  sword_upgrade(c, s) { ir(c, s * .46, s * .1, s * .08, s * .6, '#ffe066'); ir(c, s * .3, s * .65, s * .4, s * .1, '#8a6a3a'); c.fillStyle = '#fff8c0'; c.beginPath(); c.arc(s * .5, s * .18, s * .05, 0, Math.PI * 2); c.fill(); },
  pickaxe_upgrade(c, s) { ir(c, s * .46, s * .2, s * .08, s * .6, '#ffe066'); ir(c, s * .2, s * .12, s * .6, s * .14, '#ffd700'); },
  axe_upgrade(c, s) { ir(c, s * .46, s * .15, s * .08, s * .6, '#ffe066'); ic(c, s * .5, s * .2, s * .18, '#ffd700'); },
  cooked_meal(c, s) { ic(c, s * .5, s * .58, s * .3, '#e0b060'); ir(c, s * .3, s * .3, s * .4, s * .12, '#c05030'); ic(c, s * .5, s * .5, s * .08, '#8a3a2a'); },
  default(c, s) { ir(c, s * .3, s * .3, s * .4, s * .4, '#888'); },
};
