export const LIGHTNING_STAFF = 'lightning_staff';
export const LIGHTNING_AUTO_INTERVAL_MS = 3000;
export const ABILITY_GLOBAL_COOLDOWN_MS = 500;
export const LIGHTNING_ABILITIES = {
  q: {
    name: 'Raio',
    mana: 5,
    cooldown: 2000,
    multiplier: 2,
    description: 'Raio em um alvo, alcance 3.',
  },
  w: {
    name: 'Veneno elétrico',
    mana: 10,
    cooldown: 6000,
    multiplier: 0.5,
    description: '5 pulsos, um por segundo, alcance 3.',
  },
  e: {
    name: 'Tempestade',
    mana: 10,
    cooldown: 4000,
    multiplier: 1.5,
    size: 3,
    description: 'Área 3×3 centrada no alvo, alcance 3.',
  },
  r: {
    name: 'Onda de choque',
    mana: 40,
    cooldown: 15000,
    multiplier: 5,
    size: 5,
    description: 'Área 5×5 ao seu redor e cura de 25% da vida máxima.',
  },
};
export const lightningDamage = (level = 1) => 3 + 5 * Math.max(1, level);
