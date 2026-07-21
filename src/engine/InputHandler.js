// ============================================================================
// InputHandler — clavier/souris + contrôles tactiles (joystick virtuel et
// boutons) + manette (Gamepad API). Fournit un vecteur de déplacement fusionné
// et des événements de haut niveau. `aimSource` indique si la visée doit
// suivre la souris ou l'orientation du joueur (tactile/manette).
// ============================================================================

export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };
    this.aimSource = 'mouse'; // 'mouse' | 'pad'
    this._onPrimary = null;
    this._onDodge = null;
    this._onHotbar = null;
    this._onToggle = null;

    // tactile
    this.touchMove = { dx: 0, dy: 0 };
    this._joyId = null; this._joyBase = { x: 0, y: 0 };

    // manette
    this._padPrev = [];
    this.padConnected = false;

    window.addEventListener('keydown', (e) => this._keydown(e));
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.aimSource = 'mouse';
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        const r = canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
        this.aimSource = 'mouse';
        this.mouse.down = true; if (this._onPrimary) this._onPrimary();
      }
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this._setupTouch();
    window.addEventListener('gamepadconnected', () => { this.padConnected = true; });
    window.addEventListener('gamepaddisconnected', () => { this.padConnected = false; });
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

  // ---------------- Tactile ----------------
  _setupTouch() {
    if (!('ontouchstart' in window)) return;
    document.body.classList.add('touch');

    const joy = document.getElementById('touchJoystick');
    const knob = document.getElementById('touchKnob');
    const btnA = document.getElementById('touchAction');
    const btnB = document.getElementById('touchDodge');
    if (!joy || !btnA) return;

    const R = 44; // rayon utile du joystick
    joy.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this._joyId = t.identifier;
      const r = joy.getBoundingClientRect();
      this._joyBase = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { passive: false });
    joy.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joyId) continue;
        let dx = t.clientX - this._joyBase.x, dy = t.clientY - this._joyBase.y;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx = dx / len * R; dy = dy / len * R; }
        this.touchMove.dx = dx / R; this.touchMove.dy = dy / R;
        if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.aimSource = 'pad';
      }
    }, { passive: false });
    const endJoy = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joyId) continue;
        this._joyId = null;
        this.touchMove.dx = 0; this.touchMove.dy = 0;
        if (knob) knob.style.transform = 'translate(0,0)';
      }
    };
    joy.addEventListener('touchend', endJoy);
    joy.addEventListener('touchcancel', endJoy);

    btnA.addEventListener('touchstart', (e) => { e.preventDefault(); this.aimSource = 'pad'; if (this._onPrimary) this._onPrimary(); }, { passive: false });
    if (btnB) btnB.addEventListener('touchstart', (e) => { e.preventDefault(); if (this._onDodge) this._onDodge(); }, { passive: false });

    // tap direct sur le canvas = visée + action à cet endroit
    this.canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = t.clientX - r.left; this.mouse.y = t.clientY - r.top;
      this.aimSource = 'mouse';
      if (this._onPrimary) this._onPrimary();
    }, { passive: true });
  }

  // ---------------- Manette (appelée chaque frame) ----------------
  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && (pads[0] || pads[1] || pads[2] || pads[3]);
    if (!pad) return;
    this.padConnected = true;

    const dead = 0.22;
    const ax = Math.abs(pad.axes[0]) > dead ? pad.axes[0] : 0;
    const ay = Math.abs(pad.axes[1]) > dead ? pad.axes[1] : 0;
    this.padMove = { dx: ax, dy: ay };
    if (ax || ay) this.aimSource = 'pad';

    const pressed = (i) => pad.buttons[i] && pad.buttons[i].pressed;
    const edge = (i) => pressed(i) && !this._padPrev[i];

    if (edge(0)) { this.aimSource = 'pad'; if (this._onPrimary) this._onPrimary(); }   // A : action
    if (edge(1)) { if (this._onDodge) this._onDodge(); }                                 // B : esquive
    if (edge(4)) { if (this._onHotbar) this._onHotbar('prev'); }                        // LB
    if (edge(5)) { if (this._onHotbar) this._onHotbar('next'); }                        // RB
    if (edge(9)) { if (this._onToggle) this._onToggle('KeyE'); }                        // Start : inventaire
    if (edge(8)) { if (this._onToggle) this._onToggle('KeyJ'); }                        // Select : quêtes
    if (edge(3)) { if (this._onToggle) this._onToggle('KeyC'); }                        // Y : fabrication

    this._padPrev = pad.buttons.map(b => b.pressed);
  }

  onPrimary(fn) { this._onPrimary = fn; }
  onDodge(fn) { this._onDodge = fn; }
  onHotbar(fn) { this._onHotbar = fn; }
  onToggle(fn) { this._onToggle = fn; }

  // Vecteur de déplacement fusionné : clavier + tactile + manette.
  moveVector() {
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k['KeyW'] || k['KeyZ'] || k['ArrowUp']) dy -= 1;
    if (k['KeyS'] || k['ArrowDown']) dy += 1;
    if (k['KeyA'] || k['KeyQ'] || k['ArrowLeft']) dx -= 1;
    if (k['KeyD'] || k['ArrowRight']) dx += 1;
    if (!dx && !dy && (this.touchMove.dx || this.touchMove.dy)) { dx = this.touchMove.dx; dy = this.touchMove.dy; }
    if (!dx && !dy && this.padMove && (this.padMove.dx || this.padMove.dy)) { dx = this.padMove.dx; dy = this.padMove.dy; }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; } // diagonales clavier normalisées, analogique conservé
    return { dx, dy };
  }
}
