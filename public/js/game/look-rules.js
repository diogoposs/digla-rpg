import { ITEMS } from '../items.js';

const names = {
  lightning_staff: 'a lightning staff',
  health_potion: 'a health potion',
  mana_potion: 'a mana potion',
  gold_coin: 'a gold coin',
  silver_coin: 'a silver coin',
  sword: 'a sword',
  staff: 'a magic staff',
  raw_salmon: 'a raw salmon',
  roasted_salmon: 'a roasted salmon',
  burnt_salmon: 'a burnt salmon',
  leather_helmet: 'a leather helmet',
  leather_armor: 'leather armor',
  leather_legs: 'leather legs',
  leather_boots: 'leather boots',
  iron_helmet: 'an iron helmet',
  iron_armor: 'iron armor',
  iron_legs: 'iron legs',
  iron_boots: 'iron boots',
  wooden_shield: 'a wooden shield',
  iron_shield: 'an iron shield',
  bronze_necklace: 'a bronze necklace',
  silver_necklace: 'a silver necklace',
  bronze_ring: 'a bronze ring',
  silver_ring: 'a silver ring',
  arrows: 'arrows',
  backpack: 'a backpack',
};
export function lookItem(id, quantity = 1) {
  if (!ITEMS[id] && id !== 'backpack') return 'You see an empty slot.';
  let text = `You see ${names[id] || ITEMS[id].name}`;
  const attributes = [];
  if (ITEMS[id]?.atk !== undefined) attributes.push(`ATK: ${ITEMS[id].atk}`);
  if (ITEMS[id]?.arm !== undefined) attributes.push(`ARM: ${ITEMS[id].arm}`);
  if (attributes.length) text += ` (${attributes.join(', ')})`;
  text += '.';
  if (quantity > 1) text += ` Quantity: ${quantity}.`;
  if (ITEMS[id]?.requires)
    text += ` Requires: ${Object.entries(ITEMS[id].requires)
      .map(([skill, level]) => `${skill} ${level}`)
      .join(', ')}.`;
  if (id === 'roasted_salmon')
    text += ' It restores 20 health and 15 mana every 3 seconds for 1 minute.';
  if (ITEMS[id]?.category === 'potion')
    text += ` It instantly restores ${ITEMS[id].amount} ${ITEMS[id].restores === 'health' ? 'health' : 'mana'}.`;
  if (id === 'raw_salmon') text += ' It can be cooked on a stove.';
  if (id === 'staff') text += ' Range: 3 squares. Elements: fire, water and lightning.';
  if (id === 'lightning_staff')
    text += ' Auto attack every 3 seconds. Range: 3 squares. Unlocks Q, W, E and R.';
  if (id === 'backpack') text += ' It has 12 slots.';
  if (id === 'gold_coin') text += ' 100 gold coins can be exchanged for 1 silver coin.';
  return text;
}
export const TERRAIN_NAMES = {
  grass: 'grass',
  gravel: 'gravel',
  stone: 'a stone floor',
  cobble: 'a cobblestone path',
  sand: 'sand',
  ash: 'volcanic ash',
  obsidian: 'obsidian',
  lava: 'lava',
  water: 'water',
  bridge: 'a wooden bridge',
  cliff: 'a rocky cliff',
  castle_wall: 'a castle wall',
  cave_wall: 'a cave wall',
  cave: 'a cave floor',
  castle_floor: 'a castle courtyard',
  rampart: 'a castle rampart',
  void: 'the distant background',
  'stairs-up': 'stairs leading up',
  'stairs-down': 'stairs leading down',
  'ladder-up': 'a ladder',
  hole: 'a hole',
};
export const PROP_NAMES = {
  tree: 'a tree',
  pine: 'a pine tree',
  rock: 'a rock',
  bush: 'a bush',
  flowers: 'flowers',
  lamp: 'a street lamp',
  sign: 'a wooden sign',
};
