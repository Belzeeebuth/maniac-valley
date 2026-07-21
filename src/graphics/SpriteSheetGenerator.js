// ============================================================================
// SpriteSheetGenerator — pixel art procédural riche (style Stardew/Terraria).
// Chaque élément est ombré en 3 tons (base / ombre / lumière) avec ombres
// portées pour un rendu 2.5D. Aucune image externe : tout est dessiné au
// runtime via des primitives Canvas. Les méthodes prennent un contexte `c`
// (canvas du monde ou petits canvas d'icônes d'UI).
// ============================================================================

import { TILE } from '../world/TileMap.js';
import { CROPS } from '../entities/Crop.js';

function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function ellipse(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function shadow(c, x, y, rx, ry) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
// hash déterministe par tuile → détails stables d'une frame à l'autre
function hash(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }

// Palettes de sol par saison
const GRASS_PAL = {
  spring: { a: '#5aae4e', b: '#57a84a', lo: '#4a9440', blade: '#69c25a', flower: ['#ffe36e', '#ff8fb8', '#ffffff'] },
  summer: { a: '#4fa03f', b: '#4c9a3c', lo: '#3f8a33', blade: '#63b850', flower: ['#ffd23e', '#ff7aa8', '#e8e8ff'] },
  autumn: { a: '#9a8734', b: '#93802f', lo: '#7e6d26', blade: '#b39a3c', flower: ['#e07a2a', '#d4552a', '#e8c060'] },
  winter: { a: '#dbe4ea', b: '#d0dae2', lo: '#bcc8d2', blade: '#e8eef3', flower: ['#ffffff', '#cfe0ea', '#ffffff'] },
};

export const Sprites = {
  // ================= Tuiles overworld =================
  // gx,gy = coordonnées MONDE de la tuile (indispensable : le hash doit être
  // stable quand la caméra défile, sinon les détails scintillent).
  grass(c, x, y, v, season, gx, gy) {
    const P = GRASS_PAL[season] || GRASS_PAL.spring;
    // damier subtil pour la texture de fond
    rect(c, x, y, TILE, TILE, ((gx + gy) & 1) ? P.a : P.b);
    // patch d'ombre douce
    c.fillStyle = P.lo;
    const h1 = hash(gx, gy);
    if (h1 < 0.5) c.fillRect(x + ((h1 * 20) | 0), y + 18 + ((h1 * 8) | 0), 10, 6);
    // brins d'herbe
    c.strokeStyle = P.blade; c.lineWidth = 1;
    const n = 3 + ((h1 * 3) | 0);
    for (let i = 0; i < n; i++) {
      const hh = hash(gx + i * 13, gy + i * 7);
      const bx = x + 3 + hh * 26, by = y + 8 + ((hh * 20) | 0);
      c.beginPath(); c.moveTo(bx, by + 4); c.lineTo(bx - 1, by); c.stroke();
      c.beginPath(); c.moveTo(bx + 2, by + 4); c.lineTo(bx + 3, by); c.stroke();
    }
    // fleurs / pépites occasionnelles
    const h2 = hash(gx + 99, gy + 51);
    if (h2 > 0.9) {
      const fx = x + 8 + h2 * 14, fy = y + 10 + h2 * 10;
      const col = P.flower[(h2 * 3) | 0];
      circ(c, fx, fy, 2.2, col); circ(c, fx, fy, 0.9, '#ffd23e');
    } else if (h2 > 0.82) {
      rect(c, x + 6 + h2 * 18, y + 20, 3, 2, 'rgba(0,0,0,0.10)');
    }
    if (season === 'winter' && hash(gx + 5, gy + 9) > 0.7) rect(c, x + (hash(gx, gy + 2) * 24 | 0), y + (hash(gx + 1, gy) * 24 | 0), 3, 3, 'rgba(255,255,255,0.7)');
  },
  grassAutumn(c, x, y, v, gx, gy) { Sprites.grass(c, x, y, v, 'autumn', gx, gy); },
  grassWinter(c, x, y, v, gx, gy) { Sprites.grass(c, x, y, v, 'winter', gx, gy); },

  path(c, x, y, v, edges, gx, gy) {
    rect(c, x, y, TILE, TILE, '#c8a86a');
    // grain de terre
    c.fillStyle = '#bd9a5a';
    const h = hash(gx, gy);
    rect(c, x + 4, y + 6, 7, 4); rect(c, x + 18, y + 18, 8, 4);
    c.fillStyle = '#d8bd82';
    rect(c, x + 20, y + 6, 5, 3); rect(c, x + 6, y + 20, 4, 3);
    // petits cailloux
    if (h > 0.6) circ(c, x + 10 + h * 10, y + 12 + h * 8, 1.6, '#9c7f4a');
    // liseré sombre sur les bords touchant l'herbe
    if (edges) {
      c.fillStyle = 'rgba(90,60,25,0.35)';
      if (edges.n) c.fillRect(x, y, TILE, 3);
      if (edges.s) c.fillRect(x, y + TILE - 3, TILE, 3);
      if (edges.w) c.fillRect(x, y, 3, TILE);
      if (edges.e) c.fillRect(x + TILE - 3, y, 3, TILE);
    }
  },

  water(c, x, y, t, edges, gx, gy) {
    // profondeur : dégradé vertical
    const g = c.createLinearGradient(x, y, x, y + TILE);
    g.addColorStop(0, '#2f79a8'); g.addColorStop(1, '#215a86');
    c.fillStyle = g; c.fillRect(x, y, TILE, TILE);
    // vaguelettes animées
    const w = Math.sin(t * 2 + x * 0.05) * 2.5;
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x + 3, y + 16 + w); c.lineTo(x + 29, y + 16 + w); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.14)';
    c.beginPath(); c.moveTo(x + 3, y + 8 - w); c.lineTo(x + 29, y + 8 - w); c.stroke();
    // caustiques : bandes de lumière diagonales animées
    c.save();
    c.beginPath(); c.rect(x, y, TILE, TILE); c.clip();
    c.globalAlpha = 0.10; c.strokeStyle = '#bfe8ff'; c.lineWidth = 2;
    const off = (t * 18) % (TILE + 12);
    for (let i = -TILE; i < TILE + 12; i += 11) {
      c.beginPath(); c.moveTo(x + i + off, y - 2); c.lineTo(x + i + off + 7, y + TILE + 2); c.stroke();
    }
    c.restore(); c.globalAlpha = 1;
    // reflets scintillants (position stable, clignotement temporel)
    if (hash(gx, gy + (t * 2 | 0)) > 0.86) rect(c, x + 8 + hash(gx, gy) * 14, y + 20, 3, 1, 'rgba(255,255,255,0.55)');
    // écume de rivage sur les bords touchant la terre
    if (edges) {
      c.fillStyle = 'rgba(220,240,255,0.55)';
      if (edges.n) c.fillRect(x, y, TILE, 3);
      if (edges.s) c.fillRect(x, y + TILE - 3, TILE, 3);
      if (edges.w) c.fillRect(x, y, 3, TILE);
      if (edges.e) c.fillRect(x + TILE - 3, y, 3, TILE);
      c.fillStyle = 'rgba(180,210,235,0.35)';
      if (edges.n) c.fillRect(x, y + 3, TILE, 2);
      if (edges.w) c.fillRect(x + 3, y, 2, TILE);
    }
  },

  farmland(c, x, y, wet) {
    const base = wet ? '#5a3a1e' : '#8a5f36';
    rect(c, x, y, TILE, TILE, base);
    // sillons labourés
    for (let i = 4; i < TILE - 2; i += 7) {
      rect(c, x + 2, y + i, TILE - 4, 3, wet ? '#4a2f16' : '#734d29');
      rect(c, x + 2, y + i + 3, TILE - 4, 2, wet ? '#6a4526' : '#9c6f40');
    }
    // liseré
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    if (wet) { c.fillStyle = 'rgba(80,130,180,0.18)'; c.fillRect(x + 2, y + 2, TILE - 4, TILE - 4); }
  },

  tree(c, x, y, t, season, seed = 0) {
    const cx = x + TILE / 2;
    shadow(c, cx + 3, y + TILE - 2, 15, 5);
    // tronc texturé
    rect(c, cx - 4, y + TILE - 15, 8, 15, '#5b3a20');
    rect(c, cx - 4, y + TILE - 15, 3, 15, '#6e4a2a');
    rect(c, cx + 1, y + TILE - 15, 3, 15, '#4a2f18');
    // balancement basé sur une graine MONDE (stable pendant le défilement)
    const sway = Math.sin(t + seed * 0.7) * 2;
    if (season === 'winter') {
      // canopée dénudée + neige
      c.strokeStyle = '#6b4a2b'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, y + 20); c.lineTo(cx - 8 + sway, y + 8); c.stroke();
      c.beginPath(); c.moveTo(cx, y + 20); c.lineTo(cx + 8 + sway, y + 6); c.stroke();
      circ(c, cx + sway, y + 12, 9, 'rgba(255,255,255,0.85)');
      circ(c, cx - 7 + sway, y + 18, 6, 'rgba(235,242,248,0.8)');
      circ(c, cx + 7 + sway, y + 18, 6, 'rgba(235,242,248,0.8)');
      return;
    }
    const pal = season === 'autumn'
      ? { d: '#8a4a1e', m: '#b5651d', l: '#d98c33', hi: '#e8b45a' }
      : season === 'summer'
      ? { d: '#256b2a', m: '#2f8a33', l: '#43a844', hi: '#6cc95f' }
      : { d: '#276b2c', m: '#317f37', l: '#3f9a44', hi: '#63c257' };
    // canopée en couches (ombre → base → lumière)
    circ(c, cx + sway, y + 17, 16, pal.d);
    circ(c, cx - 9 + sway, y + 22, 11, pal.d);
    circ(c, cx + 9 + sway, y + 22, 11, pal.d);
    circ(c, cx + sway, y + 15, 14, pal.m);
    circ(c, cx - 8 + sway, y + 20, 9, pal.m);
    circ(c, cx + 8 + sway, y + 20, 9, pal.m);
    circ(c, cx - 3 + sway, y + 10, 10, pal.l);
    circ(c, cx + 5 + sway, y + 13, 8, pal.l);
    // reflets pointillés (feuilles)
    c.fillStyle = pal.hi;
    for (let i = 0; i < 5; i++) { const hh = hash(x + i * 17, y + i * 9); circ(c, cx - 8 + hh * 16 + sway, y + 8 + hh * 12, 1.6, pal.hi); }
  },

  rock(c, x, y) {
    shadow(c, x + 16, y + 27, 12, 4);
    // facettes
    c.fillStyle = '#7d7d85';
    c.beginPath();
    c.moveTo(x + 6, y + 27); c.lineTo(x + 3, y + 15); c.lineTo(x + 11, y + 6);
    c.lineTo(x + 22, y + 5); c.lineTo(x + 29, y + 15); c.lineTo(x + 26, y + 27);
    c.closePath(); c.fill();
    c.fillStyle = '#9a9aa2'; // facette éclairée
    c.beginPath(); c.moveTo(x + 11, y + 6); c.lineTo(x + 22, y + 5); c.lineTo(x + 24, y + 13); c.lineTo(x + 14, y + 15); c.closePath(); c.fill();
    c.fillStyle = '#b6b6be'; // reflet
    c.beginPath(); c.moveTo(x + 12, y + 7); c.lineTo(x + 18, y + 7); c.lineTo(x + 15, y + 12); c.closePath(); c.fill();
    c.fillStyle = '#5f5f67'; // ombres basses
    rect(c, x + 8, y + 22, 6, 4); rect(c, x + 18, y + 23, 6, 3);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x + 14, y + 15); c.lineTo(x + 17, y + 24); c.stroke();
  },

  fence(c, x, y) {
    shadow(c, x + 16, y + 28, 12, 3);
    rect(c, x + 4, y + 4, 5, 26, '#6b4a2b'); rect(c, x + 4, y + 4, 2, 26, '#8a6a3a');
    rect(c, x + 23, y + 4, 5, 26, '#6b4a2b'); rect(c, x + 23, y + 4, 2, 26, '#8a6a3a');
    rect(c, x + 2, y + 9, 28, 4, '#7a5730'); rect(c, x + 2, y + 9, 28, 1, '#95724a');
    rect(c, x + 2, y + 19, 28, 4, '#7a5730'); rect(c, x + 2, y + 19, 28, 1, '#95724a');
  },

  // Mur / maison avec toit de tuiles sur la rangée supérieure.
  wall(c, x, y, roof, roofCol) {
    if (roof) {
      const base = roofCol || '#8a3a34';
      // toit en tuiles (teintes dérivées de la couleur de base)
      rect(c, x, y, TILE, TILE, base);
      c.globalAlpha = 0.35; c.fillStyle = '#ffffff';
      for (let r = 0; r < 2; r++) for (let cc = (r % 2) * 8; cc < TILE; cc += 16) c.fillRect(x + cc, y + r * 10, 14, 8);
      c.globalAlpha = 0.35; c.fillStyle = '#000000';
      for (let r = 0; r <= 2; r++) c.fillRect(x, y + r * 10 - 1, TILE, 2);
      c.globalAlpha = 1;
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x, y, TILE, 3);       // faîtage clair
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y + TILE - 4, TILE, 4); // avant-toit ombré
      return;
    }
    // mur en rondins/plâtre
    rect(c, x, y, TILE, TILE, '#c9a877');
    c.fillStyle = '#b8966a';
    for (let i = 6; i < TILE; i += 9) rect(c, x, y + i, TILE, 2);
    rect(c, x, y, 3, TILE, '#dcbf90'); rect(c, x + TILE - 3, y, 3, TILE, '#a8865c');
    c.fillStyle = 'rgba(0,0,0,0.06)'; rect(c, x, y + TILE - 4, TILE, 4);
  },

  // Fenêtre décorative (dessinée par Game sur certaines façades)
  window(c, x, y) {
    rect(c, x + 8, y + 8, 16, 16, '#5a3d24');
    rect(c, x + 10, y + 10, 12, 12, '#8fd0e8');
    rect(c, x + 15, y + 10, 2, 12, '#5a3d24'); rect(c, x + 10, y + 15, 12, 2, '#5a3d24');
    rect(c, x + 11, y + 11, 3, 3, 'rgba(255,255,255,0.6)');
  },

  door(c, x, y) {
    rect(c, x + 7, y + 4, 18, 28, '#6b4423');
    rect(c, x + 9, y + 6, 14, 26, '#7d5330');
    rect(c, x + 9, y + 6, 14, 2, '#8f633c');
    circ(c, x + 20, y + 20, 1.6, '#e8c84a');
  },

  bed(c, x, y) {
    shadow(c, x + 16, y + 28, 13, 3);
    rect(c, x + 2, y + 3, 28, 25, '#5a3d24');
    rect(c, x + 2, y + 3, 28, 3, '#754c2c');
    rect(c, x + 4, y + 6, 24, 9, '#cf4438'); // couette
    rect(c, x + 4, y + 6, 24, 2, '#e85a4c');
    rect(c, x + 4, y + 15, 24, 11, '#8b3a3a');
    rect(c, x + 5, y + 7, 9, 6, '#f4e9d0'); // oreiller
  },

  questBoard(c, x, y) {
    shadow(c, x + 16, y + 30, 10, 3);
    rect(c, x + 13, y + 12, 5, 20, '#5a3d24');
    rect(c, x + 3, y + 2, 26, 17, '#6b4a2b');
    rect(c, x + 5, y + 4, 22, 13, '#c8a86a');
    rect(c, x + 3, y + 2, 26, 2, '#8a6a3a');
    c.fillStyle = '#8a5a3a'; rect(c, x + 8, y + 7, 12, 2); rect(c, x + 8, y + 11, 8, 2);
    circ(c, x + 24, y + 6, 1.5, '#e0c060');
  },

  shopCounter(c, x, y) {
    shadow(c, x + 16, y + 30, 14, 3);
    rect(c, x, y + 10, TILE, 22, '#7a5730');
    rect(c, x, y + 10, TILE, 5, '#a8825a');
    rect(c, x, y + 14, TILE, 2, '#5a3d24');
    rect(c, x + 4, y + 18, 6, 10, '#8a6238'); rect(c, x + 22, y + 18, 6, 10, '#8a6238');
    // auvent rayé
    for (let i = 0; i < TILE; i += 8) rect(c, x + i, y + 4, 4, 7, i % 16 === 0 ? '#d9534f' : '#f4e9d0');
  },

  mineEntrance(c, x, y) {
    rect(c, x, y + 4, TILE, 28, '#3a3a3a');
    c.fillStyle = '#5a5a5a'; c.beginPath(); c.arc(x + 16, y + 16, 16, Math.PI, 0); c.fill();
    rect(c, x + 2, y + 4, 6, 26, '#6a6a6a'); rect(c, x + 24, y + 4, 6, 26, '#6a6a6a');
    rect(c, x + 3, y + 4, 2, 26, '#828282'); rect(c, x + 25, y + 4, 2, 26, '#828282');
    rect(c, x + 8, y + 8, 16, 24, '#0a0a0a'); // ouverture sombre
    rect(c, x + 10, y + 10, 12, 6, '#141414');
    // poutre de soutien
    rect(c, x + 6, y + 6, 20, 3, '#5a3d24');
  },

  chest(c, x, y) {
    shadow(c, x + 16, y + 28, 12, 3);
    rect(c, x + 3, y + 13, 26, 15, '#6b4423');
    rect(c, x + 3, y + 13, 26, 3, '#8a5a30');
    rect(c, x + 3, y + 7, 26, 8, '#7d5330');
    rect(c, x + 3, y + 7, 26, 2, '#956838');
    rect(c, x + 3, y + 13, 26, 1, '#3a2414');
    rect(c, x + 13, y + 11, 6, 8, '#d8b24a'); rect(c, x + 15, y + 14, 2, 3, '#3a2414');
  },

  furnace(c, x, y, t) {
    shadow(c, x + 16, y + 29, 13, 3);
    rect(c, x + 3, y + 2, 26, 28, '#5a5a5e');
    rect(c, x + 3, y + 2, 26, 3, '#727276');
    rect(c, x + 3, y + 2, 3, 28, '#6e6e72');
    rect(c, x + 8, y + 14, 16, 14, '#1a1512');
    const glow = 0.6 + Math.sin(t * 6) * 0.3;
    c.fillStyle = `rgba(255,140,26,${glow})`;
    c.beginPath(); c.moveTo(x + 16, y + 15); c.lineTo(x + 21, y + 26); c.lineTo(x + 11, y + 26); c.closePath(); c.fill();
    c.fillStyle = `rgba(255,220,120,${glow})`; circ(c, x + 16, y + 23, 3, `rgba(255,230,150,${glow})`);
    rect(c, x + 7, y + 4, 18, 3, '#3a3a3e');
    // fumée
    c.fillStyle = 'rgba(200,200,200,0.15)'; circ(c, x + 22, y - 2 + Math.sin(t * 3) * 2, 3, 'rgba(200,200,200,0.12)');
  },

  scarecrow(c, x, y) {
    shadow(c, x + 16, y + 30, 8, 3);
    rect(c, x + 14, y + 6, 4, 24, '#7a5730');
    rect(c, x + 5, y + 11, 22, 3, '#7a5730');
    circ(c, x + 16, y + 8, 6, '#e8c88a');
    c.fillStyle = '#3a2414'; rect(c, x + 13, y + 7, 2, 2); rect(c, x + 18, y + 7, 2, 2);
    c.strokeStyle = '#3a2414'; c.lineWidth = 1; c.beginPath(); c.arc(x + 16, y + 10, 2, 0.2, Math.PI - 0.2); c.stroke();
    // chapeau
    rect(c, x + 9, y + 1, 14, 3, '#5a3d24'); rect(c, x + 11, y - 3, 10, 5, '#6b4423');
    // tunique de paille
    rect(c, x + 8, y + 14, 16, 11, '#d9b84a');
    c.strokeStyle = '#a88a30'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x + 9 + i * 4, y + 25); c.lineTo(x + 10 + i * 4, y + 30); c.stroke(); }
  },

  torch(c, x, y, t, seed = 0) {
    rect(c, x + 14, y + 12, 4, 20, '#5a3d24'); rect(c, x + 14, y + 12, 1, 20, '#7d5330');
    const f = 0.7 + Math.sin(t * 14 + seed) * 0.3;
    c.fillStyle = `rgba(255,${120 + (40 * f) | 0},20,0.9)`;
    c.beginPath(); c.moveTo(x + 16, y + 1); c.lineTo(x + 22, y + 13); c.lineTo(x + 10, y + 13); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,210,90,0.95)';
    c.beginPath(); c.moveTo(x + 16, y + 5); c.lineTo(x + 19, y + 13); c.lineTo(x + 13, y + 13); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,200,0.9)'; circ(c, x + 16, y + 10, 1.6, 'rgba(255,255,210,0.9)');
  },

  stairsDown(c, x, y, sealed) {
    if (sealed) { rect(c, x + 2, y + 8, 28, 22, '#4a3f34'); Sprites.rock(c, x - 2, y - 4); return; }
    rect(c, x + 2, y + 5, 28, 27, '#080808');
    for (let i = 0; i < 5; i++) rect(c, x + 3 + i * 1.5, y + 7 + i * 4.5, 26 - i * 3, 4, i % 2 ? '#2e2e2e' : '#3c3c3c');
    rect(c, x + 2, y + 5, 28, 2, '#555'); // rebord éclairé
  },

  cropStage(c, x, y, cropId, stage) {
    const cd = CROPS[cropId];
    const stalk = '#3a7a2c', stalkD = '#2c5f22';
    if (stage === 0) { rect(c, x + 14, y + 22, 4, 6, stalk); circ(c, x + 16, y + 22, 2.5, '#4a9a3a'); return; }
    if (stage === 1) { rect(c, x + 15, y + 15, 3, 14, stalk); rect(c, x + 15, y + 15, 1, 14, stalkD); circ(c, x + 16, y + 14, 4, '#4a9a3a'); circ(c, x + 12, y + 18, 3, '#4a9a3a'); return; }
    if (stage === 2) { rect(c, x + 14, y + 11, 4, 18, stalk); rect(c, x + 14, y + 11, 1, 18, stalkD); circ(c, x + 11, y + 14, 5, '#4a9a3a'); circ(c, x + 21, y + 16, 5, '#4a9a3a'); circ(c, x + 16, y + 10, 5, '#54a844'); return; }
    // récolte prête
    rect(c, x + 14, y + 15, 4, 15, stalk); rect(c, x + 14, y + 15, 1, 15, stalkD);
    circ(c, x + 16, y + 13, 8, cd.color);
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.arc(x + 16, y + 15, 8, 0.2, Math.PI - 0.2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)'; circ(c, x + 13, y + 10, 2.5, 'rgba(255,255,255,0.4)');
    // petite lueur "prêt à récolter"
    c.fillStyle = 'rgba(255,240,150,0.25)'; circ(c, x + 16, y + 13, 11, 'rgba(255,240,150,0.12)');
  },

  // ================= Tuiles mine (avec biomes) =================
  mineFloor(c, x, y, v, gx = 0, gy = 0, biome = null) {
    const a = biome ? biome.floorA : '#43392f', b = biome ? biome.floorB : '#3d342b';
    rect(c, x, y, TILE, TILE, ((gx + gy) & 1) ? a : b);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    const h = hash(gx, gy);
    if (h < 0.4) c.fillRect(x + (h * 20 | 0), y + 8 + (h * 12 | 0), 4, 3);
    if (h > 0.85) circ(c, x + 8 + h * 14, y + 20, 1.4, 'rgba(255,255,255,0.06)');
  },
  mineWall(c, x, y, biome = null) {
    const edge = biome ? biome.wallEdge : '#211b16', face = biome ? biome.wallFace : '#43392f', hi = biome ? biome.wallHi : '#5a4d3f';
    rect(c, x, y, TILE, TILE, edge);
    rect(c, x + 1, y + 1, TILE - 2, TILE - 2, face);
    rect(c, x + 1, y + 1, TILE - 2, 2, hi); // arête éclairée haut
    c.fillStyle = 'rgba(0,0,0,0.25)';
    rect(c, x + 1, y + TILE - 3, TILE - 2, 2, 'rgba(0,0,0,0.3)'); // ombre bas
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 5, y + 12, TILE - 12, 3); c.fillRect(x + 3, y + 20, 10, 2);
  },
  // Pièges de mine
  trap(c, x, y, type, t) {
    if (type === 'spikes') {
      c.fillStyle = '#8a8a92';
      for (let i = 0; i < 4; i++) {
        const sx = x + 4 + i * 7;
        c.beginPath(); c.moveTo(sx, y + 26); c.lineTo(sx + 3, y + 10); c.lineTo(sx + 6, y + 26); c.closePath(); c.fill();
      }
      c.fillStyle = '#c8c8d0';
      for (let i = 0; i < 4; i++) { const sx = x + 4 + i * 7; c.fillRect(sx + 2, y + 12, 1.5, 6); }
    } else if (type === 'lava') {
      rect(c, x + 2, y + 2, TILE - 4, TILE - 4, '#c93a10');
      const g2 = 0.5 + Math.sin(t * 4 + x) * 0.3;
      c.fillStyle = `rgba(255,180,40,${g2})`;
      circ(c, x + 10, y + 12, 4, `rgba(255,170,40,${g2})`);
      circ(c, x + 22, y + 20, 5, `rgba(255,140,30,${g2 * 0.8})`);
      c.fillStyle = '#7a1a00'; c.fillRect(x + 2, y + 2, TILE - 4, 2);
    } else if (type === 'ice') {
      rect(c, x + 2, y + 2, TILE - 4, TILE - 4, 'rgba(160,210,240,0.55)');
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 6, y + 8); c.lineTo(x + 16, y + 18); c.lineTo(x + 12, y + 26); c.stroke();
      c.beginPath(); c.moveTo(x + 22, y + 6); c.lineTo(x + 18, y + 14); c.stroke();
    }
  },
  // Gouffre : trou sombre avec rebord — infranchissable sans passerelle.
  pit(c, x, y, biome = null) {
    const face = biome ? biome.floorA : '#43392f';
    rect(c, x, y, TILE, TILE, face);
    rect(c, x + 2, y + 3, TILE - 4, TILE - 5, '#08060a');
    rect(c, x + 2, y + 3, TILE - 4, 3, '#000');
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x + 2, y + TILE - 3, TILE - 4, 1);
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x + 4, y + 6, 5, 2); c.fillRect(x + 20, y + 9, 6, 2);
  },
  // Passerelle en planches (sur gouffre ou sur l'eau)
  bridge(c, x, y, overWater = false) {
    if (!overWater) { rect(c, x, y, TILE, TILE, '#08060a'); }
    rect(c, x, y + 2, TILE, TILE - 4, '#8a6238');
    c.fillStyle = '#a8825a';
    for (let i = 0; i < TILE; i += 8) c.fillRect(x + i, y + 2, 6, TILE - 4);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 6; i < TILE; i += 8) c.fillRect(x + i, y + 2, 2, TILE - 4);
    rect(c, x, y + 1, TILE, 2, '#6b4a2b'); rect(c, x, y + TILE - 3, TILE, 2, '#6b4a2b');
  },
  // Buisson à baies (bosquet)
  bush(c, x, y, ready) {
    shadow(c, x + 16, y + 27, 13, 4);
    circ(c, x + 16, y + 18, 12, '#2f6b33');
    circ(c, x + 9, y + 21, 8, '#2a5f2e');
    circ(c, x + 23, y + 21, 8, '#2a5f2e');
    circ(c, x + 16, y + 13, 9, '#3a7f3e');
    c.fillStyle = '#4a9a4e'; circ(c, x + 12, y + 12, 3, '#4a9a4e'); circ(c, x + 20, y + 15, 2.5, '#4a9a4e');
    if (ready) {
      const spots = [[10, 16], [16, 20], [22, 14], [14, 24], [21, 22], [16, 11]];
      for (const [bx, by] of spots) { circ(c, x + bx, y + by, 2.2, '#d43a5a'); circ(c, x + bx - 0.7, y + by - 0.7, 0.8, '#ff8aa0'); }
    }
  },
  mineOre(c, x, y, kind, biome = null) {
    Sprites.mineWall(c, x, y, biome);
    const P = { copper: ['#c9743a', '#e0985a'], iron: ['#b6b6c6', '#dcdcea'], gold: ['#e6b820', '#ffe680'], diamond: ['#5fd8cf', '#bff5f0'] }[kind];
    const spots = [[11, 13, 4], [21, 20, 4], [17, 9, 3], [9, 22, 2.5]];
    for (const [sx, sy, r] of spots) { circ(c, x + sx, y + sy, r, P[0]); circ(c, x + sx - 1, y + sy - 1, r * 0.5, P[1]); }
    // scintillement
    if (kind === 'diamond' || kind === 'gold') { c.fillStyle = 'rgba(255,255,255,0.7)'; rect(c, x + 10, y + 11, 1.5, 1.5); }
  },
  mineEntranceTile(c, x, y, gx = 0, gy = 0, biome = null) {
    Sprites.mineFloor(c, x, y, 0, gx, gy, biome);
    c.fillStyle = 'rgba(255,235,180,0.16)'; circ(c, x + 16, y + 16, 13, 'rgba(255,235,180,0.14)');
    rect(c, x + 4, y + 2, 24, 3, '#5a3d24'); // poutre
  },

  // ================= Entités =================
  player(c, sx, sy, p) {
    const bob = p.moving ? Math.abs(Math.sin(p.animT)) * 2 : 0;
    const step = p.moving ? Math.sin(p.animT) : 0;
    const flash = p.iframes > 0 && Math.floor(p.iframes * 12) % 2 === 0;
    c.save();
    if (p.dodging) c.globalAlpha = 0.75;
    if (flash) c.globalAlpha = 0.4;
    shadow(c, sx + p.w / 2, sy + p.h + 2, 11, 4);

    const skin = '#e8b98a', skinSh = '#cf9d6e', hair = '#5a3a20', hairHi = '#6e4a2a';
    const tunic = '#3f78c4', tunicSh = '#2f5c9a', pants = '#3a3550', boot = '#2a2438';

    // jambes animées
    const lY = sy + 18 - bob;
    rect(c, sx + 4, lY + step * 1.5, 6, 8, pants); rect(c, sx + p.w - 10, lY - step * 1.5, 6, 8, pants);
    rect(c, sx + 4, lY + 6 + step * 1.5, 6, 3, boot); rect(c, sx + p.w - 10, lY + 6 - step * 1.5, 6, 3, boot);
    // torse
    rect(c, sx + 2, sy + 8 - bob, p.w - 4, 13, tunic);
    rect(c, sx + 2, sy + 8 - bob, 3, 13, tunicSh);
    rect(c, sx + 2, sy + 17 - bob, p.w - 4, 3, '#8a5a30'); // ceinture
    // bras
    rect(c, sx, sy + 9 - bob, 3, 9, tunicSh); rect(c, sx + p.w - 3, sy + 9 - bob, 3, 9, tunic);
    // tête
    rect(c, sx + 4, sy - 2 - bob, p.w - 8, 12, skin);
    rect(c, sx + 4, sy - 2 - bob, 2, 12, skinSh);
    // cheveux + visage selon l'orientation
    if (p.facing === 'up') {
      rect(c, sx + 3, sy - 4 - bob, p.w - 6, 9, hair);
      rect(c, sx + 3, sy - 4 - bob, p.w - 6, 2, hairHi);
    } else if (p.facing === 'down') {
      rect(c, sx + 3, sy - 4 - bob, p.w - 6, 4, hair);
      rect(c, sx + 3, sy - 4 - bob, p.w - 6, 1, hairHi);
      c.fillStyle = '#2a2018'; rect(c, sx + 7, sy + 2 - bob, 2, 2); rect(c, sx + p.w - 9, sy + 2 - bob, 2, 2);
      c.fillStyle = '#c47a5a'; rect(c, sx + 8, sy + 6 - bob, p.w - 16, 1);
    } else {
      const dir = p.facing === 'left' ? 0 : 1;
      rect(c, sx + 3, sy - 4 - bob, p.w - 6, 5, hair);
      rect(c, sx + 3 + dir * (p.w - 8), sy - 3 - bob, 4, 8, hair);
      c.fillStyle = '#2a2018';
      rect(c, sx + (dir ? p.w - 8 : 5), sy + 2 - bob, 2, 2);
    }
    c.restore();
  },

  swordSwing(c, sx, sy, p) {
    const off = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[p.facing];
    c.save();
    c.translate(sx + p.w / 2, sy + p.h / 2 - 4);
    const prog = 1 - p.attackTimer / p.attackDur;
    const ang = Math.atan2(off[1], off[0]) + (0.6 - prog * 1.4);
    c.rotate(ang);
    const reach = 22 + p.swordLevel * 3;
    // traînée
    c.globalAlpha = 0.35 * (1 - prog);
    c.strokeStyle = '#eef'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, reach - 2, -0.8, 0.8); c.stroke();
    c.globalAlpha = 1;
    // lame
    c.fillStyle = '#e6e6f2'; c.fillRect(6, -3, reach, 6);
    c.fillStyle = '#ffffff'; c.fillRect(6, -3, reach, 2);
    c.fillStyle = p.swordLevel > 0 ? '#ffe066' : '#c8c8d8'; c.fillRect(6 + reach, -2, 5, 4);
    c.fillStyle = '#8a6a3a'; c.fillRect(0, -4, 8, 8); // garde
    c.fillStyle = '#5a4020'; c.fillRect(-4, -2, 5, 4); // pommeau
    c.restore();
  },

  chicken(c, sx, sy, a) {
    const bob = Math.sin(a.animT * 6) * 1.5;
    shadow(c, sx, sy + 11, 11, 3);
    ellipse(c, sx, sy + bob, 10, 8, '#f6f6f0');
    ellipse(c, sx - 3, sy + 2 + bob, 7, 6, '#e2e2da'); // aile ombrée
    ellipse(c, sx, sy - 6 + bob, 6, 6, '#faf9f4');
    c.fillStyle = '#e0a030'; c.beginPath(); c.moveTo(sx + 6, sy - 6 + bob); c.lineTo(sx + 12, sy - 4 + bob); c.lineTo(sx + 6, sy - 2 + bob); c.fill();
    c.fillStyle = '#d9433a'; rect(c, sx - 2, sy - 12 + bob, 5, 4); // crête
    c.fillStyle = '#2a2018'; rect(c, sx + 2, sy - 7 + bob, 1.5, 1.5);
  },

  cow(c, sx, sy, a) {
    const bob = Math.sin(a.animT * 5) * 1.5;
    shadow(c, sx, sy + 13, 16, 4);
    ellipse(c, sx, sy + bob, 16, 11, '#f6f6f0');
    ellipse(c, sx - 6, sy - 2 + bob, 5, 5, '#2f2a28'); // taches
    ellipse(c, sx + 7, sy + 4 + bob, 4, 4, '#2f2a28');
    rect(c, sx - 15, sy + 8 + bob, 4, 5, '#f0f0ea'); rect(c, sx + 11, sy + 8 + bob, 4, 5, '#f0f0ea'); // pattes
    ellipse(c, sx + 14, sy + 1 + bob, 5, 4, '#e8b0b0'); // museau
    c.fillStyle = '#2a2018'; rect(c, sx + 12, sy - 1 + bob, 1.5, 1.5); rect(c, sx + 16, sy - 1 + bob, 1.5, 1.5);
    rect(c, sx - 15, sy - 5 + bob, 3, 3, '#f6f6f0'); // corne
  },

  enemy(c, sx, sy, e) {
    const flash = e.iframes > 0 && Math.floor(e.iframes * 20) % 2 === 0;
    c.save(); if (flash) c.globalAlpha = 0.45;
    shadow(c, sx, sy + e.h / 2 + 2, 10, 4);
    if (e.kind === 'slime') {
      const sq = 1 + (e.squish || 0) * 0.35;
      const base = e.tint || '#43cf5e', dark = e.tint ? '#7a2a95' : '#2fa347';
      ellipse(c, sx, sy + 4, 12 * sq, 10 / sq, base);
      ellipse(c, sx, sy + 9, 11 * sq, 4, dark);
      c.fillStyle = 'rgba(255,255,255,0.4)'; ellipse(c, sx - 4, sy - 1, 3 * sq, 2, 'rgba(255,255,255,0.4)'); // gloss
      c.fillStyle = '#0a2a0a'; rect(c, sx - 5, sy, 2.5, 3); rect(c, sx + 3, sy, 2.5, 3);
      c.fillStyle = '#fff'; rect(c, sx - 5, sy, 1, 1); rect(c, sx + 3, sy, 1, 1);
    } else if (e.kind === 'skeleton') {
      rect(c, sx - 4, sy - 2, 8, 12, '#e6e6dc'); // torse
      c.fillStyle = '#c8c8bc'; rect(c, sx - 4, sy + 1, 8, 1); rect(c, sx - 4, sy + 4, 8, 1); rect(c, sx - 4, sy + 7, 8, 1); // côtes
      circ(c, sx, sy - 9, 7, '#f2f2e8'); // crâne
      c.fillStyle = '#1a1a1a'; rect(c, sx - 4, sy - 11, 3, 3); rect(c, sx + 1, sy - 11, 3, 3);
      rect(c, sx - 1, sy - 6, 2, 2);
      rect(c, sx - 9, sy, 4, 9, '#e6e6dc'); rect(c, sx + 5, sy, 4, 9, '#e6e6dc'); // bras
    } else if (e.kind === 'bat') {
      const flap = Math.sin(e.wavePhase) * 9;
      c.fillStyle = '#6a4a7a';
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - 15, sy - flap); c.lineTo(sx - 10, sy + 2); c.lineTo(sx - 6, sy + 5); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 15, sy - flap); c.lineTo(sx + 10, sy + 2); c.lineTo(sx + 6, sy + 5); c.closePath(); c.fill();
      circ(c, sx, sy, 7, '#3a2050');
      c.fillStyle = '#2a1638'; rect(c, sx - 3, sy - 5, 2, 2); rect(c, sx + 1, sy - 5, 2, 2); // oreilles
      c.fillStyle = '#ff4040'; rect(c, sx - 3, sy - 1, 2, 2); rect(c, sx + 1, sy - 1, 2, 2);
    }
    c.restore();
    if (e.hp < e.maxHp) {
      rect(c, sx - 12, sy - e.h / 2 - 10, 24, 4, '#000');
      rect(c, sx - 11, sy - e.h / 2 - 9, 22 * Math.max(0, e.hp / e.maxHp), 2, '#e33');
    }
  },

  boss(c, sx, sy, b, t) {
    const flash = b.iframes > 0 && Math.floor(b.iframes * 20) % 2 === 0;
    c.save(); if (flash) c.globalAlpha = 0.5;
    if (b.kind === 'boss_gigaslime') {
      const sq = 1 + (b.squish || 0) * 0.3;
      shadow(c, sx, sy + 26, 30, 7);
      ellipse(c, sx, sy + 6, 32 * sq, 26 / sq, '#8a34a8');
      ellipse(c, sx, sy + 18, 30 * sq, 11, '#6a1f88');
      ellipse(c, sx - 10, sy - 6, 8 * sq, 6, 'rgba(255,255,255,0.35)'); // gloss
      // couronne
      c.fillStyle = '#ffe066';
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(sx + i * 10 - 4, sy - 16); c.lineTo(sx + i * 10, sy - 28); c.lineTo(sx + i * 10 + 4, sy - 16); c.closePath(); c.fill(); }
      rect(c, sx - 14, sy - 16, 28, 4, '#e0b840');
      c.fillStyle = '#ff3030'; rect(c, sx - 11, sy, 5, 6); rect(c, sx + 6, sy, 5, 6);
      c.fillStyle = '#fff'; rect(c, sx - 11, sy, 2, 2); rect(c, sx + 6, sy, 2, 2);
    } else {
      if (b.phase === 'burrowed') {
        c.fillStyle = 'rgba(120,80,40,0.45)';
        for (let i = 0; i < 3; i++) circ(c, sx, sy, 14 + i * 6 + Math.sin(t * 10 - i) * 3, 'rgba(120,80,40,' + (0.25 - i * 0.07) + ')');
        c.fillStyle = '#3a2a18'; rect(c, sx - 10, sy - 2, 20, 4);
      } else {
        shadow(c, sx, sy + 26, 32, 7);
        ellipse(c, sx, sy + 8, 32, 22, '#8a6a3a');
        ellipse(c, sx, sy + 14, 30, 12, '#6f5230');
        circ(c, sx, sy - 10, 16, '#7d5a33'); circ(c, sx, sy - 13, 13, '#8a6a3a');
        rect(c, sx - 9, sy - 6, 6, 9, '#fff'); rect(c, sx + 3, sy - 6, 6, 9, '#fff'); // grandes dents
        c.fillStyle = '#1a1a1a'; rect(c, sx - 7, sy - 17, 3, 3); rect(c, sx + 4, sy - 17, 3, 3);
        c.fillStyle = '#e88a5a'; circ(c, sx, sy - 8, 3, '#e88a5a'); // museau
        c.fillStyle = '#c9743a'; // griffes
        c.beginPath(); c.moveTo(sx - 26, sy + 4); c.lineTo(sx - 40, sy - 2); c.lineTo(sx - 30, sy + 13); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(sx + 26, sy + 4); c.lineTo(sx + 40, sy - 2); c.lineTo(sx + 30, sy + 13); c.closePath(); c.fill();
      }
    }
    c.restore();
  },

  villager(c, sx, sy, v) {
    const child = v.kind === 'child';
    const w = child ? 14 : 18, hgt = child ? 15 : 20;
    const bob = Math.sin(v.animT * (child ? 7 : 5)) * (v.talkT > 0 ? 0 : 1.3);
    shadow(c, sx, sy + hgt / 2 + 3, child ? 8 : 10, 3);
    const x0 = sx - w / 2, y0 = sy - hgt / 2 + bob;
    // jambes
    rect(c, x0 + 3, y0 + hgt - 6, 4, 6, '#3a3550'); rect(c, x0 + w - 7, y0 + hgt - 6, 4, 6, '#3a3550');
    // corps (chemise)
    rect(c, x0 + 1, y0 + hgt - 15, w - 2, 11, v.shirt);
    rect(c, x0 + 1, y0 + hgt - 15, 3, 11, 'rgba(0,0,0,0.18)');
    // bras
    rect(c, x0 - 1, y0 + hgt - 14, 3, 8, v.shirt); rect(c, x0 + w - 2, y0 + hgt - 14, 3, 8, v.shirt);
    // tête
    rect(c, x0 + 3, y0 + hgt - 26, w - 6, 12, v.skin);
    rect(c, x0 + 3, y0 + hgt - 26, 2, 12, 'rgba(0,0,0,0.12)');
    // cheveux selon orientation
    if (v.facing === 'up') rect(c, x0 + 2, y0 + hgt - 28, w - 4, 8, v.hair);
    else {
      rect(c, x0 + 2, y0 + hgt - 28, w - 4, 5, v.hair);
      c.fillStyle = '#2a2018';
      if (v.facing === 'down') { rect(c, x0 + 5, y0 + hgt - 20, 2, 2); rect(c, x0 + w - 7, y0 + hgt - 20, 2, 2); }
      else if (v.facing === 'left') rect(c, x0 + 4, y0 + hgt - 20, 2, 2);
      else rect(c, x0 + w - 6, y0 + hgt - 20, 2, 2);
    }
    // bulle de dialogue
    if (v.talkT > 0) {
      const bx = sx + 8, by = sy - hgt / 2 - 8;
      c.fillStyle = 'rgba(255,255,255,0.92)';
      c.beginPath(); c.arc(bx, by, 5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(bx - 4, by + 3); c.lineTo(bx - 2, by + 8); c.lineTo(bx, by + 3); c.fill();
      c.fillStyle = '#3a2a18'; rect(c, bx - 2.5, by - 1, 5, 1.5); rect(c, bx - 2.5, by + 1.5, 3, 1.5);
    }
  },

  shopkeeper(c, sx, sy) {
    shadow(c, sx + 10, sy + 30, 10, 4);
    rect(c, sx + 3, sy + 14, 14, 16, '#7a3535'); // tablier
    rect(c, sx + 3, sy + 14, 14, 3, '#9a4a4a');
    rect(c, sx + 1, sy + 15, 3, 9, '#e8b98a'); rect(c, sx + 16, sy + 15, 3, 9, '#e8b98a'); // bras
    rect(c, sx + 4, sy, 12, 14, '#e8b98a'); // tête
    rect(c, sx + 3, sy - 3, 14, 6, '#3a2a18'); rect(c, sx + 3, sy - 1, 14, 2, '#4a3520'); // cheveux
    c.fillStyle = '#2a2018'; rect(c, sx + 7, sy + 6, 2, 2); rect(c, sx + 13, sy + 6, 2, 2);
    c.fillStyle = '#8a5a3a'; rect(c, sx + 8, sy + 9, 6, 3); // moustache
  },

  groundGold(c, sx, sy, bob) {
    c.fillStyle = 'rgba(0,0,0,0.2)'; ellipse(c, sx, sy + 6, 6, 2, 'rgba(0,0,0,0.2)');
    circ(c, sx, sy + bob, 6, '#e6b820'); circ(c, sx - 1, sy - 1 + bob, 3, '#ffe680');
    c.fillStyle = 'rgba(255,255,255,0.7)'; rect(c, sx - 2, sy - 2 + bob, 1.5, 1.5);
  },

  // ================= Icônes d'objets =================
  itemIcon(c, id, x, y, s) {
    c.save(); c.translate(x, y);
    (ICON[id] || ICON.default)(c, s);
    c.restore();
  },
};

// ============================================================================
// TileCache — mise en cache offscreen des tuiles statiques. Les tuiles dont le
// dessin est déterministe (herbe, chemin, sols/murs de mine, terre) sont
// rendues une seule fois par clé puis blittées via drawImage : le gros des
// fillRect/arc par frame disparaît. Les tuiles animées (eau, torche, fourneau)
// restent dessinées en direct.
// ============================================================================
const _tileCache = new Map();
const TILE_CACHE_MAX = 512;

export function cachedTile(key, drawFn) {
  let cv = _tileCache.get(key);
  if (!cv) {
    if (_tileCache.size > TILE_CACHE_MAX) _tileCache.clear();
    cv = document.createElement('canvas');
    cv.width = TILE; cv.height = TILE;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    drawFn(c);
    _tileCache.set(key, cv);
  }
  return cv;
}
export function clearTileCache() { _tileCache.clear(); }

// Blitters pratiques : la variation par tuile est repliée sur un motif 8x8
// (visuel identique à l'oeil, nombre de variantes borné → cache efficace).
export const CachedTiles = {
  // Coordonnées synthétiques : motif 8x8 + correction pour préserver la
  // parité du damier ((sx+sy)&1 identique à (gx+gy)&1) en un seul dessin.
  _syn(gx, gy) {
    const kx = gx & 7, ky = gy & 7;
    const parity = (gx + gy) & 1;
    const sx = ((kx + ky) & 1) === parity ? kx : kx + 8;
    return { sx, sy: ky };
  },
  grass(ctx, x, y, season, gx, gy) {
    const { sx, sy } = CachedTiles._syn(gx, gy);
    const cv = cachedTile(`g:${season}:${sx}:${sy}`, (c) => Sprites.grass(c, 0, 0, 0, season, sx, sy));
    ctx.drawImage(cv, x | 0, y | 0);
  },
  mineFloor(ctx, x, y, biome, biomeKey, gx, gy) {
    const { sx, sy } = CachedTiles._syn(gx, gy);
    const cv = cachedTile(`mf:${biomeKey}:${sx}:${sy}`, (c) => Sprites.mineFloor(c, 0, 0, 0, sx, sy, biome));
    ctx.drawImage(cv, x | 0, y | 0);
  },
  mineWall(ctx, x, y, biome, biomeKey) {
    const cv = cachedTile(`mw:${biomeKey}`, (c) => Sprites.mineWall(c, 0, 0, biome));
    ctx.drawImage(cv, x | 0, y | 0);
  },
  mineOre(ctx, x, y, kind, biome, biomeKey) {
    const cv = cachedTile(`mo:${biomeKey}:${kind}`, (c) => Sprites.mineOre(c, 0, 0, kind, biome));
    ctx.drawImage(cv, x | 0, y | 0);
  },
  farmland(ctx, x, y, wet) {
    const cv = cachedTile(`fl:${wet ? 1 : 0}`, (c) => Sprites.farmland(c, 0, 0, wet));
    ctx.drawImage(cv, x | 0, y | 0);
  },
  fence(ctx, x, y) {
    const cv = cachedTile('fence', (c) => Sprites.fence(c, 0, 0));
    ctx.drawImage(cv, x | 0, y | 0);
  },
  rock(ctx, x, y) {
    const cv = cachedTile('rock', (c) => Sprites.rock(c, 0, 0));
    ctx.drawImage(cv, x | 0, y | 0);
  },
  wall(ctx, x, y, roof, roofCol) {
    const cv = cachedTile(`w:${roof ? 1 : 0}:${roofCol || ''}`, (c) => Sprites.wall(c, 0, 0, roof, roofCol));
    ctx.drawImage(cv, x | 0, y | 0);
  },
};

function ir(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function icc(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

const ICON = {
  hoe(c, s) { ir(c, s * .45, s * .1, s * .1, s * .7, '#8a6a3a'); ir(c, s * .45, s * .1, s * .04, s * .7, '#a8865c'); ir(c, s * .25, s * .72, s * .5, s * .14, '#b0b0b8'); ir(c, s * .25, s * .72, s * .5, s * .05, '#d8d8e0'); },
  wateringcan(c, s) { ir(c, s * .25, s * .4, s * .4, s * .35, '#3a7fc1'); ir(c, s * .25, s * .4, s * .4, s * .1, '#5a9fd8'); ir(c, s * .6, s * .25, s * .28, s * .12, '#3a7fc1'); ir(c, s * .13, s * .3, s * .15, s * .15, '#3a7fc1'); },
  axe(c, s) { ir(c, s * .45, s * .15, s * .1, s * .7, '#8a6a3a'); icc(c, s * .5, s * .2, s * .18, '#b8b8c0'); icc(c, s * .46, s * .17, s * .1, '#dcdce4'); },
  pickaxe(c, s) { ir(c, s * .45, s * .2, s * .1, s * .65, '#8a6a3a'); ir(c, s * .2, s * .12, s * .6, s * .14, '#9aa0a8'); ir(c, s * .2, s * .12, s * .6, s * .05, '#c0c6ce'); },
  sword(c, s) { ir(c, s * .46, s * .12, s * .08, s * .55, '#d8d8e8'); ir(c, s * .46, s * .12, s * .03, s * .55, '#fff'); ir(c, s * .3, s * .62, s * .4, s * .1, '#8a6a3a'); ir(c, s * .44, s * .72, s * .12, s * .16, '#6b4a2b'); },
  wood(c, s) { ir(c, s * .2, s * .35, s * .6, s * .3, '#8a6238'); ir(c, s * .2, s * .35, s * .6, s * .08, '#a8825a'); icc(c, s * .3, s * .5, s * .06, '#c9a769'); icc(c, s * .62, s * .5, s * .05, '#c9a769'); },
  stone(c, s) { icc(c, s * .5, s * .55, s * .32, '#8a8a92'); icc(c, s * .42, s * .46, s * .12, '#adadb5'); ir(c, s * .4, s * .42, s * .08, s * .08, '#c8c8d0'); },
  copper(c, s) { icc(c, s * .5, s * .55, s * .3, '#c9743a'); icc(c, s * .42, s * .46, s * .1, '#e0985a'); ir(c, s * .4, s * .42, s * .06, s * .06, '#f0b878'); },
  iron(c, s) { icc(c, s * .5, s * .55, s * .3, '#a8a8ba'); icc(c, s * .42, s * .46, s * .1, '#d0d0e0'); ir(c, s * .4, s * .42, s * .06, s * .06, '#eeeef6'); },
  gold_ore(c, s) { icc(c, s * .5, s * .55, s * .3, '#d4af37'); icc(c, s * .42, s * .46, s * .1, '#ffe680'); ir(c, s * .4, s * .42, s * .06, s * .06, '#fff4c0'); },
  diamond(c, s) { c.fillStyle = '#5fd8cf'; c.beginPath(); c.moveTo(s * .5, s * .18); c.lineTo(s * .8, s * .5); c.lineTo(s * .5, s * .86); c.lineTo(s * .2, s * .5); c.closePath(); c.fill(); c.fillStyle = '#bff5f0'; c.beginPath(); c.moveTo(s * .5, s * .18); c.lineTo(s * .65, s * .5); c.lineTo(s * .5, s * .5); c.closePath(); c.fill(); c.fillStyle = '#fff'; ir(c, s * .44, s * .3, s * .04, s * .04); },
  coal(c, s) { icc(c, s * .5, s * .55, s * .28, '#2a2a2a'); icc(c, s * .42, s * .46, s * .08, '#4a4a4a'); ir(c, s * .4, s * .42, s * .05, s * .05, '#666'); },
  bar_copper(c, s) { ir(c, s * .22, s * .42, s * .56, s * .22, '#c9743a'); ir(c, s * .25, s * .44, s * .5, s * .06, '#e0985a'); ir(c, s * .22, s * .6, s * .56, s * .04, '#8a4a20'); },
  bar_iron(c, s) { ir(c, s * .22, s * .42, s * .56, s * .22, '#b0b0c0'); ir(c, s * .25, s * .44, s * .5, s * .06, '#e0e0ee'); ir(c, s * .22, s * .6, s * .56, s * .04, '#7a7a8a'); },
  bar_gold(c, s) { ir(c, s * .22, s * .42, s * .56, s * .22, '#e0bc30'); ir(c, s * .25, s * .44, s * .5, s * .06, '#fff0a0'); ir(c, s * .22, s * .6, s * .56, s * .04, '#a88a10'); },
  seed_wheat(c, s) { ir(c, s * .32, s * .3, s * .36, s * .42, '#c8a86a'); ir(c, s * .32, s * .3, s * .36, s * .1, '#d8bd82'); icc(c, s * .5, s * .28, s * .1, '#c9a030'); },
  seed_strawberry(c, s) { ir(c, s * .32, s * .3, s * .36, s * .42, '#c8a86a'); icc(c, s * .5, s * .28, s * .1, '#c0392b'); },
  seed_pumpkin(c, s) { ir(c, s * .32, s * .3, s * .36, s * .42, '#c8a86a'); icc(c, s * .5, s * .28, s * .1, '#d9822b'); },
  seed_tomato(c, s) { ir(c, s * .32, s * .3, s * .36, s * .42, '#c8a86a'); icc(c, s * .5, s * .28, s * .1, '#d43c2c'); },
  crop_wheat(c, s) { ir(c, s * .46, s * .2, s * .08, s * .55, '#c9a030'); for (let i = 0; i < 3; i++) { icc(c, s * .42, s * .28 + i * .12, s * .06, '#e8d060'); icc(c, s * .58, s * .28 + i * .12, s * .06, '#e8d060'); } icc(c, s * .5, s * .2, s * .08, '#f0e08a'); },
  crop_strawberry(c, s) { c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(s * .5, s * .82); c.lineTo(s * .74, s * .45); c.lineTo(s * .26, s * .45); c.closePath(); c.fill(); ir(c, s * .38, s * .24, s * .24, s * .14, '#3a8a3a'); c.fillStyle = '#ffe'; icc(c, s * .42, s * .55, s * .025, '#ffe'); icc(c, s * .58, s * .6, s * .025, '#ffe'); icc(c, s * .5, s * .68, s * .025, '#ffe'); },
  crop_pumpkin(c, s) { icc(c, s * .5, s * .58, s * .32, '#d9822b'); c.strokeStyle = '#b5651d'; c.lineWidth = 1; c.beginPath(); c.moveTo(s * .5, s * .3); c.lineTo(s * .5, s * .85); c.stroke(); ir(c, s * .46, s * .2, s * .08, s * .14, '#3a6b2a'); icc(c, s * .4, s * .5, s * .05, '#e89a4a'); },
  crop_tomato(c, s) { icc(c, s * .5, s * .56, s * .28, '#d43c2c'); icc(c, s * .42, s * .48, s * .08, '#e85a4a'); ir(c, s * .44, s * .26, s * .12, s * .1, '#3a8a3a'); c.fillStyle = '#3a8a3a'; c.beginPath(); c.moveTo(s * .5, s * .3); c.lineTo(s * .4, s * .22); c.lineTo(s * .6, s * .22); c.closePath(); c.fill(); },
  egg(c, s) { c.fillStyle = '#f4ecd8'; c.beginPath(); c.ellipse(s * .5, s * .55, s * .22, s * .3, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fffef8'; c.beginPath(); c.ellipse(s * .44, s * .45, s * .07, s * .1, 0, 0, Math.PI * 2); c.fill(); },
  milk(c, s) { ir(c, s * .3, s * .25, s * .4, s * .55, '#f2f2ee'); ir(c, s * .3, s * .25, s * .12, s * .55, '#fff'); ir(c, s * .32, s * .18, s * .36, s * .1, '#3a7fc1'); ir(c, s * .36, s * .5, s * .28, s * .12, '#3a7fc1'); },
  hay(c, s) { ir(c, s * .18, s * .35, s * .64, s * .35, '#d9b84a'); ir(c, s * .18, s * .35, s * .64, s * .08, '#e8cc60'); c.strokeStyle = '#a88a30'; c.lineWidth = 1; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s * .25 + i * .18, s * .38); c.lineTo(s * .3 + i * .18, s * .67); c.stroke(); } ir(c, s * .42, s * .32, s * .16, s * .06, '#a05a2a'); },
  fence_item(c, s) { ir(c, s * .26, s * .15, s * .12, s * .6, '#7a5730'); ir(c, s * .26, s * .15, s * .05, s * .6, '#95724a'); ir(c, s * .6, s * .15, s * .12, s * .6, '#7a5730'); ir(c, s * .6, s * .15, s * .05, s * .6, '#95724a'); ir(c, s * .2, s * .35, s * .6, s * .08, '#6b4a2b'); ir(c, s * .2, s * .55, s * .6, s * .08, '#6b4a2b'); },
  chest_item(c, s) { ir(c, s * .15, s * .45, s * .7, s * .35, '#6b4423'); ir(c, s * .15, s * .28, s * .7, s * .2, '#7d5330'); ir(c, s * .15, s * .28, s * .7, s * .05, '#956838'); ir(c, s * .42, s * .4, s * .16, s * .12, '#d8b24a'); },
  furnace_item(c, s) { ir(c, s * .2, s * .15, s * .6, s * .7, '#5a5a5e'); ir(c, s * .2, s * .15, s * .6, s * .06, '#727276'); ir(c, s * .36, s * .5, s * .28, s * .25, '#1a1512'); c.fillStyle = '#ff8c1a'; c.beginPath(); c.moveTo(s * .5, s * .52); c.lineTo(s * .62, s * .73); c.lineTo(s * .38, s * .73); c.closePath(); c.fill(); },
  scarecrow_item(c, s) { ir(c, s * .46, s * .12, s * .08, s * .65, '#7a5730'); ir(c, s * .28, s * .3, s * .44, s * .06, '#7a5730'); icc(c, s * .5, s * .2, s * .14, '#e8c88a'); ir(c, s * .38, s * .05, s * .24, s * .06, '#5a3d24'); ir(c, s * .28, s * .42, s * .44, s * .18, '#d9b84a'); },
  torch_item(c, s) { ir(c, s * .44, s * .4, s * .12, s * .5, '#5a3d24'); c.fillStyle = '#ff8c1a'; c.beginPath(); c.moveTo(s * .5, s * .12); c.lineTo(s * .66, s * .42); c.lineTo(s * .34, s * .42); c.closePath(); c.fill(); c.fillStyle = '#ffd25a'; icc(c, s * .5, s * .34, s * .08, '#ffd25a'); },
  cooked_meal(c, s) { icc(c, s * .5, s * .6, s * .32, '#c8c8d0'); icc(c, s * .5, s * .58, s * .26, '#c86038'); icc(c, s * .42, s * .52, s * .06, '#e89a4a'); icc(c, s * .58, s * .56, s * .05, '#8a3a2a'); c.fillStyle = 'rgba(255,255,255,0.4)'; icc(c, s * .4, s * .5, s * .04, 'rgba(255,255,255,0.5)'); },
  sword_upgrade(c, s) { ir(c, s * .46, s * .1, s * .08, s * .6, '#ffe066'); ir(c, s * .46, s * .1, s * .03, s * .6, '#fff6c0'); ir(c, s * .3, s * .65, s * .4, s * .1, '#8a6a3a'); c.fillStyle = '#fff8c0'; c.beginPath(); c.arc(s * .5, s * .16, s * .06, 0, Math.PI * 2); c.fill(); },
  pickaxe_upgrade(c, s) { ir(c, s * .46, s * .2, s * .08, s * .6, '#ffe066'); ir(c, s * .2, s * .12, s * .6, s * .14, '#ffd700'); ir(c, s * .2, s * .12, s * .6, s * .05, '#fff4a0'); },
  axe_upgrade(c, s) { ir(c, s * .46, s * .15, s * .08, s * .6, '#ffe066'); icc(c, s * .5, s * .2, s * .18, '#ffd700'); icc(c, s * .46, s * .17, s * .1, '#fff4a0'); },
  fishingrod(c, s) { c.strokeStyle = '#8a6a3a'; c.lineWidth = s * .07; c.beginPath(); c.moveTo(s * .2, s * .85); c.lineTo(s * .72, s * .18); c.stroke(); c.strokeStyle = '#dcdce4'; c.lineWidth = 1; c.beginPath(); c.moveTo(s * .72, s * .18); c.lineTo(s * .78, s * .6); c.stroke(); icc(c, s * .78, s * .64, s * .06, '#e33'); },
  fish_perch(c, s) { c.fillStyle = '#7a9a5a'; c.beginPath(); c.ellipse(s * .48, s * .55, s * .28, s * .15, -0.2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#5a7a3a'; c.beginPath(); c.moveTo(s * .72, s * .5); c.lineTo(s * .86, s * .4); c.lineTo(s * .86, s * .64); c.closePath(); c.fill(); icc(c, s * .32, s * .5, s * .03, '#111'); },
  fish_carp(c, s) { c.fillStyle = '#b8935a'; c.beginPath(); c.ellipse(s * .48, s * .55, s * .3, s * .18, -0.15, 0, Math.PI * 2); c.fill(); c.fillStyle = '#93703a'; c.beginPath(); c.moveTo(s * .74, s * .5); c.lineTo(s * .9, s * .38); c.lineTo(s * .9, s * .66); c.closePath(); c.fill(); icc(c, s * .3, s * .5, s * .03, '#111'); },
  fish_trout(c, s) { c.fillStyle = '#7a9ac4'; c.beginPath(); c.ellipse(s * .48, s * .55, s * .3, s * .16, -0.2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e88aa0'; ir(c, s * .3, s * .5, s * .34, s * .05); c.fillStyle = '#5a7aa4'; c.beginPath(); c.moveTo(s * .74, s * .5); c.lineTo(s * .9, s * .38); c.lineTo(s * .9, s * .66); c.closePath(); c.fill(); icc(c, s * .3, s * .5, s * .03, '#111'); },
  fish_king(c, s) { c.fillStyle = '#e0bc30'; c.beginPath(); c.ellipse(s * .48, s * .58, s * .3, s * .18, -0.15, 0, Math.PI * 2); c.fill(); c.fillStyle = '#a8871a'; c.beginPath(); c.moveTo(s * .74, s * .53); c.lineTo(s * .9, s * .4); c.lineTo(s * .9, s * .7); c.closePath(); c.fill(); c.fillStyle = '#ffd700'; c.beginPath(); c.moveTo(s * .34, s * .34); c.lineTo(s * .4, s * .2); c.lineTo(s * .46, s * .32); c.lineTo(s * .52, s * .2); c.lineTo(s * .58, s * .34); c.closePath(); c.fill(); icc(c, s * .32, s * .54, s * .03, '#111'); },
  berry(c, s) { icc(c, s * .38, s * .5, s * .14, '#d43a5a'); icc(c, s * .6, s * .45, s * .14, '#c42a4a'); icc(c, s * .5, s * .65, s * .14, '#e44a6a'); c.fillStyle = 'rgba(255,255,255,0.5)'; icc(c, s * .35, s * .46, s * .04, 'rgba(255,255,255,0.6)'); ir(c, s * .46, s * .25, s * .08, s * .14, '#3a8a3a'); },
  bridge_item(c, s) { ir(c, s * .15, s * .3, s * .7, s * .4, '#8a6238'); c.fillStyle = '#a8825a'; for (let i = 0; i < 4; i++) ir(c, s * (.17 + i * .17), s * .3, s * .12, s * .4, '#a8825a'); ir(c, s * .15, s * .28, s * .7, s * .05, '#6b4a2b'); ir(c, s * .15, s * .67, s * .7, s * .05, '#6b4a2b'); },
  seed_carrot(c, s) { ir(c, s * .32, s * .3, s * .36, s * .42, '#c8a86a'); icc(c, s * .5, s * .28, s * .1, '#e8760f'); },
  seed_corn(c, s) { ir(c, s * .32, s * .3, s * .36, s * .42, '#c8a86a'); icc(c, s * .5, s * .28, s * .1, '#f2d94e'); },
  seed_blueberry(c, s) { ir(c, s * .32, s * .3, s * .36, s * .42, '#c8a86a'); icc(c, s * .5, s * .28, s * .1, '#4a5fc4'); },
  crop_carrot(c, s) { c.fillStyle = '#e8760f'; c.beginPath(); c.moveTo(s * .5, s * .88); c.lineTo(s * .64, s * .4); c.lineTo(s * .36, s * .4); c.closePath(); c.fill(); c.fillStyle = '#3a8a3a'; ir(c, s * .42, s * .2, s * .05, s * .2); ir(c, s * .5, s * .18, s * .05, s * .22); ir(c, s * .57, s * .2, s * .05, s * .2); c.fillStyle = '#f2924a'; ir(c, s * .44, s * .45, s * .05, s * .3); },
  crop_corn(c, s) { c.fillStyle = '#f2d94e'; c.beginPath(); c.ellipse(s * .5, s * .55, s * .14, s * .3, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e0bc30'; for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) icc(c, s * (.44 + i * .06), s * (.36 + j * .12), s * .022, '#c9a030'); c.fillStyle = '#5a9a3a'; c.beginPath(); c.moveTo(s * .36, s * .8); c.quadraticCurveTo(s * .3, s * .4, s * .42, s * .3); c.lineTo(s * .42, s * .8); c.closePath(); c.fill(); },
  crop_blueberry(c, s) { icc(c, s * .4, s * .55, s * .13, '#4a5fc4'); icc(c, s * .6, s * .5, s * .13, '#5a6fd4'); icc(c, s * .5, s * .68, s * .13, '#3a4fb4'); c.fillStyle = 'rgba(255,255,255,0.4)'; icc(c, s * .37, s * .5, s * .04, 'rgba(255,255,255,0.5)'); ir(c, s * .46, s * .28, s * .08, s * .12, '#3a8a3a'); },
  default(c, s) { ir(c, s * .3, s * .3, s * .4, s * .4, '#888'); },
};
