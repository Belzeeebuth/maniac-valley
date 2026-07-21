// ============================================================================
// Crop — définitions des cultures et logique de croissance d'une parcelle.
// ============================================================================

export const CROPS = {
  wheat:      { name: 'Blé',        days: 4, sell: 12, color: '#e8d060', seasons: ['spring', 'summer', 'autumn'], food: { hunger: 12, hp: 2, stam: 6 } },
  strawberry: { name: 'Fraise',     days: 5, sell: 20, color: '#c0392b', seasons: ['spring'],                     food: { hunger: 16, hp: 4, stam: 8 } },
  pumpkin:    { name: 'Citrouille', days: 7, sell: 35, color: '#d9822b', seasons: ['autumn'],                     food: { hunger: 26, hp: 8, stam: 14 } },
  tomato:     { name: 'Tomate',     days: 5, sell: 18, color: '#d43c2c', seasons: ['summer'],                     food: { hunger: 14, hp: 3, stam: 7 } },
  carrot:     { name: 'Carotte',    days: 3, sell: 10, color: '#e8760f', seasons: ['spring', 'autumn'],           food: { hunger: 10, hp: 2, stam: 5 } },
  corn:       { name: 'Maïs',       days: 6, sell: 28, color: '#f2d94e', seasons: ['summer', 'autumn'],           food: { hunger: 20, hp: 5, stam: 10 } },
  blueberry:  { name: 'Myrtille',   days: 5, sell: 24, color: '#4a5fc4', seasons: ['summer'],                     food: { hunger: 14, hp: 6, stam: 8 } },
};

// Nombre de stades visuels (0..3), le dernier = récolte prête.
export const CROP_STAGES = 4;

// Fait avancer une parcelle d'un jour. Retourne true si elle a poussé.
export function growPlot(plot, wateredByRain) {
  if (!plot.cropId) return false;
  if (plot.watered || wateredByRain) {
    plot.stage = Math.min(CROP_STAGES - 1, plot.stage + 1);
    plot.watered = false;
    return true;
  }
  plot.watered = false;
  return false;
}

export function isReady(plot) {
  return plot && plot.cropId && plot.stage >= CROP_STAGES - 1;
}
