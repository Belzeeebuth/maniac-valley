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
import { Sprites } from '../graphics/SpriteSheetGenerator.js';
import { Player } from '../entities/Player.js';
import { makeAnimal, updateAnimal, animalProduce } from '../entities/Animal.js';
import { empowerEnemy } from '../entities/Enemy.js';
import { CROPS, growPlot, isReady } from '../entities/Crop.js';
import { Inventory, ITEMS } from '../systems/Inventory.js';
import { FarmingSystem } from '../systems/FarmingSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { HUD } from '../ui/HUD.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { CraftingUI } from '../ui/CraftingUI.js';
import { QuestUI } from '../ui/QuestUI.js';
import { ShopUI } from '../ui/ShopUI.js';
import { Tooltip } from '../ui/Tooltip.js';

const OW_W = 56, OW_H = 42;
const rand = (a, b) => Math.random() * (b - a) + a;
const ri = (a, b) => Math.floor(rand(a, b + 1));
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.nightCanvas = document.createElement('canvas');
    this.nightCtx = this.nightCanvas.getContext('2d');

    this.sound = SoundFX;
    this.time = new DayNightCycle();
    this.camera = new Camera();
    this.inventory = new Inventory();

    this.scene = 'overworld';
    this.overworld = null;
    this.mine = null;
    this.player = null;

    this.effects = { floatTexts: [], shockwaves: [], fallingRocks: [], weatherParticles: [] };

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
    this._initWeatherParticles();
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
    if (this.mine.isBoss) setTimeout(() => { if (this.mine && this.mine.boss) { this.toast('⚠ Un boss garde ce niveau !'); this.sound.play('boss_roar'); } }, 400);
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
    }

    this.camera.follow(this.player, this.curScene().w, this.curScene().h, this.canvas.width, this.canvas.height, dt);
    this._updateFloatTexts(dt);
    this._updateWeather(dt);
    this.hud.update();
    this._updateInteractPrompt();
  }

  _updateGroundPickup() {
    const s = this.curScene(), p = this.player;
    for (const g of s.ground) {
      if (dist(p.cx, p.cy, g.x, g.y) < TILE * 0.85) {
        if (g.kind === 'gold') { p.gold += g.amount; this.sound.play('coin'); this.floatText(g.x, g.y, '+' + g.amount + ' or', '#ffd700'); }
        else { this.inventory.add(g.item, 1); this.loot(g.item, 1); this.sound.play('pickup'); this.hud.renderHotbar(); }
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

  // ---------------- Rendu ----------------
  render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.scene === 'overworld') this._renderOverworld();
    else this._renderMine();
    this._renderPlacementPreview();
    this._renderFloatTexts();
    this._renderWeather();
    this._renderNight();
    this._renderVignette();
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

    const drawables = [];
    for (let gy = sy0; gy < sy1; gy++) for (let gx = sx0; gx < sx1; gx++)
      if (ow.tilemap.get(gx, gy) === OT.TREE)
        drawables.push({ y: gy * TILE + TILE, fn: () => Sprites.tree(ctx, gx * TILE - cam.x, gy * TILE - cam.y, this.globalT, season) });
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
    if (!this._weatherKind) return;
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

    // Halo chaud additif autour du joueur et des torches (ambiance nocturne)
    if (info.alpha > 0.4) {
      const ctx = this.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const warm = (x, y, r, a) => {
        const g = ctx.createRadialGradient(x, y, 2, x, y, r);
        g.addColorStop(0, `rgba(255,180,90,${a})`); g.addColorStop(1, 'rgba(255,180,90,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      };
      warm(psx, psy, 150, 0.10);
      for (const o of this.curScene().placed) {
        if (o.type !== 'torch') continue;
        warm(o.gx * TILE + TILE / 2 - this.camera.x, o.gy * TILE + TILE / 2 - this.camera.y, 110, 0.18);
      }
      ctx.restore();
    }
  }

  _renderVignette() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
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
    this.init();
    this.running = true;
    requestAnimationFrame((t) => this.loop(t));
  }
}
