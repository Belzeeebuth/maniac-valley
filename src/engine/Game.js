// ============================================================================
// Game — coeur du moteur : état global, construction du monde, boucle 60 FPS
// (delta-time), rendu (avec tri en profondeur), effets, cycle jour/nuit, météo
// et orchestration des systèmes/UI.
// ============================================================================

import { TILE, OT, MT, TileMap, makeGrid } from '../world/TileMap.js';
import { DayNightCycle } from '../world/DayNightCycle.js';
import { generateMine, MAX_FLOOR } from '../world/MineGenerator.js';
import { Camera } from './Camera.js';
import { InputHandler } from './InputHandler.js';
import { SoundFX } from './SoundFX.js';
import { MusicFX } from './MusicFX.js';
import { Sprites } from '../graphics/SpriteSheetGenerator.js';
import { PostFX } from '../graphics/PostFX.js';
import { Player } from '../entities/Player.js';
import { makeAnimal, updateAnimal, animalProduce } from '../entities/Animal.js';
import { empowerEnemy } from '../entities/Enemy.js';
import { CROPS, growPlot, isReady } from '../entities/Crop.js';
import { Inventory, ITEMS } from '../systems/Inventory.js';
import { FarmingSystem } from '../systems/FarmingSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { Particles } from '../systems/Particles.js';
import { HUD } from '../ui/HUD.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { CraftingUI } from '../ui/CraftingUI.js';
import { QuestUI } from '../ui/QuestUI.js';
import { ShopUI } from '../ui/ShopUI.js';
import { Tooltip } from '../ui/Tooltip.js';

const OW_W = 56, OW_H = 42;
const rand = (a, b) => Math.random() * (b - a) + a;
const ri = (a, b) => Math.floor(rand(a, b + 1));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.nightCanvas = document.createElement('canvas');
    this.nightCtx = this.nightCanvas.getContext('2d');

    this.sound = SoundFX;
    this.music = new MusicFX();
    this.time = new DayNightCycle();
    this.camera = new Camera();
    this.inventory = new Inventory();

    this.scene = 'overworld';
    this.overworld = null;
    this.mine = null;
    this.player = null;

    this.effects = { floatTexts: [], shockwaves: [], fallingRocks: [], weatherParticles: [], ambient: [], fireflies: [], clouds: [], butterflies: [] };
    this.postfx = new PostFX(this.canvas);
    this.particles = new Particles();
    this._sun = { skew: 0, alpha: 0 };
    this._lightning = { timer: rand(5, 12), flash: 0, boltT: 0, bolt: null };
    this._stepAccum = 0; this._smokeT = 0; this._emberT = 0;
    this._prevPos = { x: 0, y: 0 };

    this.modals = { inventory: false, crafting: false, quests: false, shop: false };
    this.faint = false;
    this.running = false;
    this.lastTime = 0;
    this.globalT = 0;

    this.bedPos = { x: 0, y: 0 };
    this.boardPos = { x: 0, y: 0 };
    this.shopPos = { x: 0, y: 0 };
    this.minePos = { x: 0, y: 0 };

    // Systèmes
    this.farming = new FarmingSystem(this);
    this.combat = new CombatSystem(this);
    this.crafting = new CraftingSystem(this);
    this.quests = new QuestSystem(this);

    // UI
    this.tooltip = new Tooltip();
    this.hud = new HUD(this);
    this.inventoryUI = new InventoryUI(this);
    this.craftingUI = new CraftingUI(this);
    this.questUI = new QuestUI(this);
    this.shopUI = new ShopUI(this);

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._bindInput();
    this._bindUI();
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.nightCanvas.width = window.innerWidth;
    this.nightCanvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
    if (this.postfx) this.postfx.resize();
    this._initWeatherParticles();
    this._initAmbient();
  }

  // ---------------- Entrées ----------------
  _bindInput() {
    this.input = new InputHandler(this.canvas);
    this.input.onPrimary(() => { if (!this.anyModalOpen() && !this.faint) this.doAction(); });
    this.input.onDodge(() => {
      if (this.anyModalOpen() || this.faint) return;
      if (this.player.startDodge()) this.sound.play('dodge');
    });
    this.input.onHotbar((i) => this.selectHotbar(i));
    this.input.onToggle((code) => {
      if (code === 'Escape') { this.closeModals(); return; }
      if (code === 'KeyE') this.toggleModal('inventory');
      else if (code === 'KeyC') this.toggleModal('crafting');
      else if (code === 'KeyJ') this.toggleModal('quests');
      else if (code === 'KeyM') { const on = this.music.toggle(); this.toast(on ? '🎵 Musique activée' : '🔇 Musique coupée'); }
    });
  }

  _bindUI() {
    document.getElementById('btnInventory').addEventListener('click', () => this.toggleModal('inventory'));
    document.getElementById('btnCrafting').addEventListener('click', () => this.toggleModal('crafting'));
    document.getElementById('btnQuests').addEventListener('click', () => this.toggleModal('quests'));
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.closeModals()));
  }

  // ---------------- Construction du monde ----------------
  buildOverworld() {
    const grid = makeGrid(OW_W, OW_H, OT.GRASS);
    const set = (x, y, v) => { if (grid[y] && grid[y][x] !== undefined) grid[y][x] = v; };

    for (let x = 0; x < OW_W; x++) { grid[0][x] = OT.WATER; grid[OW_H - 1][x] = OT.WATER; }
    for (let y = 0; y < OW_H; y++) { grid[y][0] = OT.WATER; grid[y][OW_W - 1] = OT.WATER; }

    const riverX = 28;
    for (let y = 1; y < OW_H - 1; y++) { grid[y][riverX] = OT.WATER; if (Math.random() < 0.5) grid[y][riverX + 1] = OT.WATER; }
    for (let y = 18; y <= 20; y++) { grid[y][riverX] = OT.PATH; grid[y][riverX + 1] = OT.PATH; }
    for (let x = 2; x < OW_W - 2; x++) grid[20][x] = OT.PATH;
    for (let y = 2; y < OW_H - 2; y++) { grid[y][8] = OT.PATH; grid[y][40] = OT.PATH; }

    for (let i = 0; i < 220; i++) {
      const x = ri(2, OW_W - 3), y = ri(2, OW_H - 3);
      if (grid[y][x] === OT.GRASS) {
        const nearBorder = x < 6 || x > OW_W - 7 || y < 6 || y > OW_H - 7;
        const nearRiver = Math.abs(x - riverX) < 2;
        if (!nearRiver && ((nearBorder && Math.random() < 0.85) || (!nearBorder && Math.random() < 0.12))) grid[y][x] = OT.TREE;
      }
    }
    for (let i = 0; i < 60; i++) {
      const x = ri(2, OW_W - 3), y = ri(2, OW_H - 3);
      if (grid[y][x] === OT.GRASS && Math.random() < 0.4) grid[y][x] = OT.ROCK;
    }

    // Maison
    const buildings = [];
    const hx = 6, hy = 6, hw = 6, hh = 5;
    for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++)
      set(x, y, (x === hx || x === hx + hw - 1 || y === hy || y === hy + hh - 1) ? OT.WALL : OT.PATH);
    set(hx + 2, hy + hh - 1, OT.PATH); set(hx + 3, hy + hh - 1, OT.PATH);
    set(hx + 2, hy + 1, OT.BED);
    this.bedPos = { x: (hx + 2) * TILE + TILE / 2, y: (hy + 1) * TILE + TILE / 2 };
    buildings.push({ x: hx, y: hy, w: hw, h: hh, type: 'home' });

    for (let y = hy + hh + 1; y < hy + hh + 9; y++) for (let x = hx - 2; x < hx + 12; x++)
      if (grid[y] && grid[y][x] !== undefined && grid[y][x] !== OT.WATER) grid[y][x] = OT.GRASS;

    // Enclos animaux
    const px = hx - 2, py = hy + hh + 2, pw = 9, ph = 6;
    for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++)
      set(x, y, (x === px || x === px + pw - 1 || y === py || y === py + ph - 1) ? OT.FENCE : OT.GRASS);
    set(px + 4, py + ph - 1, OT.GRASS); set(px + 5, py + ph - 1, OT.GRASS);
    const penBounds = { x1: (px + 1) * TILE, y1: (py + 1) * TILE, x2: (px + pw - 1) * TILE, y2: (py + ph - 1) * TILE };

    // Champ pré-labouré
    const farmland = {};
    for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) {
      const gx = hx + 7 + x, gy = hy + 1 + y;
      if (grid[gy] && grid[gy][gx] === OT.GRASS) {
        grid[gy][gx] = OT.FARMLAND;
        farmland[gx + ',' + gy] = { tilled: true, watered: false, cropId: null, stage: 0 };
      }
    }

    // Boutique & panneau
    set(38, 10, OT.SHOPCOUNTER); set(39, 10, OT.SHOPCOUNTER);
    this.shopPos = { x: 38 * TILE + TILE, y: 10 * TILE + TILE / 2 };
    for (let x = 37; x <= 40; x++) for (let y = 8; y < 10; y++) set(x, y, OT.PATH);
    set(38, 16, OT.QUESTBOARD);
    this.boardPos = { x: 38 * TILE + TILE / 2, y: 16 * TILE + TILE / 2 };

    const deco = (bx, by, bw, bh) => {
      for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++)
        set(x, y, (x === bx || x === bx + bw - 1 || y === by || y === by + bh - 1) ? OT.WALL : OT.PATH);
      buildings.push({ x: bx, y: by, w: bw, h: bh, type: 'deco' });
    };
    deco(44, 8, 5, 4); deco(44, 16, 5, 4); deco(34, 26, 5, 4);

    // Entrée de mine
    const mx = 42, my = 32;
    for (let y = my - 2; y <= my + 2; y++) for (let x = mx - 3; x <= mx + 3; x++)
      if (grid[y] && grid[y][x] === OT.GRASS && Math.random() < 0.7) grid[y][x] = OT.ROCK;
    for (let y = my; y < my + 3; y++) set(mx, y, OT.PATH);
    set(mx, my, OT.MINE_ENTRANCE);
    this.minePos = { x: mx * TILE + TILE / 2, y: (my + 1) * TILE + TILE / 2 };

    const animals = [];
    for (let i = 0; i < 3; i++) animals.push(makeAnimal('chicken', rand(penBounds.x1 + 10, penBounds.x2 - 10), rand(penBounds.y1 + 10, penBounds.y2 - 10)));
    for (let i = 0; i < 2; i++) animals.push(makeAnimal('cow', rand(penBounds.x1 + 10, penBounds.x2 - 10), rand(penBounds.y1 + 10, penBounds.y2 - 10)));

    return {
      tilemap: new TileMap(grid, 'overworld'), w: OW_W, h: OW_H,
      farmland, animals, penBounds, placed: [], ground: [], buildings,
      treeHp: {}, rockHp: {}, treeTimers: {}, rockTimers: {},
    };
  }

  init() {
    this.overworld = this.buildOverworld();
    this.scene = 'overworld';
    this.player = new Player(this.bedPos.x, this.bedPos.y + 50);
    this.inventory.hotbar[0] = { id: 'sword', count: 1 };
    this.inventory.hotbar[1] = { id: 'hoe', count: 1 };
    this.inventory.hotbar[2] = { id: 'wateringcan', count: 1 };
    this.inventory.hotbar[3] = { id: 'axe', count: 1 };
    this.inventory.hotbar[4] = { id: 'pickaxe', count: 1 };
    this.inventory.add('seed_wheat', 6);
    this.inventory.add('seed_strawberry', 4);
    this.inventory.add('crop_wheat', 2);
    this.quests.generate();
    this.time.day = 1; this.time.hour = 6; this.time.weather = 'sun';
    this.camera.snap(this.player, this.overworld.w, this.overworld.h, this.canvas.width, this.canvas.height);
    this._initAmbient();
    this.hud.renderHotbar();
    this.toast('Bienvenue à Maniac Valley !');
  }

  // ---------------- Helpers scène ----------------
  curScene() { return this.scene === 'overworld' ? this.overworld : this.mine; }

  blocked(px, py, w, h) {
    const s = this.curScene();
    if (s.tilemap.boxHitsSolid(px, py, w, h)) return true;
    for (const o of s.placed) {
      if (o.type === 'torch' || o.type === 'fence') continue;
      if (px < o.gx * TILE + TILE - 2 && px + w > o.gx * TILE + 2 &&
          py < o.gy * TILE + TILE - 2 && py + h > o.gy * TILE + 2) return true;
    }
    return false;
  }

  // ---------------- Effets & feedback ----------------
  floatText(x, y, text, color, big) { this.effects.floatTexts.push({ x, y, text, color: color || '#fff', life: 0.9, vy: -40, big: !!big }); }

  loot(id, n) {
    const cont = document.getElementById('lootPopups');
    const el = document.createElement('div'); el.className = 'loot-popup';
    const cv = document.createElement('canvas'); cv.width = 22; cv.height = 22;
    Sprites.itemIcon(cv.getContext('2d'), id, 1, 1, 20);
    const txt = document.createElement('span'); txt.textContent = `+${n} ${ITEMS[id].name}`;
    el.append(cv, txt);
    cont.appendChild(el);
    while (cont.children.length > 6) cont.removeChild(cont.firstChild);
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 500); }, 1800);
  }

  toast(msg) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    const c = document.getElementById('toasts'); c.appendChild(el);
    while (c.children.length > 4) c.removeChild(c.firstChild);
    setTimeout(() => el.remove(), 2600);
  }

  flashHp() { this.hud.flashHp(); }

  selectHotbar(i) { this.inventory.selected = i; this.hud.renderHotbar(); }

  // ---------------- Modales ----------------
  anyModalOpen() { return this.modals.inventory || this.modals.crafting || this.modals.quests || this.modals.shop; }
  closeModals() {
    for (const k of Object.keys(this.modals)) this.modals[k] = false;
    ['inventoryModal', 'craftingModal', 'questModal', 'shopModal'].forEach(id => document.getElementById(id).classList.remove('open'));
    this.tooltip.hide();
  }
  toggleModal(name) {
    const willOpen = !this.modals[name];
    this.closeModals();
    if (!willOpen) return;
    this.modals[name] = true;
    const map = { inventory: 'inventoryModal', crafting: 'craftingModal', quests: 'questModal', shop: 'shopModal' };
    document.getElementById(map[name]).classList.add('open');
    if (name === 'inventory') this.inventoryUI.render();
    if (name === 'crafting') this.craftingUI.render();
    if (name === 'quests') this.questUI.render();
    if (name === 'shop') this.shopUI.render();
    this.sound.play('ui');
  }

  // ---------------- Action contextuelle ----------------
  doAction() {
    const sel = this.inventory.selectedItem;
    if (sel) {
      const it = ITEMS[sel.id];
      if (it.type === 'placeable') { this.tryPlace(sel); return; }
      if (it.type === 'seed') { this.farming.plantSeed(sel.id); return; }
      if (it.food) { this.eatItem(sel.id); return; }
    }
    if (this.tryContextInteract()) return;
    if (sel && ITEMS[sel.id].type === 'tool') this.farming.useTool(ITEMS[sel.id].tool);
  }

  tryContextInteract() {
    const p = this.player, cx = p.cx, cy = p.cy;
    if (this.scene === 'overworld') {
      if (dist(cx, cy, this.bedPos.x, this.bedPos.y) < TILE * 1.4) { this.sleepInBed(); return true; }
      if (dist(cx, cy, this.shopPos.x, this.shopPos.y) < TILE * 1.6) { this.toggleModal('shop'); return true; }
      if (dist(cx, cy, this.boardPos.x, this.boardPos.y) < TILE * 1.4) { this.toggleModal('quests'); return true; }
      if (dist(cx, cy, this.minePos.x, this.minePos.y) < TILE * 1.2) { this.enterMine(1); return true; }
      for (const a of this.overworld.animals) {
        if (dist(cx, cy, a.x, a.y) < TILE * 1.1) {
          const sel = this.inventory.selectedItem;
          if (sel && sel.id === 'hay') {
            this.inventory.remove('hay', 1); a.fed = true;
            this.toast((a.kind === 'chicken' ? 'Poule' : 'Vache') + ' nourrie !');
            this.sound.play(a.kind === 'chicken' ? 'chicken' : 'cow');
          } else this.toast('Sélectionnez du Foin pour nourrir.');
          return true;
        }
      }
      const f = p.frontTile();
      if (isReady(this.overworld.farmland[f.gx + ',' + f.gy])) { this.farming.harvest(f.gx, f.gy); return true; }
    } else {
      const m = this.mine;
      const stx = m.stairsPos.x * TILE + TILE / 2, sty = m.stairsPos.y * TILE + TILE / 2;
      if (dist(cx, cy, stx, sty) < TILE * 1.2) {
        if (m.isBoss && !m.stairsUnlocked) { this.toast('Passage scellé — vainquez le boss !'); return true; }
        this.enterMine(m.level + 1); return true;
      }
      const ex = m.entrance.x * TILE + TILE / 2, ey = m.entrance.y * TILE + TILE / 2;
      if (dist(cx, cy, ex, ey) < TILE * 1.2) { this.exitMine(); return true; }
    }
    return false;
  }

  interactPromptText() {
    const p = this.player, cx = p.cx, cy = p.cy;
    if (this.scene === 'overworld') {
      if (dist(cx, cy, this.bedPos.x, this.bedPos.y) < TILE * 1.4) return 'Clic : Dormir';
      if (dist(cx, cy, this.shopPos.x, this.shopPos.y) < TILE * 1.6) return 'Clic : Boutique';
      if (dist(cx, cy, this.boardPos.x, this.boardPos.y) < TILE * 1.4) return 'Clic : Quêtes';
      if (dist(cx, cy, this.minePos.x, this.minePos.y) < TILE * 1.2) return 'Clic : Entrer dans la Mine';
      for (const a of this.overworld.animals) if (dist(cx, cy, a.x, a.y) < TILE * 1.1) return 'Clic : Nourrir (Foin)';
      const f = p.frontTile();
      if (isReady(this.overworld.farmland[f.gx + ',' + f.gy])) return 'Clic : Récolter';
    } else {
      const m = this.mine;
      const stx = m.stairsPos.x * TILE + TILE / 2, sty = m.stairsPos.y * TILE + TILE / 2;
      const ex = m.entrance.x * TILE + TILE / 2, ey = m.entrance.y * TILE + TILE / 2;
      if (dist(cx, cy, stx, sty) < TILE * 1.2) return (m.isBoss && !m.stairsUnlocked) ? 'Passage scellé' : 'Clic : Descendre';
      if (dist(cx, cy, ex, ey) < TILE * 1.2) return m.level === 1 ? 'Clic : Sortir' : 'Clic : Remonter';
    }
    return null;
  }

  // ---------------- Placement ----------------
  placementCell() { const f = this.player.frontTile(); return { gx: f.gx, gy: f.gy }; }
  placementValid(gx, gy) {
    const s = this.curScene(), t = s.tilemap.get(gx, gy);
    if (t === -1) return false;
    if (this.scene === 'overworld') { if (t !== OT.GRASS && t !== OT.PATH) return false; }
    else if (t !== MT.FLOOR) return false;
    for (const o of s.placed) if (o.gx === gx && o.gy === gy) return false;
    if (dist(this.player.cx, this.player.cy, gx * TILE + TILE / 2, gy * TILE + TILE / 2) > TILE * 2.2) return false;
    return true;
  }
  tryPlace(sel) {
    const { gx, gy } = this.placementCell();
    if (!this.placementValid(gx, gy)) { this.toast('Emplacement invalide.'); return; }
    const it = ITEMS[sel.id], s = this.curScene();
    s.placed.push({ gx, gy, type: it.placeType });
    if (it.placeType === 'fence' && this.scene === 'overworld') s.tilemap.set(gx, gy, OT.FENCE);
    this.inventory.remove(sel.id, 1);
    this.sound.play('place');
    this.toast(it.name + ' placé.');
    this.hud.renderHotbar();
  }

  eatItem(id) {
    const it = ITEMS[id]; if (!it.food) return;
    const p = this.player;
    p.hunger = Math.min(p.maxHunger, p.hunger + it.food.hunger);
    p.hp = Math.min(p.maxHp, p.hp + (it.food.hp || 0));
    p.stamina = Math.min(p.maxStamina, p.stamina + (it.food.stam || 0));
    this.inventory.remove(id, 1);
    this.sound.play('eat');
    this.floatText(p.cx, p.y, '+' + it.food.hunger + '🍗', '#8bd450');
    if (it.food.hp) this.floatText(p.cx + 12, p.y - 6, '+' + it.food.hp, '#7dff7d');
    this.hud.renderHotbar();
  }

  // ---------------- Mines ----------------
  enterMine(level) {
    level = Math.min(Math.max(level, 1), MAX_FLOOR);
    this.mine = generateMine(level);
    if (this.time.isEclipse) for (const e of this.mine.enemies) empowerEnemy(e);
    this.scene = 'mine';
    const ex = this.mine.entrance.x * TILE + TILE / 2, ey = (this.mine.entrance.y + 1) * TILE;
    this.player.x = ex - this.player.w / 2; this.player.y = ey;
    this.camera.snap(this.player, this.mine.w, this.mine.h, this.canvas.width, this.canvas.height);
    this.sound.play('stairs');
    this.toast('Mine — Étage ' + level + (level > 10 ? ' (profondeurs maniaques)' : ''));
    if (this.mine.isBoss) setTimeout(() => { if (this.mine && this.mine.boss) { this.toast('⚠ Un boss garde ce niveau !'); this.sound.play('boss_roar'); this.camera.shake(9, 0.6); } }, 400);
  }
  exitMine() {
    this.scene = 'overworld';
    this.player.x = this.minePos.x - this.player.w / 2; this.player.y = this.minePos.y + TILE;
    this.camera.snap(this.player, this.overworld.w, this.overworld.h, this.canvas.width, this.canvas.height);
    this.sound.play('stairs');
    this.toast('Retour à la surface.');
  }

  // ---------------- Jour / sommeil / évanouissement ----------------
  advanceDay() {
    const rained = this.time.isRaining;
    this.time.day++; this.time.hour = 6;
    const ow = this.overworld;
    for (const key in ow.farmland) growPlot(ow.farmland[key], rained);
    for (const a of ow.animals) {
      if (a.fed) { ow.ground.push({ id: Math.random(), kind: 'item', item: animalProduce(a), x: a.x, y: a.y - 10 }); a.fed = false; }
    }
    for (const key in ow.treeTimers) if (ow.treeTimers[key] <= this.time.day) { const [x, y] = key.split(',').map(Number); ow.tilemap.set(x, y, OT.TREE); delete ow.treeTimers[key]; }
    for (const key in ow.rockTimers) if (ow.rockTimers[key] <= this.time.day) { const [x, y] = key.split(',').map(Number); ow.tilemap.set(x, y, OT.ROCK); delete ow.rockTimers[key]; }
    this.time.rollWeather();
    this._initWeatherParticles();
    this._initAmbient();
  }
  sleepInBed() {
    this.advanceDay();
    const p = this.player;
    p.hp = p.maxHp; p.stamina = p.maxStamina; p.hunger = Math.max(p.hunger, 70);
    this.sound.play('sleep');
    this.toast('Nouvelle journée ! Jour ' + this.time.day + ' — ' + this.time.weatherLabel().name);
  }
  collapse() {
    if (this.faint) return;
    this.faint = true;
    const lost = Math.floor(this.player.gold * 0.1);
    document.getElementById('faintText').textContent = 'Vous vous êtes évanoui...\n(-' + lost + ' or)';
    document.getElementById('faintOverlay').classList.add('show');
    this.sound.play('hurt');
    setTimeout(() => {
      this.player.gold = Math.max(0, this.player.gold - lost);
      this.advanceDay();
      this.scene = 'overworld';
      this.player.x = this.bedPos.x; this.player.y = this.bedPos.y + 40;
      this.player.hp = Math.floor(this.player.maxHp * 0.5);
      this.player.stamina = Math.floor(this.player.maxStamina * 0.5);
      this.player.hunger = Math.max(this.player.hunger, 30);
      this.player.iframes = 1.5;
      this.camera.snap(this.player, this.overworld.w, this.overworld.h, this.canvas.width, this.canvas.height);
      document.getElementById('faintOverlay').classList.remove('show');
      this.faint = false;
      this.toast('Jour ' + this.time.day + ' — Vous reprenez vos esprits.');
    }, 1800);
  }

  // ---------------- Update ----------------
  update(dt) {
    this.globalT += dt;
    if (!this.anyModalOpen() && !this.faint) {
      this.player.update(dt, this.input.moveVector(), (x, y, w, h) => this.blocked(x, y, w, h));
      const s = this.curScene();
      this.player.clampToScene(s.w, s.h);

      // Faim & régénération
      const p = this.player;
      p.hunger = Math.max(0, p.hunger - dt * (100 / 520));
      if (p.hunger <= 0) p.hp -= dt * 3;
      else p.stamina = Math.min(p.maxStamina, p.stamina + dt * 1.5);
      if (p.hp <= 0 && !this.faint) this.collapse();

      // Horloge
      this.time.advance(dt);
      if (this.time.hour >= 26 && !this.faint) this.collapse();

      if (this.scene === 'overworld') for (const a of this.overworld.animals) updateAnimal(a, dt, this.overworld.penBounds);
      this.combat.updateEnemies(dt);
      this.combat.updateEffects(dt);
      this._updateGroundPickup();
      this._updateJuice(dt);
    }
    this.particles.update(dt);

    this.camera.follow(this.player, this.curScene().w, this.curScene().h, this.canvas.width, this.canvas.height, dt);
    this._updateFloatTexts(dt);
    this._updateWeather(dt);
    this._updateAmbient(dt);
    this.music.setScene(this.scene === 'mine' ? (this.mine.boss ? 'boss' : 'mine') : 'farm');
    this.hud.update();
    this._updateInteractPrompt();
  }

  _updateGroundPickup() {
    const s = this.curScene(), p = this.player;
    for (const g of s.ground) {
      if (dist(p.cx, p.cy, g.x, g.y) < TILE * 0.85) {
        if (g.kind === 'gold') { p.gold += g.amount; this.sound.play('coin'); this.floatText(g.x, g.y, '+' + g.amount + ' or', '#ffd700'); this.particles.sparkle(g.x, g.y, '#ffe680', 6); }
        else { this.inventory.add(g.item, 1); this.loot(g.item, 1); this.sound.play('pickup'); this.particles.sparkle(g.x, g.y, '#c8ffc8', 5); this.hud.renderHotbar(); }
        g.picked = true;
      }
    }
    s.ground = s.ground.filter(g => !g.picked);
  }

  _updateFloatTexts(dt) {
    for (const f of this.effects.floatTexts) { f.y += f.vy * dt; f.life -= dt; }
    this.effects.floatTexts = this.effects.floatTexts.filter(f => f.life > 0);
  }

  _updateInteractPrompt() {
    const el = document.getElementById('interactPrompt');
    if (this.anyModalOpen() || this.faint) { el.style.display = 'none'; return; }
    const msg = this.interactPromptText();
    if (msg) { el.style.display = 'block'; el.textContent = msg; } else el.style.display = 'none';
  }

  // ---------------- Météo (particules) ----------------
  _initWeatherParticles() {
    const arr = [];
    const w = this.time && (this.time.isRaining) ? 'rain' : (this.time && this.time.weather === 'snow') ? 'snow' : null;
    if (w) {
      const n = w === 'rain' ? 220 : 140;
      for (let i = 0; i < n; i++) arr.push({ x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height, s: w === 'rain' ? rand(400, 620) : rand(30, 70), drift: w === 'snow' ? rand(-20, 20) : 60 });
    }
    this.effects.weatherParticles = arr;
    this._weatherKind = w;
  }
  _updateWeather(dt) {
    if (!this._weatherKind) return;
    for (const pcl of this.effects.weatherParticles) {
      pcl.y += pcl.s * dt;
      pcl.x += pcl.drift * dt;
      if (pcl.y > this.canvas.height) { pcl.y = -10; pcl.x = Math.random() * this.canvas.width; }
      if (pcl.x > this.canvas.width) pcl.x = 0; if (pcl.x < 0) pcl.x = this.canvas.width;
    }
  }

  // ---------------- Ambiance (pétales / feuilles / poussière / lucioles) ----------------
  _initAmbient() {
    const W = this.canvas.width, H = this.canvas.height;
    const season = this.time ? this.time.seasonKey : 'spring';
    const arr = [];
    let kind = null, n = 0;
    if (season === 'spring') { kind = 'petal'; n = 26; }
    else if (season === 'summer') { kind = 'mote'; n = 30; }
    else if (season === 'autumn') { kind = 'leaf'; n = 30; }
    for (let i = 0; i < n; i++) arr.push({
      x: Math.random() * W, y: Math.random() * H, kind,
      vx: rand(-14, -4), vy: rand(6, 18), rot: rand(0, 6.28), vr: rand(-2, 2),
      sz: kind === 'mote' ? rand(1, 2.2) : rand(3, 5.5), ph: rand(0, 6.28),
      col: kind === 'petal' ? (Math.random() < 0.5 ? '#ffd0e0' : '#fff2f6')
         : kind === 'leaf' ? (Math.random() < 0.5 ? '#c9772a' : '#a8531e') : '#ffe9a8',
    });
    this.effects.ambient = arr;
    this._ambientKind = kind;
    // lucioles (nuit)
    const ff = [];
    for (let i = 0; i < 20; i++) ff.push({ x: Math.random() * W, y: Math.random() * H, ph: rand(0, 6.28), vx: rand(-10, 10), vy: rand(-10, 10) });
    this.effects.fireflies = ff;
    // papillons (jour, printemps/été)
    const bf = [];
    if (season === 'spring' || season === 'summer') {
      for (let i = 0; i < 6; i++) bf.push({
        x: rand(4 * TILE, (this.overworld ? this.overworld.w - 4 : 40) * TILE), y: rand(4 * TILE, (this.overworld ? this.overworld.h - 4 : 30) * TILE),
        ph: rand(0, 6.28), dir: rand(0, 6.28), turnT: rand(1, 3), sp: rand(22, 38),
        col: choice(['#ffd24a', '#ff8fb8', '#7fd0ff', '#f0f0f0']),
      });
    }
    this.effects.butterflies = bf;
    // nuages dérivants (ombres au sol)
    this._initClouds();
  }

  _initClouds() {
    const clouds = [];
    const W = (this.overworld ? this.overworld.w : 56) * TILE, H = (this.overworld ? this.overworld.h : 42) * TILE;
    for (let i = 0; i < 5; i++) clouds.push({ x: rand(0, W), y: rand(0, H), rx: rand(110, 220), ry: rand(70, 130), vx: rand(9, 18) });
    this.effects.clouds = clouds;
  }

  _updateAmbient(dt) {
    const W = this.canvas.width, H = this.canvas.height;
    for (const p of this.effects.ambient) {
      p.ph += dt * 2;
      p.x += (p.vx + Math.sin(p.ph) * 8) * dt;
      p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y > H + 6) { p.y = -6; p.x = Math.random() * W; }
      if (p.x < -6) p.x = W + 6;
    }
    for (const f of this.effects.fireflies) {
      f.ph += dt * rand(1.5, 3.5);
      f.x += Math.sin(f.ph) * 12 * dt + f.vx * dt * 0.2;
      f.y += Math.cos(f.ph * 0.7) * 10 * dt + f.vy * dt * 0.2;
      if (f.x < 0) f.x = W; if (f.x > W) f.x = 0;
      if (f.y < 0) f.y = H; if (f.y > H) f.y = 0;
    }
    // papillons (monde) — vol erratique
    const ow = this.overworld;
    if (ow) for (const b of this.effects.butterflies) {
      b.ph += dt * 12; b.turnT -= dt;
      if (b.turnT <= 0) { b.turnT = rand(0.8, 2.2); b.dir += rand(-1.2, 1.2); }
      b.x += Math.cos(b.dir) * b.sp * dt;
      b.y += Math.sin(b.dir) * b.sp * dt + Math.sin(b.ph) * 6 * dt;
      b.x = Math.min(Math.max(b.x, 2 * TILE), (ow.w - 2) * TILE);
      b.y = Math.min(Math.max(b.y, 2 * TILE), (ow.h - 2) * TILE);
    }
    // nuages
    if (ow) for (const c of this.effects.clouds) {
      c.x += c.vx * dt;
      if (c.x - c.rx > ow.w * TILE) { c.x = -c.rx; c.y = rand(0, ow.h * TILE); }
    }
  }

  _firefliesActive() {
    return this.scene === 'overworld' && this.time.ambient().alpha > 0.45 && !this.time.isRaining;
  }

  // Poussière de pas, embers de torche, fumée de cheminée, éclairs d'orage.
  _updateJuice(dt) {
    const p = this.player;
    // pas
    const moved = Math.hypot(p.x - this._prevPos.x, p.y - this._prevPos.y);
    this._prevPos.x = p.x; this._prevPos.y = p.y;
    if (p.moving && !p.dodging) {
      this._stepAccum += moved;
      if (this._stepAccum > 22) { this._stepAccum = 0; this.particles.dust(p.cx, p.y + p.h, 3); }
    }
    if (p.dodging && Math.random() < 0.5) this.particles.dust(p.cx, p.y + p.h, 2);

    // embers de torche + fumée fourneau
    this._emberT -= dt;
    if (this._emberT <= 0) {
      this._emberT = 0.12;
      for (const o of this.curScene().placed) {
        if (o.type === 'torch') this.particles.ember(o.gx * TILE + TILE / 2, o.gy * TILE + 6);
        else if (o.type === 'furnace' && Math.random() < 0.6) this.particles.smoke(o.gx * TILE + TILE / 2 + 6, o.gy * TILE);
      }
    }
    // fumée de cheminée
    if (this.scene === 'overworld') {
      this._smokeT -= dt;
      if (this._smokeT <= 0) {
        this._smokeT = 0.5;
        for (const b of this.overworld.buildings) this.particles.smoke((b.x + b.w - 1.5) * TILE, b.y * TILE - 2);
      }
    }

    // éclairs pendant la pluie (overworld)
    const L = this._lightning;
    if (this.scene === 'overworld' && this.time.isRaining) {
      L.timer -= dt;
      if (L.timer <= 0) {
        L.timer = rand(6, 16);
        L.flash = 1; L.boltT = 0.2;
        L.bolt = this._makeBolt();
        this.sound.play('thunder');
        this.camera.shake(7, 0.5);
      }
    }
    if (L.flash > 0) L.flash -= dt * 3.2;
    if (L.boltT > 0) L.boltT -= dt;
  }

  _makeBolt() {
    const pts = [];
    let x = rand(this.canvas.width * 0.2, this.canvas.width * 0.8), y = 0;
    const segH = this.canvas.height / 10;
    while (y < this.canvas.height * 0.75) { pts.push({ x, y }); y += segH * rand(0.6, 1.1); x += rand(-40, 40); }
    return pts;
  }

  _renderAmbient() {
    if (this.scene !== 'overworld') return;
    const ctx = this.ctx;
    for (const p of this.effects.ambient) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = 0.85;
      ctx.fillStyle = p.col;
      if (p.kind === 'mote') { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(0, 0, p.sz, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.ellipse(0, 0, p.sz, p.sz * 0.55, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // papillons (jour, hors pluie) — ailes battantes
    const daytime = this.time.ambient().alpha < 0.35 && !this.time.isRaining;
    if (daytime) {
      const cam = this.camera;
      for (const b of this.effects.butterflies) {
        const x = b.x - cam.x, y = b.y - cam.y;
        if (x < -20 || x > this.canvas.width + 20 || y < -20 || y > this.canvas.height + 20) continue;
        const flap = Math.abs(Math.sin(b.ph)) * 4 + 1;
        ctx.fillStyle = b.col;
        ctx.beginPath(); ctx.ellipse(x - 2, y, flap, 3.5, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 2, y, flap, 3.5, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x - 0.5, y - 2, 1, 4);
      }
    }
    // corps des lucioles (le halo est ajouté au bloom)
    if (this._firefliesActive()) {
      for (const f of this.effects.fireflies) {
        const a = 0.5 + Math.sin(f.ph) * 0.5;
        ctx.globalAlpha = a; ctx.fillStyle = '#eaffa0';
        ctx.beginPath(); ctx.arc(f.x, f.y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------------- Ombres directionnelles (soleil) ----------------
  _computeSun() {
    if (this.scene !== 'overworld') { this._sun = { skew: 0, alpha: 0 }; return; }
    const amb = this.time.ambient();
    const daylight = Math.max(0, 1 - amb.alpha * 1.7);
    const skew = Math.max(-1.4, Math.min(1.4, (this.time.hour - 13) / 6));
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

  // ---------------- Color grading ----------------
  _computeGrade() {
    const g = [];
    if (this.scene === 'mine') {
      g.push({ op: 'multiply', color: '#28324a', alpha: 0.34 });
      g.push({ op: 'soft-light', color: '#1e3e50', alpha: 0.40 });
      return g;
    }
    const h = this.time.hour, w = this.time.weather;
    if (w === 'eclipse') { g.push({ op: 'multiply', color: '#3a1030', alpha: 0.5 }); g.push({ op: 'soft-light', color: '#7a1050', alpha: 0.42 }); return g; }
    if (w === 'rain') { g.push({ op: 'saturation', color: '#808080', alpha: 0.38 }); g.push({ op: 'multiply', color: '#4a5a72', alpha: 0.30 }); g.push({ op: 'soft-light', color: '#38507a', alpha: 0.34 }); return g; }
    if (w === 'snow') { g.push({ op: 'soft-light', color: '#a8c4e4', alpha: 0.32 }); g.push({ op: 'screen', color: '#20304a', alpha: 0.12 }); return g; }
    if (h >= 6 && h < 8) { g.push({ op: 'soft-light', color: '#ff9a6a', alpha: 0.40 }); g.push({ op: 'multiply', color: '#ffdcc4', alpha: 0.14 }); }
    else if (h >= 8 && h < 16) { g.push({ op: 'soft-light', color: '#fff2c0', alpha: 0.18 }); }
    else if (h >= 16 && h < 19) { g.push({ op: 'soft-light', color: '#ffb04a', alpha: 0.44 }); g.push({ op: 'multiply', color: '#ffe0b0', alpha: 0.16 }); }
    else { g.push({ op: 'multiply', color: '#26304e', alpha: 0.34 }); g.push({ op: 'soft-light', color: '#3a4e82', alpha: 0.42 }); }
    return g;
  }

  // ---------------- Lumières émissives (bloom) ----------------
  _renderLights() {
    const fx = this.postfx, cam = this.camera, p = this.player;
    fx.beginLights();
    const amb = this.scene === 'overworld' ? this.time.ambient() : { alpha: 0.6 };
    const night = amb.alpha > 0.35;
    const flick = 0.8 + Math.sin(this.globalT * 12) * 0.2;

    if (night || this.scene === 'mine') fx.addLight(p.cx - cam.x, p.cy - cam.y, 170, '255,180,95', night ? 0.62 : 0.5);

    for (const o of this.curScene().placed) {
      const lx = o.gx * TILE + TILE / 2 - cam.x, ly = o.gy * TILE + TILE / 2 - cam.y;
      if (o.type === 'torch') fx.addLight(lx, ly - 6, 118, '255,150,55', (night ? 0.9 : 0.45) * flick);
      else if (o.type === 'furnace') fx.addLight(lx, ly, 88, '255,120,40', 0.62 * flick);
    }
    for (const g of this.curScene().ground) if (g.kind === 'gold') fx.addLight(g.x - cam.x, g.y - cam.y, 34, '255,215,90', 0.5);

    if (this.scene === 'overworld') {
      // lueur douce des récoltes prêtes (visibles)
      const ow = this.overworld;
      const sx0 = Math.max(0, (cam.x / TILE) | 0), sy0 = Math.max(0, (cam.y / TILE) | 0);
      const sx1 = Math.min(ow.w, ((cam.x + this.canvas.width) / TILE | 0) + 1);
      const sy1 = Math.min(ow.h, ((cam.y + this.canvas.height) / TILE | 0) + 1);
      for (let gy = sy0; gy < sy1; gy++) for (let gx = sx0; gx < sx1; gx++) {
        const pl = ow.farmland[gx + ',' + gy];
        if (pl && pl.cropId && pl.stage >= 3) fx.addLight(gx * TILE + 16 - cam.x, gy * TILE + 13 - cam.y, 26, '255,240,150', 0.4);
      }
      if (this._firefliesActive()) for (const f of this.effects.fireflies) fx.addLight(f.x, f.y, 22, '200,255,140', 0.5 + Math.sin(f.ph) * 0.4);
    } else if (this.mine && this.mine.boss) {
      const b = this.mine.boss;
      fx.addLight(b.x - cam.x, b.y - cam.y, 60, b.kind === 'boss_gigaslime' ? '180,80,220' : '255,90,60', 0.5);
    }
    fx.compositeLights(this.ctx);
  }

  // ---------------- Rendu (pipeline avec post-traitement) ----------------
  render() {
    const ctx = this.ctx;
    this._computeSun();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // 1) monde + ambiance + météo (couche "scène")
    if (this.scene === 'overworld') this._renderOverworld();
    else this._renderMine();
    this.particles.draw(ctx, this.camera);
    this._renderAmbient();
    this._renderPlacementPreview();
    this._renderWeather();
    // 2) obscurité (masque de visibilité)
    this._renderNight();
    // 3) color grading cinématographique de la scène
    this.postfx.applyGrade(ctx, this._computeGrade());
    // 4) lumières émissives (bloom) par-dessus le grade
    this._renderLights();
    // 5) éclairs d'orage (par-dessus tout, avant le grain)
    this._renderLightning();
    // 6) textes flottants nets, puis grain + vignette
    this._renderFloatTexts();
    this.postfx.grain(ctx, 0.04);
    this.postfx.vignette(ctx, 0.32);
  }

  _renderClouds() {
    if (this.scene !== 'overworld') return;
    if (this.time.isRaining) return;
    const ctx = this.ctx, cam = this.camera;
    ctx.save();
    for (const c of this.effects.clouds) {
      const x = c.x - cam.x, y = c.y - cam.y;
      if (x + c.rx < 0 || x - c.rx > this.canvas.width) continue;
      const g = ctx.createRadialGradient(x, y, 10, x, y, c.rx);
      g.addColorStop(0, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, c.rx, c.ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _renderLightning() {
    const L = this._lightning, ctx = this.ctx;
    if (L.flash > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(200,215,255,${Math.min(0.7, L.flash * 0.7)})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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

  _renderOverworld() {
    const ctx = this.ctx, ow = this.overworld, cam = this.camera, season = this.time.seasonKey;
    const sx0 = Math.max(0, (cam.x / TILE) | 0), sy0 = Math.max(0, (cam.y / TILE) | 0);
    const sx1 = Math.min(ow.w, ((cam.x + this.canvas.width) / TILE | 0) + 1);
    const sy1 = Math.min(ow.h, ((cam.y + this.canvas.height) / TILE | 0) + 1);
    const T = ow.tilemap;
    // Masque d'écume/bordure : côtés dont le voisin diffère de la tuile donnée.
    const edgeMask = (gx, gy, val, isWater) => {
      const diff = (v) => isWater ? (v !== OT.WATER && v !== -1) : (v !== val && v !== -1);
      return { n: diff(T.get(gx, gy - 1)), s: diff(T.get(gx, gy + 1)), e: diff(T.get(gx + 1, gy)), w: diff(T.get(gx - 1, gy)) };
    };

    for (let gy = sy0; gy < sy1; gy++) for (let gx = sx0; gx < sx1; gx++) {
      const t = T.get(gx, gy);
      const x = gx * TILE - cam.x, y = gy * TILE - cam.y, v = (gx * 7 + gy * 13) % 9;
      if (t === OT.WATER) Sprites.water(ctx, x, y, this.globalT, edgeMask(gx, gy, OT.WATER, true));
      else if (t === OT.PATH) Sprites.path(ctx, x, y, v, edgeMask(gx, gy, OT.PATH, false));
      else if (t === OT.FARMLAND) { const pl = ow.farmland[gx + ',' + gy]; Sprites.farmland(ctx, x, y, pl && pl.watered); }
      else Sprites.grass(ctx, x, y, v, season);
      if (t === OT.WALL) Sprites.wall(ctx, x, y, T.get(gx, gy - 1) !== OT.WALL);
      else if (t === OT.BED) Sprites.bed(ctx, x, y);
      else if (t === OT.QUESTBOARD) Sprites.questBoard(ctx, x, y);
      else if (t === OT.SHOPCOUNTER) Sprites.shopCounter(ctx, x, y);
      else if (t === OT.MINE_ENTRANCE) Sprites.mineEntrance(ctx, x, y);
      else if (t === OT.FENCE) Sprites.fence(ctx, x, y);
      else if (t === OT.ROCK) Sprites.rock(ctx, x, y);
      else if (t === OT.FARMLAND) { const pl = ow.farmland[gx + ',' + gy]; if (pl && pl.cropId) Sprites.cropStage(ctx, x, y, pl.cropId, pl.stage); }
    }

    // Détails des bâtiments : fenêtres aux angles de façade + porte (maisons déco)
    for (const b of ow.buildings) {
      const fy = (b.y + b.h - 1) * TILE - cam.y;
      Sprites.window(ctx, b.x * TILE - cam.x, fy);
      Sprites.window(ctx, (b.x + b.w - 1) * TILE - cam.x, fy);
      if (b.type === 'deco') Sprites.door(ctx, (b.x + (b.w / 2 | 0)) * TILE - cam.x, fy);
    }

    // Ombres de nuages qui défilent (au-dessus du sol, sous les entités)
    this._renderClouds();

    const drawables = [];
    for (let gy = sy0; gy < sy1; gy++) for (let gx = sx0; gx < sx1; gx++)
      if (ow.tilemap.get(gx, gy) === OT.TREE)
        drawables.push({ y: gy * TILE + TILE, fn: () => {
          this._sunShadow(gx * TILE + TILE / 2 - cam.x, gy * TILE + TILE - 2 - cam.y, 15, 9);
          Sprites.tree(ctx, gx * TILE - cam.x, gy * TILE - cam.y, this.globalT, season);
        } });
    for (const o of ow.placed) {
      if (o.type === 'fence') continue;
      const x = o.gx * TILE - cam.x, y = o.gy * TILE - cam.y;
      drawables.push({ y: o.gy * TILE + TILE, fn: () => {
        if (o.type === 'chest') Sprites.chest(ctx, x, y);
        else if (o.type === 'furnace') Sprites.furnace(ctx, x, y, this.globalT);
        else if (o.type === 'scarecrow') Sprites.scarecrow(ctx, x, y);
        else if (o.type === 'torch') Sprites.torch(ctx, x, y, this.globalT);
      } });
    }
    drawables.push({ y: this.shopPos.y, fn: () => Sprites.shopkeeper(ctx, this.shopPos.x - cam.x, this.shopPos.y - cam.y - 14) });
    for (const a of ow.animals) drawables.push({ y: a.y, fn: () => (a.kind === 'chicken' ? Sprites.chicken : Sprites.cow)(ctx, a.x - cam.x, a.y - cam.y, a) });
    for (const g of ow.ground) drawables.push({ y: g.y, fn: () => this._drawGround(g) });
    drawables.push({ y: this.player.y + this.player.h, fn: () => this._drawPlayer() });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
  }

  _renderMine() {
    const ctx = this.ctx, m = this.mine, cam = this.camera;
    const sx0 = Math.max(0, (cam.x / TILE) | 0), sy0 = Math.max(0, (cam.y / TILE) | 0);
    const sx1 = Math.min(m.w, ((cam.x + this.canvas.width) / TILE | 0) + 1);
    const sy1 = Math.min(m.h, ((cam.y + this.canvas.height) / TILE | 0) + 1);
    for (let gy = sy0; gy < sy1; gy++) for (let gx = sx0; gx < sx1; gx++) {
      const t = m.tilemap.get(gx, gy), x = gx * TILE - cam.x, y = gy * TILE - cam.y, v = gx + gy;
      if (t === MT.WALL) Sprites.mineWall(ctx, x, y);
      else if (t === MT.ORE_COPPER) Sprites.mineOre(ctx, x, y, 'copper');
      else if (t === MT.ORE_IRON) Sprites.mineOre(ctx, x, y, 'iron');
      else if (t === MT.ORE_GOLD) Sprites.mineOre(ctx, x, y, 'gold');
      else if (t === MT.ORE_DIAMOND) Sprites.mineOre(ctx, x, y, 'diamond');
      else if (t === MT.STAIRS || t === MT.STAIRS_SEALED) { Sprites.mineFloor(ctx, x, y, v); Sprites.stairsDown(ctx, x, y, t === MT.STAIRS_SEALED); }
      else if (t === MT.ENTRANCE) Sprites.mineEntranceTile(ctx, x, y);
      else Sprites.mineFloor(ctx, x, y, v);
    }
    for (const o of m.placed) {
      const x = o.gx * TILE - cam.x, y = o.gy * TILE - cam.y;
      if (o.type === 'chest') Sprites.chest(ctx, x, y);
      else if (o.type === 'torch') Sprites.torch(ctx, x, y, this.globalT);
    }
    const drawables = [];
    for (const g of m.ground) drawables.push({ y: g.y, fn: () => this._drawGround(g) });
    for (const e of m.enemies) drawables.push({ y: e.y, fn: () => Sprites.enemy(ctx, e.x - cam.x, e.y - cam.y, e) });
    if (m.boss) drawables.push({ y: m.boss.y, fn: () => Sprites.boss(ctx, m.boss.x - cam.x, m.boss.y - cam.y, m.boss, this.globalT) });
    drawables.push({ y: this.player.y + this.player.h, fn: () => this._drawPlayer() });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();

    for (const sw of this.effects.shockwaves) {
      ctx.strokeStyle = `rgba(255,120,40,${Math.max(0, sw.life / 0.6)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(sw.x - cam.x, sw.y - cam.y, sw.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const r of this.effects.fallingRocks) {
      const x = r.x - cam.x, y = r.y - cam.y;
      if (!r.done) { const t = r.t / r.warn; ctx.strokeStyle = `rgba(255,50,50,${0.4 + 0.4 * Math.sin(t * 20)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke(); }
      else Sprites.rock(ctx, x - 16, y - 16);
    }
  }

  _drawPlayer() {
    const ctx = this.ctx, p = this.player;
    const sx = p.x - this.camera.x, sy = p.y - this.camera.y;
    this._sunShadow(sx + p.w / 2, sy + p.h + 2, 10, 6);
    Sprites.player(ctx, sx, sy, p);
    if (p.attackTimer > 0) Sprites.swordSwing(ctx, sx, sy, p);
  }

  _drawGround(g) {
    const ctx = this.ctx, sx = g.x - this.camera.x, sy = g.y - this.camera.y;
    const bob = Math.sin(this.globalT * 4 + (g.id || 0)) * 2;
    if (g.kind === 'gold') Sprites.groundGold(ctx, sx, sy, bob);
    else Sprites.itemIcon(ctx, g.item, sx - 9, sy - 9 + bob, 18);
  }

  _renderPlacementPreview() {
    const sel = this.inventory.selectedItem;
    if (!sel || ITEMS[sel.id].type !== 'placeable') return;
    const { gx, gy } = this.placementCell();
    const valid = this.placementValid(gx, gy);
    const x = gx * TILE - this.camera.x, y = gy * TILE - this.camera.y, ctx = this.ctx;
    ctx.fillStyle = valid ? 'rgba(80,220,80,0.4)' : 'rgba(220,60,60,0.4)';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = valid ? '#5f5' : '#f55'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
  }

  _renderFloatTexts() {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const f of this.effects.floatTexts) {
      ctx.font = (f.big ? 'bold 18px' : 'bold 14px') + " 'VT323', monospace";
      const sx = f.x - this.camera.x, sy = f.y - this.camera.y;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.9));
      ctx.fillStyle = '#000'; ctx.fillText(f.text, sx + 1, sy + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  _renderWeather() {
    if (!this._weatherKind || this.scene !== 'overworld') return;
    const ctx = this.ctx;
    if (this._weatherKind === 'rain') {
      ctx.strokeStyle = 'rgba(150,180,230,0.5)'; ctx.lineWidth = 1.5;
      for (const p of this.effects.weatherParticles) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 3, p.y + 12); ctx.stroke(); }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const p of this.effects.weatherParticles) { ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  _renderNight() {
    let info;
    if (this.scene === 'mine') info = { alpha: 0.6, color: '10,10,18' };
    else info = this.time.ambient();
    if (info.alpha <= 0.01) return;
    const nc = this.nightCtx, W = this.nightCanvas.width, H = this.nightCanvas.height;
    nc.clearRect(0, 0, W, H);
    nc.globalCompositeOperation = 'source-over';
    nc.fillStyle = `rgba(${info.color},${info.alpha})`;
    nc.fillRect(0, 0, W, H);

    nc.globalCompositeOperation = 'destination-out';
    const p = this.player;
    const psx = p.cx - this.camera.x, psy = p.cy - this.camera.y;
    let grad = nc.createRadialGradient(psx, psy, 10, psx, psy, 200);
    grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    nc.fillStyle = grad; nc.beginPath(); nc.arc(psx, psy, 200, 0, Math.PI * 2); nc.fill();

    for (const o of this.curScene().placed) {
      if (o.type !== 'torch') continue;
      const tx = o.gx * TILE + TILE / 2 - this.camera.x, ty = o.gy * TILE + TILE / 2 - this.camera.y;
      const g2 = nc.createRadialGradient(tx, ty, 4, tx, ty, 120);
      g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
      nc.fillStyle = g2; nc.beginPath(); nc.arc(tx, ty, 120, 0, Math.PI * 2); nc.fill();
    }
    nc.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.nightCanvas, 0, 0);
    // (les halos chauds sont désormais gérés par le bloom émissif de PostFX)
  }

  // ---------------- Écran-titre animé ----------------
  startTitle() {
    // étoiles fixes scintillantes
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
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, t = this._titleT;
    // ciel crépusculaire
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#140a2e'); sky.addColorStop(0.4, '#3b2560'); sky.addColorStop(0.62, '#8a4a5a'); sky.addColorStop(0.72, '#e8894a');
    sky.addColorStop(0.74, '#3a6b3a'); sky.addColorStop(1, '#1f3a24');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const horizon = H * 0.72;

    // étoiles
    for (const s of this._titleStars) {
      const a = 0.4 + Math.sin(t * s.sp + s.ph) * 0.4;
      ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = '#fff';
      ctx.fillRect(s.x * W, s.y * horizon, 2, 2);
    }
    ctx.globalAlpha = 1;

    // grosse lune avec halo
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

    // nuages
    for (const c of this._titleClouds) {
      c.x += c.s * dt * 6; if (c.x > 1.2) c.x = -0.2;
      const cx = c.x * W, cy = c.y * horizon;
      ctx.fillStyle = 'rgba(60,40,80,0.5)';
      ctx.beginPath(); ctx.ellipse(cx, cy, c.w, c.w * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + c.w * 0.6, cy + 6, c.w * 0.7, c.w * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    }

    // collines en couches (parallaxe douce)
    const hill = (baseY, amp, colr, phase) => {
      ctx.fillStyle = colr; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 12) ctx.lineTo(x, baseY + Math.sin(x * 0.006 + phase) * amp);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    };
    hill(horizon + 20, 18, '#2f5230', 0.5 + t * 0.05);
    hill(horizon + 70, 26, '#25401f', 1.7 - t * 0.04);
    hill(horizon + 130, 34, '#1a2e16', 3.0 + t * 0.03);

    // arbres silhouettes sur la première colline
    const treeSil = (x, y, s) => {
      ctx.fillStyle = '#132611';
      ctx.fillRect(x - 2 * s, y, 4 * s, 14 * s);
      ctx.beginPath(); ctx.arc(x, y - 2 * s, 12 * s, 0, Math.PI * 2);
      ctx.arc(x - 9 * s, y + 3 * s, 8 * s, 0, Math.PI * 2);
      ctx.arc(x + 9 * s, y + 3 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
    };
    treeSil(W * 0.12, horizon + 40, 1.1); treeSil(W * 0.30, horizon + 55, 0.9);
    treeSil(W * 0.62, horizon + 48, 1.0); treeSil(W * 0.88, horizon + 60, 1.2);

    // lucioles au premier plan
    for (const f of this._titleFire) {
      f.ph += dt * rand(1, 2.4); f.x += Math.sin(f.ph) * 0.0006;
      const a = 0.4 + Math.sin(f.ph) * 0.4;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const fx = f.x * W, fy = f.y * H;
      const g = ctx.createRadialGradient(fx, fy, 1, fx, fy, 14);
      g.addColorStop(0, `rgba(200,255,140,${a})`); g.addColorStop(1, 'rgba(200,255,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // vignette
    this.postfx.vignette(ctx, 0.4);
  }

  // ---------------- Boucle ----------------
  loop(ts) {
    if (!this.running) return;
    if (!this.lastTime) this.lastTime = ts;
    let dt = (ts - this.lastTime) / 1000;
    dt = Math.min(dt, 0.05);
    this.lastTime = ts;
    this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  start() {
    this.stopTitle();
    this.init();
    this.running = true;
    this.lastTime = 0;
    this.music.setScene('farm');
    this.music.start();
    requestAnimationFrame((t) => this.loop(t));
  }
}
