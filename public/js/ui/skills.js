import { $ } from './dom.js';
import { skillProgress } from '../game/progression.js';

export function createSkills() {
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
      for (const id of ['fishing', 'magic', 'cooking', 'combat', 'vitality']) {
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
