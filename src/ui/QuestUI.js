// ============================================================================
// QuestUI — journal des quêtes : progression, récompense et bouton de
// validation (activé une fois l'objectif atteint).
// ============================================================================

export class QuestUI {
  constructor(game) {
    this.game = game;
    this.list = document.getElementById('questList');
  }

  render() {
    const g = this.game, qs = g.quests;
    this.list.innerHTML = '';
    for (const q of qs.quests) {
      const prog = qs.progressOf(q);
      const ready = prog >= q.qty;
      const row = document.createElement('div'); row.className = 'quest-row';

      const title = document.createElement('div'); title.className = 'quest-title'; title.textContent = q.text;
      row.appendChild(title);

      const bg = document.createElement('div'); bg.className = 'quest-bar-bg';
      const fill = document.createElement('div'); fill.className = 'quest-bar-fill';
      fill.style.width = Math.min(100, prog / q.qty * 100) + '%';
      bg.appendChild(fill); row.appendChild(bg);

      const reward = document.createElement('div'); reward.className = 'quest-reward';
      reward.textContent = `${prog} / ${q.qty} — Récompense : ${q.gold} or`;
      row.appendChild(reward);

      const btn = document.createElement('button');
      btn.className = 'craft-btn quest-turnin'; btn.textContent = 'Valider';
      btn.disabled = !ready;
      btn.addEventListener('click', () => {
        if (qs.turnIn(q)) { this.render(); g.hud.renderHotbar(); }
      });
      row.appendChild(btn);
      this.list.appendChild(row);
    }
    if (!qs.quests.length) {
      this.list.innerHTML = '<div class="quest-reward" style="text-align:center">Aucune quête pour le moment.</div>';
    }
  }
}
