// ============================================================================
// Game — orchestrateur : état global, boucle 60 FPS, actions du joueur,
// effets/ambiance, cycle jour/nuit et liaison des systèmes & UI.
// Le monde vit dans SceneManager, le rendu dans RenderManager et la
// persistance dans SaveManager.
// ============================================================================

import { TILE, OT, MT } from '../world/TileMap.js';
import { DayNightCycle } from '../world/DayNightCycle.js';
import { Camera } from './Camera.js';
import { InputHandler } from './InputHandler.js';
import { SoundFX } from './SoundFX.js';
import { MusicFX } from './MusicFX.js';
import { SceneManager } from './SceneManager.js';
import { RenderManager } from './RenderManager.js';
import { SaveManager } from './SaveManager.js';
import { Sprites } from '../graphics/SpriteSheetGenerator.js';
import { Player } from '../entities/Player.js';
import { updateAnimal, animalProduce } from '../entities/Animal.js';
import { updateVillager, dialogueFor, heartsFor, DIALOGUE } from '../entities/Villager.js';
import { growPlot, isReady } from '../entities/Crop.js';
import { Inventory, ITEMS } from '../systems/Inventory.js';
import { FarmingSystem } from '../systems/FarmingSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { FishingSystem } from '../systems/FishingSystem.js';
import { Particles } from '../systems/Particles.js';
import { HUD } from '../ui/HUD.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { CraftingUI } from '../ui/CraftingUI.js';
import { QuestUI } from '../ui/QuestUI.js';
import { ShopUI } from '../ui/ShopUI.js';
import { Tooltip } from '../ui/Tooltip.js';

const rand = (a, b) => Math.random() * (b - a) + a;
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.sound = SoundFX;
    this.music = new MusicFX();
    this.time = new DayNightCycle();
    this.camera = new Camera();
    this.inventory = new Inventory();

    this.scene = 'overworld';
    this.overworld = null;
    this.mine = null;
    this.player = null;
    this.friendship = {}; // nom → { points, lastTalkDay, giftDay }

    this.effects = { floatTexts: [], shockwaves: [], fallingRocks: [], weatherParticles: [], ambient: [], fireflies: [], clouds: [], butterflies: [] };
    this.particles = new Particles();
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
    this.fishing = new FishingSystem(this);

    // Gestionnaires
    this.sceneMgr = new SceneManager(this);
    this.renderer = new RenderManager(this);
    this.saves = new SaveManager(this);

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
    this.ctx.imageSmoothingEnabled = false;
    if (this.renderer) this.renderer.resize();
    this._initWeatherParticles();
    this._initAmbient();
  }

  // ---------------- Entrées ----------------
  _bindInput() {
    this.input = new InputHandler(this.canvas);
    this.input.onPrimary(() => {
      if (this.anyModalOpen() || this.faint) return;
      if (this.fishing.onClick()) return;
      this.doAction();
    });
    this.input.onDodge(() => {
      if (this.anyModalOpen() || this.faint) return;
      if (this.player.startDodge()) this.sound.play('dodge');
    });
    this.input.onHotbar((i) => {
      if (i === 'prev') i = (this.inventory.selected + 9) % 10;
      else if (i === 'next') i = (this.inventory.selected + 1) % 10;
      this.selectHotbar(i);
    });
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

  // ---------------- Cycle de vie ----------------
  init() {
    this.overworld = this.sceneMgr.buildOverworld();
    this.scene = 'overworld';
    this.player = new Player(this.bedPos.x, this.bedPos.y + 50);
    this.friendship = {};
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

  start(loadSave = false) {
    this.renderer.stopTitle();
    this.init();
    if (loadSave) this.saves.load();
    else this.saves.clear();
    this.running = true;
    this.lastTime = 0;
    this.music.setScene('farm');
    this.music.start();
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(ts) {
    if (!this.running) return;
    if (!this.lastTime) this.lastTime = ts;
    let dt = (ts - this.lastTime) / 1000;
    dt = Math.min(dt, 0.05);
    this.lastTime = ts;
    this.update(dt);
    this.renderer.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------------- Délégations scène / rendu / titre ----------------
  curScene() { return this.sceneMgr.curScene(); }
  blocked(px, py, w, h) { return this.sceneMgr.blocked(px, py, w, h); }
  enterMine(level) { this.sceneMgr.enterMine(level); }
  exitMine() { this.sceneMgr.exitMine(); }
  render() { this.renderer.render(); }
  startTitle() { this.renderer.startTitle(); }
  stopTitle() { this.renderer.stopTitle(); }
  get titleActive() { return this.renderer.titleActive; }

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

  // ---------------- Visée ----------------
  // Souris : tuile sous le curseur (portée 2). Tactile/manette : tuile devant.
  aimTile() {
    const p = this.player;
    const pgx = Math.floor(p.cx / TILE), pgy = Math.floor(p.cy / TILE);
    let gx, gy;
    if (this.input.aimSource === 'mouse') {
      const wx = this.input.mouse.x + this.camera.x;
      const wy = this.input.mouse.y + this.camera.y;
      gx = Math.floor(wx / TILE); gy = Math.floor(wy / TILE);
      const R = 2;
      gx = pgx + Math.max(-R, Math.min(R, gx - pgx));
      gy = pgy + Math.max(-R, Math.min(R, gy - pgy));
    } else {
      const f = p.frontTile();
      gx = f.gx; gy = f.gy;
    }
    return { gx, gy, wx: gx * TILE + TILE / 2, wy: gy * TILE + TILE / 2, pgx, pgy };
  }
  faceTowardMouse() {
    if (this.input.aimSource !== 'mouse') return;
    const p = this.player;
    const dx = (this.input.mouse.x + this.camera.x) - p.cx;
    const dy = (this.input.mouse.y + this.camera.y) - p.cy;
    if (Math.abs(dx) > Math.abs(dy)) p.facing = dx > 0 ? 'right' : 'left';
    else p.facing = dy > 0 ? 'down' : 'up';
  }

  // ---------------- Action contextuelle ----------------
  doAction() {
    this.faceTowardMouse();
    const sel = this.inventory.selectedItem;
    if (sel) {
      const it = ITEMS[sel.id];
      if (it.type === 'placeable') { this.tryPlace(sel); return; }
      if (it.type === 'seed') { this.farming.plantSeed(sel.id); return; }
    }
    if (this.tryContextInteract()) return;
    if (sel) {
      const it = ITEMS[sel.id];
      if (it.tool === 'fish') { this.fishing.cast(); return; }
      if (it.type === 'tool') { this.farming.useTool(it.tool); return; }
      if (it.food) { this.eatItem(sel.id); return; }
    }
  }

  // Amitié : parler (1x/jour) ou offrir l'objet sélectionné.
  interactVillager(vil) {
    const rec = this.friendship[vil.name] || (this.friendship[vil.name] = { points: 0, lastTalkDay: 0, giftDay: 0 });
    const sel = this.inventory.selectedItem;
    const giftable = sel && ITEMS[sel.id] && typeof ITEMS[sel.id].sell === 'number' && ITEMS[sel.id].type !== 'tool';

    if (giftable && rec.giftDay !== this.time.day) {
      const it = ITEMS[sel.id];
      const loved = ['crop', 'food', 'fish', 'product'].includes(it.type);
      const pts = loved ? 15 : 8;
      this.inventory.remove(sel.id, 1);
      rec.points = Math.min(100, rec.points + pts);
      rec.giftDay = this.time.day;
      const line = loved ? choice(DIALOGUE.giftLoved) : choice(DIALOGUE.gift);
      this.toast(`🎁 ${vil.name} ${heartsFor(rec.points)} : « ${line} »`);
      this.sound.play('questdone');
      this.particles.sparkle(vil.x, vil.y - 14, '#ff9ad0', 8);
      this.hud.renderHotbar();
    } else {
      if (rec.lastTalkDay !== this.time.day) {
        rec.points = Math.min(100, rec.points + 2);
        rec.lastTalkDay = this.time.day;
      }
      const line = dialogueFor(vil, rec.points);
      this.toast(`🗨 ${vil.name} ${heartsFor(rec.points)} : « ${line} »`);
      this.sound.play('ui');
    }
    vil.talkT = 2.5;
    const dx = this.player.cx - vil.x, dy = this.player.cy - vil.y;
    vil.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
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
      for (const vil of this.overworld.villagers) {
        if (dist(cx, cy, vil.x, vil.y) < TILE * 1.2) { this.interactVillager(vil); return true; }
      }
      const f = this.aimTile();
      if (isReady(this.overworld.farmland[f.gx + ',' + f.gy])) { this.farming.harvest(f.gx, f.gy); return true; }
      // buissons à baies du bosquet
      const bush = this.overworld.bushes[f.gx + ',' + f.gy];
      if (bush && this.overworld.tilemap.get(f.gx, f.gy) === OT.BUSH) {
        if (bush.ready) {
          const n = 1 + (Math.random() < 0.4 ? 1 : 0);
          this.inventory.add('berry', n); this.loot('berry', n);
          bush.ready = false; bush.regrowDay = this.time.day + 2 + (Math.random() * 2 | 0);
          this.sound.play('pickup');
          this.particles.sparkle(f.wx, f.wy - 8, '#e84a6a', 6);
        } else this.toast('Les baies repoussent...');
        return true;
      }
    } else {
      const m = this.mine;
      const stx = m.stairsPos.x * TILE + TILE / 2, sty = m.stairsPos.y * TILE + TILE / 2;
      if (dist(cx, cy, stx, sty) < TILE * 1.2) {
        if (m.isBoss && !m.stairsUnlocked) { this.toast('Passage scellé — vainquez le boss !'); return true; }
        this.enterMine(m.level + 1); return true;
      }
      const ex = m.entrance.x * TILE + TILE / 2, ey = m.entrance.y * TILE + TILE / 2;
      if (dist(cx, cy, ex, ey) < TILE * 1.2) {
        // remonter d'un étage à la fois ; étage 1 → surface
        if (m.level === 1) this.exitMine();
        else this.enterMine(m.level - 1);
        return true;
      }
    }
    return false;
  }

  interactPromptText() {
    const p = this.player, cx = p.cx, cy = p.cy;
    if (this.fishing.active) return this.fishing.state.phase === 'reel' ? 'Cliquez dans la zone verte !' : 'Patience...';
    if (this.scene === 'overworld') {
      if (dist(cx, cy, this.bedPos.x, this.bedPos.y) < TILE * 1.4) return 'Clic : Dormir';
      if (dist(cx, cy, this.shopPos.x, this.shopPos.y) < TILE * 1.6) return 'Clic : Boutique';
      if (dist(cx, cy, this.boardPos.x, this.boardPos.y) < TILE * 1.4) return 'Clic : Quêtes';
      if (dist(cx, cy, this.minePos.x, this.minePos.y) < TILE * 1.2) return 'Clic : Entrer dans la Mine';
      for (const a of this.overworld.animals) if (dist(cx, cy, a.x, a.y) < TILE * 1.1) return 'Clic : Nourrir (Foin)';
      for (const vil of this.overworld.villagers) if (dist(cx, cy, vil.x, vil.y) < TILE * 1.2) {
        const sel = this.inventory.selectedItem;
        const giftable = sel && ITEMS[sel.id] && typeof ITEMS[sel.id].sell === 'number' && ITEMS[sel.id].type !== 'tool';
        return giftable ? `Clic : Offrir à ${vil.name}` : `Clic : Parler à ${vil.name}`;
      }
      const f = this.aimTile();
      if (isReady(this.overworld.farmland[f.gx + ',' + f.gy])) return 'Clic : Récolter';
      const bush = this.overworld.bushes[f.gx + ',' + f.gy];
      if (bush && this.overworld.tilemap.get(f.gx, f.gy) === OT.BUSH) return bush.ready ? 'Clic : Cueillir des baies' : 'Les baies repoussent...';
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
  placementCell() { const f = this.aimTile(); return { gx: f.gx, gy: f.gy }; }
  placementValid(gx, gy) {
    const s = this.curScene(), t = s.tilemap.get(gx, gy);
    if (t === -1) return false;
    const sel = this.inventory.selectedItem;
    const placeType = sel && ITEMS[sel.id] ? ITEMS[sel.id].placeType : null;
    if (placeType === 'bridge') {
      // les passerelles se posent SUR les gouffres (mine) ou l'eau (surface)
      if (this.scene === 'overworld' ? t !== OT.WATER : t !== MT.PIT) return false;
    } else {
      if (this.scene === 'overworld') { if (t !== OT.GRASS && t !== OT.PATH) return false; }
      else if (t !== MT.FLOOR) return false;
    }
    for (const o of s.placed) if (o.gx === gx && o.gy === gy) return false;
    const pgx = Math.floor(this.player.cx / TILE), pgy = Math.floor(this.player.cy / TILE);
    if (Math.abs(gx - pgx) > 2 || Math.abs(gy - pgy) > 2) return false;
    return true;
  }
  tryPlace(sel) {
    const { gx, gy } = this.placementCell();
    if (!this.placementValid(gx, gy)) { this.toast('Emplacement invalide.'); return; }
    const it = ITEMS[sel.id], s = this.curScene();
    if (it.placeType === 'bridge') {
      s.tilemap.set(gx, gy, this.scene === 'overworld' ? OT.BRIDGE : MT.BRIDGE);
    } else {
      s.placed.push({ gx, gy, type: it.placeType });
      if (it.placeType === 'fence' && this.scene === 'overworld') s.tilemap.set(gx, gy, OT.FENCE);
    }
    this.inventory.remove(sel.id, 1);
    this.sound.play('place');
    this.toast(it.name + ' placé' + (it.placeType === 'bridge' ? 'e' : '') + '.');
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
    for (const key in ow.bushes) { const b = ow.bushes[key]; if (!b.ready && b.regrowDay <= this.time.day) b.ready = true; }
    this.time.rollWeather();
    this._initWeatherParticles();
    this._initAmbient();
    this.saves.save();
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
    this.fishing.cancel();
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
    this.input.pollGamepad();
    if (!this.anyModalOpen() && !this.faint) {
      this.player.update(dt, this.input.moveVector(), (x, y, w, h) => this.blocked(x, y, w, h));
      const s = this.curScene();
      this.player.clampToScene(s.w, s.h);

      const p = this.player;
      p.hunger = Math.max(0, p.hunger - dt * (100 / 520));
      if (p.hunger <= 0) p.hp -= dt * 3;
      else p.stamina = Math.min(p.maxStamina, p.stamina + dt * 1.5);
      if (p.hp <= 0 && !this.faint) this.collapse();

      this.time.advance(dt);
      if (this.time.hour >= 26 && !this.faint) this.collapse();

      if (this.scene === 'overworld') {
        for (const a of this.overworld.animals) updateAnimal(a, dt, this.overworld.penBounds);
        for (const vil of this.overworld.villagers) updateVillager(vil, dt, (x, y, w, h) => this.blocked(x, y, w, h));
      } else {
        this._updateTraps(dt);
      }
      this.combat.updateEnemies(dt);
      this.combat.updateEffects(dt);
      this.fishing.update(dt);
      this._updateGroundPickup();
      this._updateJuice(dt);
    }
    this.particles.update(dt);
    this.saves.update(dt);

    // L'inventaire a changé → rafraîchir la hotbar (et le sac s'il est ouvert)
    if (this.inventory.dirty) {
      this.inventory.dirty = false;
      this.hud.renderHotbar();
      if (this.modals.inventory) this.inventoryUI.render();
    }

    this.camera.follow(this.player, this.curScene().w, this.curScene().h, this.canvas.width, this.canvas.height, dt);
    this._updateFloatTexts(dt);
    this._updateWeather(dt);
    this._updateAmbient(dt);
    this.music.setScene(this.scene === 'mine' ? (this.mine.boss ? 'boss' : 'mine') : 'farm');
    this.hud.update();
    this._updateInteractPrompt();
  }

  // Pièges de mine : piques/lave infligent des dégâts, la glace fait glisser.
  _updateTraps(dt) {
    const p = this.player, m = this.mine;
    const pgx = Math.floor(p.cx / TILE), pgy = Math.floor(p.cy / TILE);
    for (const tr of m.traps) {
      if (tr.cd > 0) tr.cd -= dt;
      if (tr.gx !== pgx || tr.gy !== pgy) continue;
      if (tr.type === 'spikes' && tr.cd <= 0 && p.iframes <= 0) {
        tr.cd = 1.0;
        this.combat.damagePlayer(8, tr.gx * TILE + TILE / 2, tr.gy * TILE + TILE);
        this.toast('⚠ Des piques !');
      } else if (tr.type === 'lava' && tr.cd <= 0 && p.iframes <= 0) {
        tr.cd = 0.7;
        this.combat.damagePlayer(12, tr.gx * TILE + TILE / 2, tr.gy * TILE + TILE);
        this.particles.ember(p.cx, p.y + p.h);
      } else if (tr.type === 'ice' && !p.dodging) {
        // glissade : petite poussée dans la direction du regard
        const o = p.facingOffset();
        const nx = p.x + o.x * 90 * dt, ny = p.y + o.y * 90 * dt;
        if (!this.blocked(nx, p.y, p.w, p.h)) p.x = nx;
        if (!this.blocked(p.x, ny, p.w, p.h)) p.y = ny;
      }
    }
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

  // ---------------- Météo & ambiance ----------------
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
    const ff = [];
    for (let i = 0; i < 20; i++) ff.push({ x: Math.random() * W, y: Math.random() * H, ph: rand(0, 6.28), vx: rand(-10, 10), vy: rand(-10, 10) });
    this.effects.fireflies = ff;
    const bf = [];
    if (season === 'spring' || season === 'summer') {
      for (let i = 0; i < 6; i++) bf.push({
        x: rand(4 * TILE, (this.overworld ? this.overworld.w - 4 : 40) * TILE), y: rand(4 * TILE, (this.overworld ? this.overworld.h - 4 : 30) * TILE),
        ph: rand(0, 6.28), dir: rand(0, 6.28), turnT: rand(1, 3), sp: rand(22, 38),
        col: choice(['#ffd24a', '#ff8fb8', '#7fd0ff', '#f0f0f0']),
      });
    }
    this.effects.butterflies = bf;
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
    const ow = this.overworld;
    if (ow) for (const b of this.effects.butterflies) {
      b.ph += dt * 12; b.turnT -= dt;
      if (b.turnT <= 0) { b.turnT = rand(0.8, 2.2); b.dir += rand(-1.2, 1.2); }
      b.x += Math.cos(b.dir) * b.sp * dt;
      b.y += Math.sin(b.dir) * b.sp * dt + Math.sin(b.ph) * 6 * dt;
      b.x = Math.min(Math.max(b.x, 2 * TILE), (ow.w - 2) * TILE);
      b.y = Math.min(Math.max(b.y, 2 * TILE), (ow.h - 2) * TILE);
    }
    if (ow) for (const c of this.effects.clouds) {
      c.x += c.vx * dt;
      if (c.x - c.rx > ow.w * TILE) { c.x = -c.rx; c.y = rand(0, ow.h * TILE); }
    }
  }

  _firefliesActive() {
    return this.scene === 'overworld' && this.time.ambient().alpha > 0.45 && !this.time.isRaining;
  }

  // ---------------- Juice (pas, embers, fumée, éclairs) ----------------
  _updateJuice(dt) {
    const p = this.player;
    const moved = Math.hypot(p.x - this._prevPos.x, p.y - this._prevPos.y);
    this._prevPos.x = p.x; this._prevPos.y = p.y;
    if (p.moving && !p.dodging) {
      this._stepAccum += moved;
      if (this._stepAccum > 22) { this._stepAccum = 0; this.particles.dust(p.cx, p.y + p.h, 3); }
    }
    if (p.dodging && Math.random() < 0.5) this.particles.dust(p.cx, p.y + p.h, 2);

    this._emberT -= dt;
    if (this._emberT <= 0) {
      this._emberT = 0.12;
      for (const o of this.curScene().placed) {
        if (o.type === 'torch') this.particles.ember(o.gx * TILE + TILE / 2, o.gy * TILE + 6);
        else if (o.type === 'furnace' && Math.random() < 0.6) this.particles.smoke(o.gx * TILE + TILE / 2 + 6, o.gy * TILE);
      }
      if (this.scene === 'mine') for (const tr of this.mine.traps) if (tr.type === 'lava' && Math.random() < 0.4) this.particles.ember(tr.gx * TILE + rand(8, 24), tr.gy * TILE + rand(8, 24));
    }
    if (this.scene === 'overworld') {
      this._smokeT -= dt;
      if (this._smokeT <= 0) {
        this._smokeT = 0.5;
        for (const b of this.overworld.buildings) this.particles.smoke((b.x + b.w - 1.5) * TILE, b.y * TILE - 2);
      }
    }

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
}
