import { tileAt, regionAt, propAt, houseAt } from './map.js';
import { hash } from './random.js';
import { transitionAt, FLOOR_LINKS } from './elevation.js';

export const DECORATION_NAMES = {
  basalt: 'a basalt formation',
  embers: 'smoldering embers',
  stump: 'a charred tree stump',
  bones: 'ancient bones',
  fire_rune: 'a scorched runestone',
  coral: 'a coral formation',
  reeds: 'coastal reeds',
  shells: 'seashells',
  driftwood: 'a piece of driftwood',
  crystal: 'a blue crystal cluster',
  banner: 'an orc banner',
  skull: 'a skull on a stake',
  crates: 'old supply crates',
  pillar: 'a broken stone pillar',
  moss: 'mossy stones',
  mushrooms: 'cave mushrooms',
  wildflowers: 'wildflowers',
};

// Visual only: decorations never change collision or cover stairs and their landings.
export function decorationAt(x, y, z = 0) {
  const tile = tileAt(x, y, z);
  if (['void', 'cliff', 'castle_wall', 'cave_wall', 'stone', 'cobble', 'bridge'].includes(tile))
    return null;
  if (
    transitionAt(x, y, z) ||
    FLOOR_LINKS.some((link) =>
      [link.from, link.to].some(
        (p) => p.z === z && Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= 1,
      ),
    )
  )
    return null;
  if (z === 0 && (houseAt(x, y) || propAt(x, y))) return null;
  const region = regionAt(x, y),
    value = hash(x, y, 381 + z);
  if (region === 'village')
    return z === 0 && tile === 'grass' && value < 0.035 ? 'wildflowers' : null;
  if (value > (z === -1 ? 0.16 : 0.13)) return null;
  const choices =
    region === 'fire'
      ? tile === 'lava'
        ? ['basalt', 'embers']
        : ['basalt', 'embers', 'stump', 'bones', 'fire_rune']
      : region === 'water'
        ? tile === 'water'
          ? ['coral', 'reeds']
          : ['shells', 'driftwood', 'crystal', 'reeds']
        : ['banner', 'skull', 'crates', 'pillar', 'moss'];
  if (z === -1 && value < 0.025 && tile !== 'lava' && tile !== 'water') return 'mushrooms';
  return choices[Math.floor(hash(x, y, 383) * choices.length)];
}
