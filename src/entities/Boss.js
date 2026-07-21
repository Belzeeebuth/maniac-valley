// ============================================================================
// Boss — deux boss avec patterns dédiés (mise à jour dans CombatSystem) :
//  • Giga Slime Maniac (étage 5) : se divise à 75/50/25% de vie, crée des
//    ondes de choc à l'atterrissage.
//  • Roi des Taupes Mutant (étage 10) : s'enfouit, émerge près du joueur,
//    fait tomber des rochers puis charge frénétiquement.
// ============================================================================

let uid = 400000;
const nid = () => uid++;

export function makeGigaSlime(x, y) {
  return {
    id: nid(), kind: 'boss_gigaslime', name: 'GIGA SLIME MANIAC',
    x, y, w: 56, h: 56, hp: 400, maxHp: 400, dmg: 16, speed: 50,
    jumpT: 0, squish: 0, phase: 'ground', facing: 'down',
    splitDone: { 75: false, 50: false, 25: false },
    iframes: 0, contactCd: 0, vx: 0, vy: 0,
  };
}

export function makeMoleKing(x, y) {
  return {
    id: nid(), kind: 'boss_moleking', name: 'ROI DES TAUPES MUTANT',
    x, y, w: 60, h: 52, hp: 600, maxHp: 600, dmg: 22, speed: 70,
    state: 'idle', stateT: 2, phase: 'ground', facing: 'down',
    targetX: x, targetY: y, chargeVX: 0, chargeVY: 0,
    iframes: 0, contactCd: 0,
  };
}
