// ============================================================================
// FishingSystem — mini-jeu de pêche : lancer sur une tuile d'eau visée,
// attendre la touche (« ! »), puis réussir le timing (curseur oscillant dans
// la zone verte) pour attraper un poisson dont la rareté dépend du tirage et
// de la précision.
// ============================================================================

import { TILE, OT } from '../world/TileMap.js';

const rand = (a, b) => Math.random() * (b - a) + a;

const CATCHES = [
  { id: 'fish_carp', w: 40 },
  { id: 'fish_perch', w: 35 },
  { id: 'fish_trout', w: 20 },
  { id: 'fish_king', w: 5 },
];

export class FishingSystem {
  constructor(game) {
    this.game = game;
    this.state = null; // { phase:'wait'|'bite'|'reel', tile, t, ... }
  }

  get active() { return this.state !== null; }

  // Lancer : nécessite une tuile d'eau visée (portée 2).
  cast() {
    const g = this.game;
    if (this.active) { this.cancel(); return; }
    if (g.scene !== 'overworld') { g.toast('On ne pêche pas dans la mine.'); return; }
    const f = g.aimTile();
    if (g.overworld.tilemap.get(f.gx, f.gy) !== OT.WATER) { g.toast("Visez l'eau pour pêcher."); return; }
    if (g.player.stamina < 4) { g.toast('Trop fatigué pour pêcher.'); return; }
    g.player.stamina -= 4;
    this.state = { phase: 'wait', tile: f, t: rand(1.5, 4), bobPh: 0 };
    g.sound.play('water');
    g.toast('🎣 Ça mord bientôt...');
  }

  cancel() {
    this.state = null;
  }

  // Clic pendant la pêche. Retourne true si le clic a été consommé.
  onClick() {
    const g = this.game, s = this.state;
    if (!s) return false;
    if (s.phase === 'wait') { this.cancel(); g.toast('Ligne remontée.'); return true; }
    if (s.phase === 'bite') {
      // Ferré ! → mini-jeu de timing
      s.phase = 'reel';
      s.cursor = 0; s.dir = 1;
      s.speed = rand(1.6, 2.4);
      s.zoneStart = rand(0.15, 0.55);
      s.zoneW = rand(0.18, 0.28);
      g.sound.play('ui');
      return true;
    }
    if (s.phase === 'reel') {
      const inZone = s.cursor >= s.zoneStart && s.cursor <= s.zoneStart + s.zoneW;
      if (inZone) this._catch();
      else { g.toast('Le poisson s\'est échappé...'); g.sound.play('eat'); this.cancel(); }
      return true;
    }
    return false;
  }

  _catch() {
    const g = this.game, s = this.state;
    // précision : proche du centre de la zone → bonus de rareté
    const center = s.zoneStart + s.zoneW / 2;
    const acc = 1 - Math.abs(s.cursor - center) / (s.zoneW / 2);
    let total = 0; for (const c of CATCHES) total += c.w;
    let roll = Math.random() * total * (acc > 0.7 ? 0.8 : 1); // bonne précision → tire vers les rares
    let fish = CATCHES[0].id;
    for (const c of CATCHES) { roll -= c.w; if (roll <= 0) { fish = c.id; break; } }
    if (acc > 0.85 && Math.random() < 0.25) fish = 'fish_trout';
    g.inventory.add(fish, 1);
    g.loot(fish, 1);
    g.sound.play('questdone');
    g.particles.splash(s.tile.wx, s.tile.wy, '#bfe8ff', 12);
    g.floatText(g.player.cx, g.player.y - 10, '🐟 Attrapé !', '#7fd0ff', true);
    g.quests.onFish && g.quests.onFish(fish);
    g.hud.renderHotbar();
    this.cancel();
  }

  update(dt) {
    const g = this.game, s = this.state;
    if (!s) return;
    // bouger annule la pêche
    if (g.player.moving) { this.cancel(); return; }
    s.bobPh = (s.bobPh || 0) + dt * 3;
    if (s.phase === 'wait') {
      s.t -= dt;
      if (s.t <= 0) {
        s.phase = 'bite'; s.t = 0.9;
        g.sound.play('pickup');
        g.camera.shake(2, 0.12);
      }
    } else if (s.phase === 'bite') {
      s.t -= dt;
      if (s.t <= 0) { g.toast('Trop lent ! Le poisson est parti.'); this.cancel(); }
    } else if (s.phase === 'reel') {
      s.cursor += s.dir * s.speed * dt;
      if (s.cursor > 1) { s.cursor = 1; s.dir = -1; }
      if (s.cursor < 0) { s.cursor = 0; s.dir = 1; }
    }
  }

  // Rendu (appelé par RenderManager au-dessus de la scène).
  render(ctx, cam) {
    const g = this.game, s = this.state;
    if (!s) return;
    const p = g.player;
    const bx = s.tile.wx - cam.x, by = s.tile.wy - cam.y + Math.sin(s.bobPh) * 2;
    // ligne
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.cx - cam.x, p.y - cam.y + 4); ctx.lineTo(bx, by - 4); ctx.stroke();
    // bouchon
    ctx.fillStyle = '#e33'; ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by - 2, 2, 0, Math.PI * 2); ctx.fill();
    // ondulations
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(bx, by, 7 + Math.sin(s.bobPh * 2) * 2, 0, Math.PI * 2); ctx.stroke();

    if (s.phase === 'bite') {
      ctx.font = "bold 22px 'VT323', monospace"; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText('!', p.cx - cam.x + 1, p.y - cam.y - 14);
      ctx.fillStyle = '#ffe24a'; ctx.fillText('!', p.cx - cam.x, p.y - cam.y - 15);
      ctx.textAlign = 'left';
    } else if (s.phase === 'reel') {
      // barre de timing au-dessus du joueur
      const w = 120, h = 14;
      const x = p.cx - cam.x - w / 2, y = p.y - cam.y - 34;
      ctx.fillStyle = 'rgba(10,8,6,0.85)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = '#26303a'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#3fae4e'; ctx.fillRect(x + s.zoneStart * w, y, s.zoneW * w, h);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + s.cursor * w - 1.5, y - 2, 3, h + 4);
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    }
  }
}
