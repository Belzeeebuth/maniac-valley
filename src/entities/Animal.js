// ============================================================================
// Animal — poules & vaches : IA d'errance simple bornée à l'enclos, nourrissage
// et production quotidienne (œuf / lait).
// ============================================================================

let uid = 200000;
const nid = () => uid++;
const rand = (a, b) => Math.random() * (b - a) + a;

export function makeAnimal(kind, x, y) {
  return {
    id: nid(), kind, x, y, vx: 0, vy: 0,
    wanderT: rand(0, 2), fed: false, animT: rand(0, 10),
  };
}

export function updateAnimal(a, dt, bounds) {
  a.animT += dt;
  a.wanderT -= dt;
  if (a.wanderT <= 0) {
    a.wanderT = rand(1.2, 3);
    const ang = rand(0, Math.PI * 2);
    const sp = a.kind === 'cow' ? 18 : 26;
    a.vx = Math.cos(ang) * sp; a.vy = Math.sin(ang) * sp;
    if (Math.random() < 0.3) { a.vx = 0; a.vy = 0; }
  }
  a.x = Math.min(Math.max(a.x + a.vx * dt, bounds.x1 + 8), bounds.x2 - 8);
  a.y = Math.min(Math.max(a.y + a.vy * dt, bounds.y1 + 8), bounds.y2 - 8);
}

export function animalProduce(a) {
  return a.kind === 'chicken' ? 'egg' : 'milk';
}
