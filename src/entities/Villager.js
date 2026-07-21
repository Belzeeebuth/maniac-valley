// ============================================================================
// Villager — habitants du village (PNJ). Errance douce autour de leur maison,
// évite les obstacles, et salue le joueur. Variétés : adulte, aîné, enfant ;
// regroupés en foyers (seul, couple, famille).
// ============================================================================

let uid = 500000;
const nid = () => uid++;
const rand = (a, b) => Math.random() * (b - a) + a;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const GREETINGS = [
  'Bonjour, voisin !', 'Belle journée, non ?', 'La récolte s\'annonce bien.',
  'Fais attention dans la mine...', 'Tu as vu mes poules ?', 'Ah, la vie à la campagne !',
  'On dit qu\'un boss rôde en profondeur.', 'Passe une bonne journée !',
  'Besoin de graines ? La boutique est par là.', 'Cette vallée est un peu... maniaque.',
];
export const CHILD_LINES = ['Tu veux jouer ?', 'Coucou !', 'J\'ai vu un slime !', 'Trop cool ton épée !'];

export function makeVillager(kind, x, y, bounds, look) {
  return {
    id: nid(), kind, x, y, bounds,
    skin: look.skin, hair: look.hair, shirt: look.shirt,
    vx: 0, vy: 0, wanderT: rand(0, 2.5), animT: rand(0, 10),
    facing: 'down', talkT: 0,
  };
}

export function updateVillager(v, dt, blocked) {
  v.animT += dt;
  if (v.talkT > 0) { v.talkT -= dt; return; } // s'arrête pour parler
  v.wanderT -= dt;
  if (v.wanderT <= 0) {
    v.wanderT = rand(1.6, 4.5);
    const ang = rand(0, Math.PI * 2);
    const sp = v.kind === 'child' ? 26 : v.kind === 'elder' ? 12 : 18;
    v.vx = Math.cos(ang) * sp; v.vy = Math.sin(ang) * sp;
    if (Math.random() < 0.4) { v.vx = 0; v.vy = 0; }
  }
  const b = v.bounds;
  let nx = clamp(v.x + v.vx * dt, b.x1 + 8, b.x2 - 8);
  let ny = clamp(v.y + v.vy * dt, b.y1 + 8, b.y2 - 8);
  if (blocked(nx - 8, v.y - 10, 16, 18)) { nx = v.x; v.wanderT = 0; }
  if (blocked(v.x - 8, ny - 10, 16, 18)) { ny = v.y; v.wanderT = 0; }
  v.x = nx; v.y = ny;
  if (v.vx || v.vy) v.facing = Math.abs(v.vx) > Math.abs(v.vy) ? (v.vx > 0 ? 'right' : 'left') : (v.vy > 0 ? 'down' : 'up');
}
