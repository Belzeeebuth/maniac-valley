// ============================================================================
// DayNightCycle — horloge 06:00 → 02:00, saisons (28 jours) et météo.
// Fournit la teinte d'ambiance appliquée sur le canvas.
// ============================================================================

export const SEASONS = ['Printemps', 'Été', 'Automne', 'Hiver'];
export const SEASON_KEY = ['spring', 'summer', 'autumn', 'winter'];
export const WEATHERS = {
  sun:     { name: 'Soleil',  icon: '☀' },
  rain:    { name: 'Pluie',   icon: '🌧' },
  eclipse: { name: 'Éclipse', icon: '🌑' },
  snow:    { name: 'Neige',   icon: '❄' },
};

export class DayNightCycle {
  constructor() {
    this.day = 1;
    this.hour = 6;            // heure courante (06.0 → 26.0)
    this.dayLengthSec = 480;  // 8 min réelles pour la journée jouable
    this.weather = 'sun';
  }

  get seasonIndex() { return Math.floor((this.day - 1) / 28) % 4; }
  get seasonName() { return SEASONS[this.seasonIndex]; }
  get seasonKey() { return SEASON_KEY[this.seasonIndex]; }
  get isRaining() { return this.weather === 'rain'; }
  get isEclipse() { return this.weather === 'eclipse'; }

  rollWeather() {
    const s = this.seasonKey;
    const r = Math.random();
    if (r < 0.05) this.weather = 'eclipse';               // nuit maniaque : ennemis renforcés
    else if (s === 'winter') this.weather = r < 0.5 ? 'snow' : 'sun';
    else if (s === 'autumn') this.weather = r < 0.4 ? 'rain' : 'sun';
    else this.weather = r < 0.28 ? 'rain' : 'sun';
  }

  weatherLabel() { return WEATHERS[this.weather]; }

  advance(dt) {
    // 20 heures de jeu (06→26) réparties sur dayLengthSec
    this.hour += dt * (20 / this.dayLengthSec);
  }

  clockString() {
    const h = this.hour % 24;
    const hh = Math.floor(h);
    const mm = Math.floor((h % 1) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  // Filtre d'ambiance {alpha, color:"r,g,b"} pour l'overworld.
  ambient() {
    const h = this.hour;
    if (this.isEclipse) return { alpha: 0.72, color: '40,8,20' };
    let base;
    if (h >= 8 && h < 18) base = { alpha: 0, color: '20,20,30' };
    else if (h >= 6 && h < 8) { const t = (h - 6) / 2; base = { alpha: (1 - t) * 0.30, color: '60,40,70' }; }
    else if (h >= 18 && h < 20) { const t = (h - 18) / 2; base = { alpha: t * 0.45, color: '90,55,20' }; }
    else if (h >= 20 && h < 24) { const t = (h - 20) / 4; base = { alpha: 0.45 + t * 0.28, color: '10,15,45' }; }
    else base = { alpha: 0.73, color: '8,10,35' };
    if (this.isRaining || this.weather === 'snow') base = { alpha: Math.max(base.alpha, 0.22), color: this.weather === 'snow' ? '150,160,180' : '40,50,70' };
    return base;
  }
}
