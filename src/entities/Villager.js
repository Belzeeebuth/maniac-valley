// ============================================================================
// Villager — habitants du village (PNJ). Errance douce autour de leur maison,
// évite les obstacles, et salue le joueur. Variétés : adulte, aîné, enfant ;
// regroupés en foyers (seul, couple, famille).
// ============================================================================

let uid = 500000;
const nid = () => uid++;
const rand = (a, b) => Math.random() * (b - a) + a;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const NAMES = ['Marcel', 'Josette', 'Théo', 'Lilou', 'Bernard', 'Agathe', 'Simon', 'Rosalie', 'Gustave', 'Nina', 'Firmin', 'Capucine'];

// Dialogues par palier d'amitié (0-19 neutre, 20-59 amical, 60+ chaleureux)
export const DIALOGUE = {
  neutral: [
    'Bonjour... on se connaît ?', 'Belle journée, non ?', 'Hm ? Ah, salut.',
    'La boutique est par là, si besoin.', 'Cette vallée est un peu... maniaque.',
  ],
  friendly: [
    'Bonjour, voisin !', 'La récolte s\'annonce bien.', 'Fais attention dans la mine...',
    'On dit qu\'un boss rôde en profondeur.', 'Tu as vu mes poules ?', 'Passe une bonne journée !',
  ],
  warm: [
    'Ah, mon ami ! Quel plaisir !', 'Tu es la fierté de la vallée !', 'Reste dîner un de ces soirs !',
    'Si tu as besoin de quoi que ce soit, ma porte est ouverte.', 'La vallée a de la chance de t\'avoir.',
  ],
  gift: ['Oh, c\'est pour moi ? Merci !', 'Comme c\'est gentil !', 'J\'adore, merci beaucoup !'],
  giftLoved: ['C\'est mon préféré ! Merci mille fois !', 'Incroyable ! Tu me connais si bien !'],
};
export const CHILD_LINES = ['Tu veux jouer ?', 'Coucou !', 'J\'ai vu un slime !', 'Trop cool ton épée !'];

export function makeVillager(kind, x, y, bounds, look, name) {
  return {
    id: nid(), kind, x, y, bounds, name: name || 'Villageois',
    skin: look.skin, hair: look.hair, shirt: look.shirt,
    vx: 0, vy: 0, wanderT: rand(0, 2.5), animT: rand(0, 10),
    facing: 'down', talkT: 0,
  };
}

export function dialogueFor(v, points) {
  if (v.kind === 'child') return CHILD_LINES[Math.random() * CHILD_LINES.length | 0];
  const pool = points >= 60 ? DIALOGUE.warm : points >= 20 ? DIALOGUE.friendly : DIALOGUE.neutral;
  return pool[Math.random() * pool.length | 0];
}
export function heartsFor(points) {
  const n = Math.min(5, Math.floor(points / 20));
  return '♥'.repeat(n) + '♡'.repeat(5 - n);
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
