// ============================================================================
// Enemy — slimes (bondissent), squelettes (poursuite rapide), chauves-souris
// (vol sinusoïdal ignorant les obstacles). IA mise à jour par CombatSystem.
// ============================================================================

let uid = 300000;
const nid = () => uid++;
const rand = (a, b) => Math.random() * (b - a) + a;

export function makeEnemy(kind, x, y, level) {
  const base = {
    id: nid(), kind, x, y, w: 22, h: 22, vx: 0, vy: 0,
    iframes: 0, contactCd: 0, facing: 'down', level,
  };
  if (kind === 'slime') {
    return Object.assign(base, {
      hp: 20 + level * 2, maxHp: 20 + level * 2, dmg: 8 + Math.floor(level * 0.6),
      speed: 60, jumpT: rand(0, 1.2), squish: 0,
    });
  }
  if (kind === 'skeleton') {
    return Object.assign(base, {
      hp: 30 + level * 3, maxHp: 30 + level * 3, dmg: 12 + Math.floor(level * 0.8), speed: 95,
    });
  }
  // bat
  return Object.assign(base, {
    hp: 15 + level * 2, maxHp: 15 + level * 2, dmg: 6 + Math.floor(level * 0.5),
    speed: 110, wavePhase: rand(0, 10),
  });
}

// Rend l'ennemi plus dangereux lors d'une Éclipse (météo maniaque).
export function empowerEnemy(e) {
  e.tint = '#c93ea0';
  e.hp = Math.round(e.hp * 1.4); e.maxHp = e.hp;
  e.dmg = Math.round(e.dmg * 1.4); e.speed *= 1.2;
}
