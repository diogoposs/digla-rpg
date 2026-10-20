import { LIGHTNING_STAFF, LIGHTNING_ABILITIES, lightningDamage } from '../game/lightning-rules.js';
import { abilityIcon } from '../graphics/ability-icons.js';

export function createLightningAbilities({ onCast }) {
  const bar = document.createElement('section');
  bar.id = 'lightning-abilities';
  bar.className = 'lightning-abilities';
  bar.hidden = true;
  bar.setAttribute('aria-label', 'Habilidades do Cajado de raio');
  for (const [key, ability] of Object.entries(LIGHTNING_ABILITIES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.ability = key;
    button.setAttribute('aria-label', `${key.toUpperCase()}: ${ability.name}`);
    button.innerHTML = `${abilityIcon(key)}<kbd>${key.toUpperCase()}</kbd><b></b>`;
    button.onclick = () => void onCast(key);
    bar.append(button);
  }
  document.querySelector('.world-frame').append(bar);
  let equipped = false,
    mana = 0,
    cooldowns = {},
    offset = 0,
    base = 8;
  function render() {
    if (bar.hidden) return;
    for (const button of bar.children) {
      const key = button.dataset.ability,
        ability = LIGHTNING_ABILITIES[key];
      const remaining = Math.max(
        0,
        Math.max(cooldowns[key] || 0, cooldowns.global || 0) - (Date.now() + offset),
      );
      button.disabled = !equipped || mana < ability.mana || remaining > 0;
      button.querySelector('b').textContent =
        remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : mana < ability.mana ? '◇' : '';
      button.title = `${key.toUpperCase()} — ${ability.name}. ${ability.description} Dano base: ${Math.round(base * ability.multiplier)}${key === 'w' ? ' por pulso' : ''}. Mana: ${ability.mana}. Recarga: ${ability.cooldown / 1000}s.${mana < ability.mana ? ' Sem mana suficiente.' : ''}`;
    }
  }
  setInterval(render, 100);
  return {
    sync(data) {
      if (data.equipment) equipped = data.equipment.weapon?.id === LIGHTNING_STAFF;
      if (data.vitals) mana = data.vitals.mana;
      if (data.abilityCooldowns) cooldowns = data.abilityCooldowns;
      if (data.serverNow !== undefined) offset = data.serverNow - Date.now();
      if (data.skills?.magic) base = lightningDamage(data.skills.magic.level);
      bar.hidden = !equipped;
      render();
    },
    hide() {
      bar.hidden = true;
    },
  };
}
