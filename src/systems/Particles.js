// ============================================================================
// Particles — système de particules générique (monde). Poussière de pas,
// étincelles, éclats de mort, embers de torche, fumée, éclaboussures.
// ============================================================================

const rand = (a, b) => Math.random() * (b - a) + a;

export class Particles {
  constructor() { this.list = []; this.max = 500; }

  _push(p) { this.list.push(p); if (this.list.length > this.max) this.list.splice(0, this.list.length - this.max); }

  dust(x, y, n = 5) {
    for (let i = 0; i < n; i++) this._push({
      x, y: y - 2, vx: rand(-24, 24), vy: rand(-40, -10), grav: 60,
      life: rand(0.3, 0.6), maxLife: 0.6, r: rand(1.5, 3), col: '#d8c8a8', kind: 'dust',
    });
  }
  splash(x, y, col = '#bfe8ff', n = 8) {
    for (let i = 0; i < n; i++) this._push({
      x, y, vx: rand(-60, 60), vy: rand(-90, -30), grav: 240,
      life: rand(0.25, 0.5), maxLife: 0.5, r: rand(1.5, 3), col, kind: 'dust',
    });
  }
  hit(x, y, col = '#ffffff', n = 8) {
    for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(40, 140); this._push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, grav: 120,
      life: rand(0.3, 0.55), maxLife: 0.55, r: rand(1.5, 3.5), col, kind: 'spark',
    }); }
  }
  death(x, y, col = '#ffffff', n = 16) {
    for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(30, 180); this._push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, grav: 160,
      life: rand(0.4, 0.9), maxLife: 0.9, r: rand(2, 4), col, kind: 'spark',
    }); }
  }
  sparkle(x, y, col = '#fff4a0', n = 6) {
    for (let i = 0; i < n; i++) this._push({
      x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-10, 10), vy: rand(-30, -8), grav: 20,
      life: rand(0.4, 0.8), maxLife: 0.8, r: rand(1, 2.2), col, kind: 'twinkle',
    });
  }
  ember(x, y) {
    this._push({ x: x + rand(-3, 3), y, vx: rand(-6, 6), vy: rand(-30, -14), grav: -8,
      life: rand(0.5, 1.0), maxLife: 1.0, r: rand(1, 2), col: '#ff9a3a', kind: 'ember' });
  }
  smoke(x, y) {
    this._push({ x: x + rand(-2, 2), y, vx: rand(-6, 6), vy: rand(-22, -12), grav: -4,
      life: rand(1.2, 2.0), maxLife: 2.0, r: rand(3, 5), grow: rand(6, 12), col: '200,200,205', kind: 'smoke' });
  }
  leaf(x, y, col = '#c9772a') {
    this._push({ x, y, vx: rand(-30, -8), vy: rand(10, 26), grav: 6, sway: rand(1, 3), ph: rand(0, 6.28),
      life: rand(1.5, 2.5), maxLife: 2.5, r: rand(2.5, 4), col, kind: 'leaf' });
  }

  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += (p.grav || 0) * dt;
      if (p.kind === 'leaf') { p.ph += dt * 3; p.x += (p.vx + Math.sin(p.ph) * p.sway * 8) * dt; }
      else p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.grow) p.r += p.grow * dt;
    }
    this.list = this.list.filter(p => p.life > 0);
  }

  draw(ctx, cam) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.maxLife);
      const x = p.x - cam.x, y = p.y - cam.y;
      if (p.kind === 'smoke') { ctx.fillStyle = `rgba(${p.col},${a * 0.35})`; ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill(); continue; }
      if (p.kind === 'ember') { ctx.globalAlpha = a; ctx.fillStyle = a > 0.5 ? '#ffd27a' : '#ff7a2a'; ctx.fillRect(x - 1, y - 1, 2, 2); ctx.globalAlpha = 1; continue; }
      if (p.kind === 'twinkle') { ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.fillRect(x - p.r, y, p.r * 2, 1); ctx.fillRect(x, y - p.r, 1, p.r * 2); ctx.globalAlpha = 1; continue; }
      if (p.kind === 'leaf') { ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(p.ph); ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); continue; }
      ctx.globalAlpha = a; ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(x, y, p.r * (p.kind === 'spark' ? a + 0.4 : 1), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
