import { FIRE_REGION, WATER_REGION } from '../config.js';
import { ORC_REGION, inArea } from './elevation.js';

// Uma espécie por região, sem sortear modelos ou cores de copa por árvore.
export function treeStyleAt(x, y) {
  if (inArea(x, y, FIRE_REGION)) return 'charred';
  if (inArea(x, y, WATER_REGION)) return 'palm';
  if (inArea(x, y, ORC_REGION)) return 'pine';
  return 'oak';
}

// Árvores adicionais dos biomas: pontos fixos, fora das estradas e entradas.
export const BIOME_TREES = [
  [38, 104],
  [48, 104],
  [68, 107],
  [76, 116],
  [72, 131],
  [45, 132],
  [140, 60],
  [145, 66],
  [141, 88],
  [144, 102],
  [173, 100],
  [171, 58],
];
