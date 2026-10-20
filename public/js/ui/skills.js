import { $ } from './dom.js';
import { skillProgress } from '../game/progression.js';

export function createSkills() {
  for (const [id, name] of [
    ['mining', 'Mineração'],
    ['smithing', 'Ferraria'],
  ]) {
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.innerHTML = `<div><strong>${name}</strong><span>Nível <b id="${id}-level">1</b></span></div><span id="${id}-xp">0 / 100 XP</span><div id="${id}-progress" class="skill-progress" role="progressbar" aria-label="XP de ${name}" aria-valuemin="0"><span></span></div>`;
    $('skills-panel').append(row);
  }
  const toggle = (open) => {
    $('skills-panel').hidden = !open;
    $('toggle-skills').setAttribute('aria-expanded', String(open));
  };
  $('toggle-skills').onclick = () => toggle($('skills-panel').hidden);
  $('close-skills').onclick = () => {
    toggle(false);
    $('toggle-skills').focus();
  };
  return {
    reset() {
      toggle(false);
    },
    render(skills = {}) {
      for (const id of [
        'fishing',
        'magic',
        'cooking',
        'combat',
        'vitality',
        'mining',
        'smithing',
      ]) {
        const progress = skills[id] || skillProgress();
        $(id + '-level').textContent = progress.level;
        $(id + '-xp').textContent =
          `${Math.round(progress.xp * 100) / 100} / ${progress.required} XP`;
        const bar = $(id + '-progress');
        bar.setAttribute('aria-valuenow', progress.xp);
        bar.setAttribute('aria-valuemax', progress.required);
        bar.firstElementChild.style.width = `${(progress.xp / progress.required) * 100}%`;
      }
    },
  };
}
