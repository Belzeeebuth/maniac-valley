// ============================================================================
// PostFX — post-traitement "shader-like" en Canvas 2D :
//  • Bloom / lumières émissives : les sources lumineuses sont peintes dans un
//    tampon demi-résolution puis floutées et ajoutées en 'lighter'.
//  • Color grading cinématographique (multiply / screen / soft-light / satur.)
//    selon l'heure, la météo et la scène.
//  • Grain de film + fines scanlines pour une texture cohérente.
//  • Vignette.
// Aucune dépendance : tout repose sur les modes de fusion natifs du canvas.
// ============================================================================

export class PostFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.glow = document.createElement('canvas');
    this.gctx = this.glow.getContext('2d');
    this.scale = 0.5; // tampon de bloom en demi-résolution (perf + douceur)
    this._grain = this._makeGrain(160);
    this.resize();
  }

  resize() {
    this.glow.width = Math.max(1, Math.ceil(this.canvas.width * this.scale));
    this.glow.height = Math.max(1, Math.ceil(this.canvas.height * this.scale));
  }

  _makeGrain(size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const c = cv.getContext('2d');
    const img = c.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    return cv;
  }

  // ---- Bloom / lumières ----
  beginLights() { this.gctx.clearRect(0, 0, this.glow.width, this.glow.height); }

  // (sx,sy,r) en coordonnées écran plein format ; color "r,g,b".
  addLight(sx, sy, r, color, intensity = 1) {
    const g = this.gctx, s = this.scale;
    const x = sx * s, y = sy * s, rr = r * s;
    const grd = g.createRadialGradient(x, y, 1, x, y, rr);
    grd.addColorStop(0, `rgba(${color},${0.9 * intensity})`);
    grd.addColorStop(0.4, `rgba(${color},${0.35 * intensity})`);
    grd.addColorStop(1, `rgba(${color},0)`);
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  }

  compositeLights(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // halo doux (flou)
    ctx.filter = 'blur(6px)';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(this.glow, 0, 0, this.canvas.width, this.canvas.height);
    // coeur net pour les points chauds
    ctx.filter = 'blur(1px)';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(this.glow, 0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // ---- Color grading ----
  // layers : [{ op, color, alpha }]
  applyGrade(ctx, layers) {
    if (!layers || !layers.length) return;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.save();
    for (const l of layers) {
      ctx.globalCompositeOperation = l.op;
      ctx.globalAlpha = l.alpha;
      ctx.fillStyle = l.color;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  // ---- Grain + scanlines ----
  grain(ctx, alpha = 0.045) {
    const W = this.canvas.width, H = this.canvas.height;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = alpha;
    const ox = (Math.random() * this._grain.width) | 0;
    const oy = (Math.random() * this._grain.height) | 0;
    const pat = ctx.createPattern(this._grain, 'repeat');
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pat;
    ctx.fillRect(ox, oy, W, H);
    ctx.restore();
    // scanlines très discrètes
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  vignette(ctx, strength = 0.34) {
    const W = this.canvas.width, H = this.canvas.height;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}
