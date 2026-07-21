// ============================================================================
// InputHandler — état clavier/souris + événements de haut niveau.
// ============================================================================

export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };
    this._justPressed = {};
    this._onPrimary = null;   // clic gauche / action
    this._onDodge = null;     // barre espace
    this._onHotbar = null;    // touches 1..0
    this._onToggle = null;    // E / C / J / Escape

    window.addEventListener('keydown', (e) => this._keydown(e));
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        const r = canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
        this.mouse.down = true; if (this._onPrimary) this._onPrimary();
      }
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _keydown(e) {
    if (e.repeat) { this.keys[e.code] = true; return; }
    this.keys[e.code] = true;

    if (e.code === 'Space') { e.preventDefault(); if (this._onDodge) this._onDodge(); return; }
    if (/^Digit[0-9]$/.test(e.code)) {
      let n = parseInt(e.code.slice(5), 10);
      n = (n === 0) ? 10 : n;
      if (this._onHotbar) this._onHotbar(n - 1);
      return;
    }
    if (['KeyE', 'KeyC', 'KeyJ', 'KeyM', 'Escape'].includes(e.code)) {
      if (this._onToggle) this._onToggle(e.code);
    }
  }

  onPrimary(fn) { this._onPrimary = fn; }
  onDodge(fn) { this._onDodge = fn; }
  onHotbar(fn) { this._onHotbar = fn; }
  onToggle(fn) { this._onToggle = fn; }

  // Vecteur de déplacement normalisé (ZQSD / WASD / flèches)
  moveVector() {
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k['KeyW'] || k['KeyZ'] || k['ArrowUp']) dy -= 1;
    if (k['KeyS'] || k['ArrowDown']) dy += 1;
    if (k['KeyA'] || k['KeyQ'] || k['ArrowLeft']) dx -= 1;
    if (k['KeyD'] || k['ArrowRight']) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
    }
    return { dx, dy };
  }
}
