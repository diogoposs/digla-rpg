import { tileAt, walkable } from '../world/map.js';
import { floorOf } from '../world/elevation.js';

// Balanceamento da pesca, compartilhado entre navegador, servidor e testes.
export const FISHING_INTERVAL_MS = 600;
export const CHALLENGE_DURATION_MS = 1200;
export const GREEN_START = 0.4;
export const GREEN_END = 0.6;
export const SALMON_XP = 10;

export function salmonChance(level, boosted = false) {
  // Nível 1: 10%. +1 ponto percentual por nível, até 45%; acerto dobra a chance.
  const base = Math.min(45, 10 + Math.max(0, level - 1)) / 100;
  return base * (boosted ? 2 : 1);
}

export function cursorPosition(elapsed) {
  return Math.max(0, elapsed % CHALLENGE_DURATION_MS) / CHALLENGE_DURATION_MS;
}

export function isGreen(position) {
  return position >= GREEN_START && position <= GREEN_END;
}

export function nearWater(position) {
  if (!position || !walkable(position.x, position.y, floorOf(position))) return false;
  // Um quadrado de distância, incluindo as diagonais (vizinhança de 8 tiles).
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && tileAt(position.x + dx, position.y + dy, floorOf(position)) === 'water')
        return true;
    }
  return false;
}
