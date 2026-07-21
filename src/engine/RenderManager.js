// ============================================================================
// RenderManager — tout le pipeline de rendu, extrait de Game.js :
// scène (overworld/mine avec tuiles mises en cache), entités triées en
// profondeur, ambiance, météo, nuit, color grading, bloom, éclairs, textes
// flottants, réticule de visée, prévisualisation de placement, écran-titre.
// ============================================================================

import { TILE, OT, MT, TileMap } from '../world/TileMap.js';
import { BIOMES } from '../world/MineGenerator.js';
import { Sprites, CachedTiles } from '../graphics/SpriteSheetGenerator.js';
import { PostFX } from '../graphics/PostFX.js';
import { ITEMS } from '../systems/Inventory.js';

const rand = (a, b) => Math.random() * (b - a) + a;

export class RenderManager {
  constructor(game) {
    this.g = game;
    this.ctx = game.ctx;
    this.postfx = new PostFX(game.canvas);
    this.nightCanvas = document.createElement('canvas');
    this.nightCtx = this.nightCanvas.getContext('2d');
    this._sun = { skew: 0, alpha: 0 };
    this.titleActive = false;
  }

  resize() {
    this.nightCanvas.width = this.g.canvas.width;
    this.nightCanvas.height = this.g.canvas.height;
    this.postfx.resize();
  }

  // ---------------- Pipeline principal ----------------
  render() {
    const g = this.g, ctx = this.ctx;
    this._computeSun();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
    if (g.scene === 'overworld') this._renderOverworld();
    else this._renderMine();
    g.particles.draw(ctx, g.camera);
    g.fishing.render(ctx, g.camera);
    this._renderAmbient();
    this._renderPlacementPreview();
    this._renderAimHighlight();
    this._renderWeather();
    this._renderNight();
    this.postfx.applyGrade(ctx, this._computeGrade());
    this._renderLights();
    this._renderLightning();
    this._renderFloatTexts();
    this.postfx.grain(ctx, 0.04);
    this.postfx.vignette(ctx, 0.32);
  }

  _roofColorAt(gx, gy) {
    for (const b of this.g.overworld.buildings) if (b.y === gy && gx >= b.x && gx < b.x + b.w) return b.roof;
    return '#8a3a34';
  }

  // ---------------- Overworld ----------------
  _renderOverworld() {
    const g = this.g, ctx = this.ctx, ow = g.overworld, cam = g.camera, season = g.time.seasonKey;
    const sx0 = Math.max(0, (cam.x / TILE) | 0), sy0 = Math.max(0, (cam.y / TILE) | 0);
    const sx1 = Math.min(ow.w, ((cam.x + g.canvas.width) / TILE | 0) + 1);
    const sy1 = Math.min(ow.h, ((cam.y + g.canvas.height) / TILE | 0) + 1);
    const T = ow.tilemap;
    const edgeMask = (gx, gy, val, isWater) => {
      const diff = (v) => isWater ? (v !== OT.WATER && v !== -1) : (v !== val && v !== -1);
      return { n: diff(T.get(gx, gy - 1)), s: diff(T.get(gx, gy + 1)), e: diff(T.get(gx + 1, gy)), w: diff(T.get(gx - 1, gy)) };
    };

    for (let gy = sy0; gy < sy1; gy++) for (let gx = sx0; gx < sx1; gx++) {
      const t = T.get(gx, gy);
      const x = gx * TILE - cam.x, y = gy * TILE - cam.y, v = (gx * 7 + gy * 13) % 9;
      if (t === OT.WATER || t === OT.BRIDGE) Sprites.water(ctx, x, y, g.globalT, edgeMask(gx, gy, OT.WATER, true), gx, gy);
      else if (t === OT.PATH) Sprites.path(ctx, x, y, v, edgeMask(gx, gy, OT.PATH, false), gx, gy);
      else if (t === OT.FARMLAND) { const pl = ow.farmland[gx + ',' + gy]; CachedTiles.farmland(ctx, x, y, !!(pl && pl.watered)); }
      else CachedTiles.grass(ctx, x, y, season, gx, gy);
      if (t === OT.WALL) CachedTiles.wall(ctx, x, y, T.get(gx, gy - 1) !== OT.WALL, this._roofColorAt(gx, gy));
      else if (t === OT.BED) Sprites.bed(ctx, x, y);
      else if (t === OT.QUESTBOARD) Sprites.questBoard(ctx, x, y);
      else if (t === OT.SHOPCOUNTER) Sprites.shopCounter(ctx, x, y);
      else if (t === OT.MINE_ENTRANCE) Sprites.mineEntrance(ctx, x, y);
      else if (t === OT.FENCE) CachedTiles.fence(ctx, x, y);
      else if (t === OT.ROCK) CachedTiles.rock(ctx, x, y);
      else if (t === OT.BUSH) { const b = ow.bushes[gx + ',' + gy]; Sprites.bush(ctx, x, y, !!(b && b.ready)); }
      else if (t === OT.BRIDGE) Sprites.bridge(ctx, x, y, true);
      else if (t === OT.FARMLAND) { const pl = ow.farmland[gx + ',' + gy]; if (pl && pl.cropId) Sprites.cropStage(ctx, x, y, pl.cropId, pl.stage); }
    }

    for (const b of ow.buildings) {
      const fy = (b.y + b.h - 1) * TILE - cam.y;
      Sprites.window(ctx, b.x * TILE - cam.x, fy);
      Sprites.window(ctx, (b.x + b.w - 1) * TILE - cam.x, fy);
      if (b.type === 'deco') Sprites.door(ctx, (b.x + (b.w / 2 | 0)) * TILE - cam.x, fy);
    }

    this._renderClouds();

    const drawables = [];
    for (let gy = sy0; gy < sy1; gy++) for (let gx = sx0; gx < sx1; gx++)
      if (ow.tilemap.get(gx, gy) === OT.TREE)
        drawables.push({ y: gy * TILE + TILE, fn: () => {
          this._sunShadow(gx * TILE + TILE / 2 - cam.x, gy * TILE + TILE - 2 - cam.y, 15, 9);
          Sprites.tree(ctx, gx * TILE - cam.x, gy * TILE - cam.y, g.globalT, season, gx * 3 + gy);
        } });
    for (const o of ow.placed) {
      if (o.type === 'fence') continue;
      const x = o.gx * TILE - cam.x, y = o.gy * TILE - cam.y;
      drawables.push({ y: o.gy * TILE + TILE, fn: () => {
        if (o.type === 'chest') Sprites.chest(ctx, x, y);
        else if (o.type === 'furnace') Sprites.furnace(ctx, x, y, g.globalT);
        else if (o.type === 'scarecrow') Sprites.scarecrow(ctx, x, y);
        else if (o.type === 'torch') Sprites.torch(ctx, x, y, g.globalT, o.gx * 3 + o.gy);
      } });
    }
    drawables.push({ y: g.shopPos.y, fn: () => Sprites.shopkeeper(ctx, g.shopPos.x - cam.x, g.shopPos.y - cam.y - 14) });
    for (const vil of ow.villagers) drawables.push({ y: vil.y, fn: () => Sprites.villager(ctx, vil.x - cam.x, vil.y - cam.y, vil) });
    for (const a of ow.animals) drawables.push({ y: a.y, fn: () => (a.kind === 'chicken' ? Sprites.chicken : Sprites.cow)(ctx, a.x - cam.x, a.y - cam.y, a) });
    for (const gr of ow.ground) drawables.push({ y: gr.y, fn: () => this._drawGround(gr) });
    drawables.push({ y: g.player.y + g.player.h, fn: () => this._drawPlayer() });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
  }

  // ---------------- Mine (avec biome) ----------------
  _renderMine() {
    const g = this.g, ctx = this.ctx, m = g.mine, cam = g.camera;
    const biome = BIOMES[m.biome] || BIOMES.rock, bk = m.biome || 'rock';
    const sx0 = Math.max(0, (cam.x / TILE) | 0), sy0 = Math.max(0, (cam.y / TILE) | 0);
    const sx1 = Math.min(m.w, ((cam.x + g.canvas.width) / TILE | 0) + 1);
    const sy1 = Math.min(m.h, ((cam.y + g.canvas.height) / TILE | 0) + 1);
    for (let gy = sy0; gy < sy1; gy++) for (let gx = sx0; gx < sx1; gx++) {
      const t = m.tilemap.get(gx, gy), x = gx * TILE - cam.x, y = gy * TILE - cam.y;
      if (t === MT.WALL) CachedTiles.mineWall(ctx, x, y, biome, bk);
      else if (t === MT.ORE_COPPER) CachedTiles.mineOre(ctx, x, y, 'copper', biome, bk);
      else if (t === MT.ORE_IRON) CachedTiles.mineOre(ctx, x, y, 'iron', biome, bk);
      else if (t === MT.ORE_GOLD) CachedTiles.mineOre(ctx, x, y, 'gold', biome, bk);
      else if (t === MT.ORE_DIAMOND) CachedTiles.mineOre(ctx, x, y, 'diamond', biome, bk);
      else if (t === MT.STAIRS || t === MT.STAIRS_SEALED) { CachedTiles.mineFloor(ctx, x, y, biome, bk, gx, gy); Sprites.stairsDown(ctx, x, y, t === MT.STAIRS_SEALED); }
      else if (t === MT.ENTRANCE) Sprites.mineEntranceTile(ctx, x, y, gx, gy, biome);
      else if (t === MT.PIT) Sprites.pit(ctx, x, y, biome);
      else if (t === MT.BRIDGE) Sprites.bridge(ctx, x, y, false);
      else CachedTiles.mineFloor(ctx, x, y, biome, bk, gx, gy);
    }
    // pièges
    for (const tr of m.traps) Sprites.trap(ctx, tr.gx * TILE - cam.x, tr.gy * TILE - cam.y, tr.type, g.globalT);

    for (const o of m.placed) {
      const x = o.gx * TILE - cam.x, y = o.gy * TILE - cam.y;
      if (o.type === 'chest') Sprites.chest(ctx, x, y);
      else if (o.type === 'torch') Sprites.torch(ctx, x, y, g.globalT, o.gx * 3 + o.gy);
    }
    const drawables = [];
    for (const gr of m.ground) drawables.push({ y: gr.y, fn: () => this._drawGround(gr) });
    for (const e of m.enemies) drawables.push({ y: e.y, fn: () => Sprites.enemy(ctx, e.x - cam.x, e.y - cam.y, e) });
    if (m.boss) drawables.push({ y: m.boss.y, fn: () => Sprites.boss(ctx, m.boss.x - cam.x, m.boss.y - cam.y, m.boss, g.globalT) });
    drawables.push({ y: g.player.y + g.player.h, fn: () => this._drawPlayer() });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();

    for (const sw of g.effects.shockwaves) {
      ctx.strokeStyle = `rgba(255,120,40,${Math.max(0, sw.life / 0.6)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(sw.x - cam.x, sw.y - cam.y, sw.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const r of g.effects.fallingRocks) {
      const x = r.x - cam.x, y = r.y - cam.y;
      if (!r.done) { const t = r.t / r.warn; ctx.strokeStyle = `rgba(255,50,50,${0.4 + 0.4 * Math.sin(t * 20)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke(); }
      else Sprites.rock(ctx, x - 16, y - 16);
    }
  }

  _drawPlayer() {
    const g = this.g, ctx = this.ctx, p = g.player;
    const sx = p.x - g.camera.x, sy = p.y - g.camera.y;
    this._sunShadow(sx + p.w / 2, sy + p.h + 2, 10, 6);
    Sprites.player(ctx, sx, sy, p);
    if (p.attackTimer > 0) Sprites.swordSwing(ctx, sx, sy, p);
  }

  _drawGround(gr) {
    const g = this.g, ctx = this.ctx;
    const sx = gr.x - g.camera.x, sy = gr.y - g.camera.y;
    const bob = Math.sin(g.globalT * 4 + (gr.id || 0)) * 2;
    if (gr.kind === 'gold') Sprites.groundGold(ctx, sx, sy, bob);
    else Sprites.itemIcon(ctx, gr.item, sx - 9, sy - 9 + bob, 18);
  }

  // ---------------- Overlays ----------------
  _renderPlacementPreview() {
    const g = this.g;
    const sel = g.inventory.selectedItem;
    if (!sel || ITEMS[sel.id].type !== 'placeable') return;
    const { gx, gy } = g.placementCell();
    const valid = g.placementValid(gx, gy);
    const x = gx * TILE - g.camera.x, y = gy * TILE - g.camera.y, ctx = this.ctx;
    ctx.fillStyle = valid ? 'rgba(80,220,80,0.4)' : 'rgba(220,60,60,0.4)';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = valid ? '#5f5' : '#f55'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
  }

  _renderAimHighlight() {
    const g = this.g;
    if (g.anyModalOpen() || g.faint) return;
    const sel = g.inventory.selectedItem;
    if (!sel) return;
    const it = ITEMS[sel.id];
    if (!(it.type === 'seed' || (it.type === 'tool' && it.tool !== 'sword'))) return;
    const { gx, gy } = g.aimTile();
    let valid = false;
    if (g.scene === 'overworld') {
      const t = g.overworld.tilemap.get(gx, gy);
      const plot = g.overworld.farmland[gx + ',' + gy];
      if (it.type === 'seed') valid = !!(plot && plot.tilled && !plot.cropId);
      else if (it.tool === 'hoe') valid = t === OT.GRASS;
      else if (it.tool === 'water') valid = t === OT.FARMLAND;
      else if (it.tool === 'axe') valid = t === OT.TREE;
      else if (it.tool === 'pickaxe') valid = t === OT.ROCK;
      else if (it.tool === 'fish') valid = t === OT.WATER;
    } else if (it.tool === 'pickaxe' || it.tool === 'axe') {
      const t = g.mine.tilemap.get(gx, gy);
      valid = t === MT.WALL || TileMap.isOreMine(t);
    }
    const x = gx * TILE - g.camera.x, y = gy * TILE - g.camera.y, ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = valid ? 'rgba(255,255,255,0.9)' : 'rgba(255,110,110,0.7)';
    ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = (g.globalT * 8) % 9;
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.setLineDash([]);
    if (valid) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4); }
    ctx.restore();
  }

  _renderFloatTexts() {
    const g = this.g, ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const f of g.effects.floatTexts) {
      ctx.font = (f.big ? 'bold 18px' : 'bold 14px') + " 'VT323', monospace";
      const sx = f.x - g.camera.x, sy = f.y - g.camera.y;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.9));
      ctx.fillStyle = '#000'; ctx.fillText(f.text, sx + 1, sy + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  _renderWeather() {
    const g = this.g;
    if (!g._weatherKind || g.scene !== 'overworld') return;
    const ctx = this.ctx;
    if (g._weatherKind === 'rain') {
      ctx.strokeStyle = 'rgba(150,180,230,0.5)'; ctx.lineWidth = 1.5;
      for (const p of g.effects.weatherParticles) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 3, p.y + 12); ctx.stroke(); }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const p of g.effects.weatherParticles) { ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  _renderAmbient() {
    const g = this.g;
    if (g.scene !== 'overworld') return;
    const ctx = this.ctx;
    for (const p of g.effects.ambient) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = 0.85;
      ctx.fillStyle = p.col;
      if (p.kind === 'mote') { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(0, 0, p.sz, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.ellipse(0, 0, p.sz, p.sz * 0.55, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const daytime = g.time.ambient().alpha < 0.35 && !g.time.isRaining;
    if (daytime) {
      const cam = g.camera;
      for (const b of g.effects.butterflies) {
        const x = b.x - cam.x, y = b.y - cam.y;
        if (x < -20 || x > g.canvas.width + 20 || y < -20 || y > g.canvas.height + 20) continue;
        const flap = Math.abs(Math.sin(b.ph)) * 4 + 1;
        ctx.fillStyle = b.col;
        ctx.beginPath(); ctx.ellipse(x - 2, y, flap, 3.5, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 2, y, flap, 3.5, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x - 0.5, y - 2, 1, 4);
      }
    }
    if (g._firefliesActive()) {
      for (const f of g.effects.fireflies) {
        const a = 0.5 + Math.sin(f.ph) * 0.5;
        ctx.globalAlpha = a; ctx.fillStyle = '#eaffa0';
        ctx.beginPath(); ctx.arc(f.x, f.y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  _renderClouds() {
    const g = this.g;
    if (g.scene !== 'overworld' || g.time.isRaining) return;
    const ctx = this.ctx, cam = g.camera;
    ctx.save();
    for (const c of g.effects.clouds) {
      const x = c.x - cam.x, y = c.y - cam.y;
      if (x + c.rx < 0 || x - c.rx > g.canvas.width) continue;
      const gr = ctx.createRadialGradient(x, y, 10, x, y, c.rx);
      gr.addColorStop(0, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, c.rx, c.ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _renderLightning() {
    const g = this.g, L = g._lightning, ctx = this.ctx;
    if (L.flash > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(200,215,255,${Math.min(0.7, L.flash * 0.7)})`;
      ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
      ctx.restore();
    }
    if (L.boltT > 0 && L.bolt) {
      ctx.save();
      ctx.strokeStyle = 'rgba(235,240,255,0.95)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(180,200,255,0.9)'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(L.bolt[0].x, L.bolt[0].y);
      for (const pt of L.bolt) ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  _renderNight() {
    const g = this.g;
    let info;
    if (g.scene === 'mine') info = { alpha: 0.6, color: '10,10,18' };
    else info = g.time.ambient();
    if (info.alpha <= 0.01) return;
    const nc = this.nightCtx, W = this.nightCanvas.width, H = this.nightCanvas.height;
    nc.clearRect(0, 0, W, H);
    nc.globalCompositeOperation = 'source-over';
    nc.fillStyle = `rgba(${info.color},${info.alpha})`;
    nc.fillRect(0, 0, W, H);

    nc.globalCompositeOperation = 'destination-out';
    const p = g.player;
    const psx = p.cx - g.camera.x, psy = p.cy - g.camera.y;
    const grad = nc.createRadialGradient(psx, psy, 10, psx, psy, 200);
    grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    nc.fillStyle = grad; nc.beginPath(); nc.arc(psx, psy, 200, 0, Math.PI * 2); nc.fill();

    for (const o of g.curScene().placed) {
      if (o.type !== 'torch') continue;
      const tx = o.gx * TILE + TILE / 2 - g.camera.x, ty = o.gy * TILE + TILE / 2 - g.camera.y;
      const g2 = nc.createRadialGradient(tx, ty, 4, tx, ty, 120);
      g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
      nc.fillStyle = g2; nc.beginPath(); nc.arc(tx, ty, 120, 0, Math.PI * 2); nc.fill();
    }
    nc.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.nightCanvas, 0, 0);
  }

  // ---------------- Soleil / grade / bloom ----------------
  _computeSun() {
    const g = this.g;
    if (g.scene !== 'overworld') { this._sun = { skew: 0, alpha: 0 }; return; }
    const amb = g.time.ambient();
    const daylight = Math.max(0, 1 - amb.alpha * 1.7);
    const skew = Math.max(-1.4, Math.min(1.4, (g.time.hour - 13) / 6));
    this._sun = { skew, alpha: 0.3 * daylight };
  }

  _sunShadow(cx, baseY, rx, ry) {
    const s = this._sun; if (!s || s.alpha <= 0.02) return;
    const off = -s.skew * ry * 1.4;
    const c = this.ctx;
    c.save(); c.globalAlpha = s.alpha; c.fillStyle = '#0a0a14';
    c.beginPath(); c.ellipse(cx + off * 0.5, baseY, rx + Math.abs(off) * 0.5, ry * 0.5, 0, 0, Math.PI * 2); c.fill();
    c.restore(); c.globalAlpha = 1;
  }

  _computeGrade() {
    const g = this.g, out = [];
    if (g.scene === 'mine') return (BIOMES[g.mine.biome] || BIOMES.rock).grade;
    const h = g.time.hour, w = g.time.weather;
    if (w === 'eclipse') { out.push({ op: 'multiply', color: '#3a1030', alpha: 0.5 }); out.push({ op: 'soft-light', color: '#7a1050', alpha: 0.42 }); return out; }
    if (w === 'rain') { out.push({ op: 'saturation', color: '#808080', alpha: 0.38 }); out.push({ op: 'multiply', color: '#4a5a72', alpha: 0.30 }); out.push({ op: 'soft-light', color: '#38507a', alpha: 0.34 }); return out; }
    if (w === 'snow') { out.push({ op: 'soft-light', color: '#a8c4e4', alpha: 0.32 }); out.push({ op: 'screen', color: '#20304a', alpha: 0.12 }); return out; }
    if (h >= 6 && h < 8) { out.push({ op: 'soft-light', color: '#ff9a6a', alpha: 0.40 }); out.push({ op: 'multiply', color: '#ffdcc4', alpha: 0.14 }); }
    else if (h >= 8 && h < 16) { out.push({ op: 'soft-light', color: '#fff2c0', alpha: 0.18 }); }
    else if (h >= 16 && h < 19) { out.push({ op: 'soft-light', color: '#ffb04a', alpha: 0.44 }); out.push({ op: 'multiply', color: '#ffe0b0', alpha: 0.16 }); }
    else { out.push({ op: 'multiply', color: '#26304e', alpha: 0.34 }); out.push({ op: 'soft-light', color: '#3a4e82', alpha: 0.42 }); }
    return out;
  }

  _renderLights() {
    const g = this.g, fx = this.postfx, cam = g.camera, p = g.player;
    fx.beginLights();
    const amb = g.scene === 'overworld' ? g.time.ambient() : { alpha: 0.6 };
    const night = amb.alpha > 0.35;
    const flick = 0.8 + Math.sin(g.globalT * 12) * 0.2;

    if (night || g.scene === 'mine') fx.addLight(p.cx - cam.x, p.cy - cam.y, 170, '255,180,95', night ? 0.62 : 0.5);

    for (const o of g.curScene().placed) {
      const lx = o.gx * TILE + TILE / 2 - cam.x, ly = o.gy * TILE + TILE / 2 - cam.y;
      if (o.type === 'torch') fx.addLight(lx, ly - 6, 118, '255,150,55', (night ? 0.9 : 0.45) * flick);
      else if (o.type === 'furnace') fx.addLight(lx, ly, 88, '255,120,40', 0.62 * flick);
    }
    for (const gr of g.curScene().ground) if (gr.kind === 'gold') fx.addLight(gr.x - cam.x, gr.y - cam.y, 34, '255,215,90', 0.5);

    if (g.scene === 'overworld') {
      const ow = g.overworld;
      const sx0 = Math.max(0, (cam.x / TILE) | 0), sy0 = Math.max(0, (cam.y / TILE) | 0);
      const sx1 = Math.min(ow.w, ((cam.x + g.canvas.width) / TILE | 0) + 1);
      const sy1 = Math.min(ow.h, ((cam.y + g.canvas.height) / TILE | 0) + 1);
      for (let gy = sy0; gy < sy1; gy++) for (let gx = sx0; gx < sx1; gx++) {
        const pl = ow.farmland[gx + ',' + gy];
        if (pl && pl.cropId && pl.stage >= 3) fx.addLight(gx * TILE + 16 - cam.x, gy * TILE + 13 - cam.y, 26, '255,240,150', 0.4);
      }
      if (g._firefliesActive()) for (const f of g.effects.fireflies) fx.addLight(f.x, f.y, 22, '200,255,140', 0.5 + Math.sin(f.ph) * 0.4);
      if (night) for (const b of ow.buildings) {
        const wy = (b.y + b.h - 1) * TILE + 16 - cam.y;
        fx.addLight(b.x * TILE + 16 - cam.x, wy, 44, '255,190,90', 0.5);
        fx.addLight((b.x + b.w - 1) * TILE + 16 - cam.x, wy, 44, '255,190,90', 0.5);
      }
    } else {
      if (g.mine.boss) {
        const b = g.mine.boss;
        fx.addLight(b.x - cam.x, b.y - cam.y, 60, b.kind === 'boss_gigaslime' ? '180,80,220' : '255,90,60', 0.5);
      }
      // les pièges de lave irradient
      for (const tr of g.mine.traps) if (tr.type === 'lava')
        fx.addLight(tr.gx * TILE + 16 - cam.x, tr.gy * TILE + 16 - cam.y, 52, '255,110,30', 0.55 * flick);
    }
    fx.compositeLights(this.ctx);
  }

  // ---------------- Écran-titre animé ----------------
  startTitle() {
    this._titleStars = [];
    for (let i = 0; i < 90; i++) this._titleStars.push({ x: Math.random(), y: Math.random() * 0.55, ph: rand(0, 6.28), sp: rand(1.5, 4) });
    this._titleClouds = [];
    for (let i = 0; i < 5; i++) this._titleClouds.push({ x: rand(0, 1), y: rand(0.12, 0.4), s: rand(0.006, 0.014), w: rand(90, 190) });
    this._titleFire = [];
    for (let i = 0; i < 24; i++) this._titleFire.push({ x: Math.random(), y: rand(0.55, 1), ph: rand(0, 6.28) });
    this.titleActive = true;
    this._titleT = 0; this._titleLast = 0;
    document.body.classList.add('in-title');
    requestAnimationFrame((t) => this._titleLoop(t));
  }
  stopTitle() { this.titleActive = false; document.body.classList.remove('in-title'); }

  _titleLoop(ts) {
    if (!this.titleActive) return;
    if (!this._titleLast) this._titleLast = ts;
    const dt = Math.min(0.05, (ts - this._titleLast) / 1000);
    this._titleLast = ts; this._titleT += dt;
    this._renderTitle(dt);
    requestAnimationFrame((t) => this._titleLoop(t));
  }

  _renderTitle(dt) {
    const ctx = this.ctx, W = this.g.canvas.width, H = this.g.canvas.height, t = this._titleT;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#140a2e'); sky.addColorStop(0.4, '#3b2560'); sky.addColorStop(0.62, '#8a4a5a'); sky.addColorStop(0.72, '#e8894a');
    sky.addColorStop(0.74, '#3a6b3a'); sky.addColorStop(1, '#1f3a24');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const horizon = H * 0.72;

    for (const s of this._titleStars) {
      const a = 0.4 + Math.sin(t * s.sp + s.ph) * 0.4;
      ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = '#fff';
      ctx.fillRect(s.x * W, s.y * horizon, 2, 2);
    }
    ctx.globalAlpha = 1;

    const mx = W * 0.76, my = horizon * 0.42;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 150);
    halo.addColorStop(0, 'rgba(255,225,180,0.5)'); halo.addColorStop(1, 'rgba(255,225,180,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(mx, my, 150, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffe9c0'; ctx.beginPath(); ctx.arc(mx, my, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(210,180,140,0.5)';
    ctx.beginPath(); ctx.arc(mx - 14, my - 8, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 12, my + 10, 6, 0, Math.PI * 2); ctx.fill();

    for (const c of this._titleClouds) {
      c.x += c.s * dt * 6; if (c.x > 1.2) c.x = -0.2;
      const cx = c.x * W, cy = c.y * horizon;
      ctx.fillStyle = 'rgba(60,40,80,0.5)';
      ctx.beginPath(); ctx.ellipse(cx, cy, c.w, c.w * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + c.w * 0.6, cy + 6, c.w * 0.7, c.w * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    }

    const hill = (baseY, amp, colr, phase) => {
      ctx.fillStyle = colr; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 12) ctx.lineTo(x, baseY + Math.sin(x * 0.006 + phase) * amp);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    };
    hill(horizon + 20, 18, '#2f5230', 0.5 + t * 0.05);
    hill(horizon + 70, 26, '#25401f', 1.7 - t * 0.04);
    hill(horizon + 130, 34, '#1a2e16', 3.0 + t * 0.03);

    const treeSil = (x, y, s) => {
      ctx.fillStyle = '#132611';
      ctx.fillRect(x - 2 * s, y, 4 * s, 14 * s);
      ctx.beginPath(); ctx.arc(x, y - 2 * s, 12 * s, 0, Math.PI * 2);
      ctx.arc(x - 9 * s, y + 3 * s, 8 * s, 0, Math.PI * 2);
      ctx.arc(x + 9 * s, y + 3 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
    };
    treeSil(W * 0.12, horizon + 40, 1.1); treeSil(W * 0.30, horizon + 55, 0.9);
    treeSil(W * 0.62, horizon + 48, 1.0); treeSil(W * 0.88, horizon + 60, 1.2);

    for (const f of this._titleFire) {
      f.ph += dt * rand(1, 2.4); f.x += Math.sin(f.ph) * 0.0006;
      const a = 0.4 + Math.sin(f.ph) * 0.4;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const fx = f.x * W, fy = f.y * H;
      const gr = ctx.createRadialGradient(fx, fy, 1, fx, fy, 14);
      gr.addColorStop(0, `rgba(200,255,140,${a})`); gr.addColorStop(1, 'rgba(200,255,140,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(fx, fy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    this.postfx.vignette(ctx, 0.4);
  }
}
