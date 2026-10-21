// Ajustes gerais. As posições do mapa são medidas em tiles, não em pixels.
export const TILE = 32;
export const GAME_VERSION = '1.1.0';
export const WORLD_SCALE = 2;
export const STEP_DURATION_MS = 165; // Aumente para caminhar mais devagar.
export const AUTOSAVE_INTERVAL_MS = 2500;
export const BACKPACK_CAPACITY = 12;
// Valores iniciais e limites dos atributos. A vida atual é salva na conta.
export const INITIAL_VITALS = { health: 100, maxHealth: 100, mana: 100, maxMana: 100 };

export const WIDTH = 192;
export const HEIGHT = 168;
// Limites das novas regiões. A vila original permanece ao redor do spawn.
export const FIRE_REGION = { x: 35, y: 100, w: 48, h: 37, name: 'Terras das Brasas' };
export const WATER_REGION = { x: 139, y: 54, w: 37, h: 54, name: 'Costa das Marés' };
export const SPAWN = { x: 29, y: 27 };
export const SAFE_ZONE = { x: SPAWN.x - 15, y: SPAWN.y - 15, w: 30, h: 30 };
export const WELL = { x: 29, y: 25 };
export const TEMPLE = { x: SPAWN.x - 3, y: SPAWN.y - 3, w: 7, h: 7 }; // Centro exato no spawn.
export const STOVE = { x: 21, y: 30 }; // Cozinha na casa a oeste do templo.

export const OUTFITS = ['citizen', 'mage', 'warrior'];
// A ordem faz parte dos dados salvos. Altere os valores ou acrescente cores ao fim.
export const COLORS = [
  '#e5c387',
  '#c88b46',
  '#a64c38',
  '#702c40',
  '#d0d3cf',
  '#747d89',
  '#303846',
  '#385a92',
  '#3c849b',
  '#5b8772',
  '#44613e',
  '#827241',
  '#9364a2',
  '#d8898c',
  '#d3ab46',
  '#42392f',
];
export const COLOR_NAMES = [
  'Areia',
  'Caramelo',
  'Terracota',
  'Vinho',
  'Prata',
  'Cinza',
  'Carvão',
  'Azul',
  'Petróleo',
  'Sálvia',
  'Musgo',
  'Oliva',
  'Violeta',
  'Rosa',
  'Dourado',
  'Marrom',
];
export const DEFAULT_OUTFIT = { type: 'citizen', head: 1, body: 10, legs: 15, feet: 15 };
export const DIRECTIONS = ['down', 'left', 'up', 'right'];
export const MOVEMENT = {
  ArrowUp: [0, -1, 'up'],
  ArrowDown: [0, 1, 'down'],
  ArrowLeft: [-1, 0, 'left'],
  ArrowRight: [1, 0, 'right'],
};
