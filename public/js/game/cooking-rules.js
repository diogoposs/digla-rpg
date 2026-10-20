import { STOVE } from '../config.js';
import { walkable } from '../world/map.js';
import { floorOf } from '../world/elevation.js';

export const COOKING_INTERVAL_MS = 1200;
export const COOKING_XP = 10; // XP por salmão assado; queimados não dão XP.
export const SALMON_RECIPE = {
  id: 'salmon',
  name: 'Salmão',
  ingredient: 'raw_salmon',
  cooked: 'roasted_salmon',
  burnt: 'burnt_salmon',
};

export function cookingChance(level) {
  return Math.min(100, 25 + Math.max(0, level - 1) * 5) / 100;
}

export function nearStove(position) {
  return (
    !!position &&
    floorOf(position) === 0 &&
    walkable(position.x, position.y) &&
    Math.abs(position.x - STOVE.x) <= 1 &&
    Math.abs(position.y - STOVE.y) <= 1
  );
}
