// Catálogo visual: nomes e ícones são compartilhados pela mochila e pelas receitas.
function salmonIcon({ outline, skin, back, flesh, shine, detail, roasted = false }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" class="salmon-icon" shape-rendering="crispEdges">
    <path fill="${outline}" d="M3 10h5l3 3h3l6-5h7l4 5v6l-5 4h-7l-6-5h-3l-3 4H2l3-7z"/>
    <path fill="${skin}" d="m9 15 11-5h6l3 4v4l-5 3h-5l-9-5-4 4H4l3-5-3-3h3z"/>
    <path fill="${back}" d="m12 14 8-4h6l2 3-8 1zM19 21l5-2h4l-4 3h-4z"/>
    <path fill="${flesh}" d="m11 15 9-1h8v3l-6 3-7-3z"/>
    <path fill="${shine}" d="M17 14h8v1h-8zM20 11h5v1h-5z"/>
    <path fill="${detail}" d="M26 13h2v2h-2zM29 17h2v1h-2z"/>
    ${roasted ? `<path fill="${detail}" d="m15 14 2 1-1 3-2-1zM20 13l2 1-2 5-2-1zM24 14l2 1-1 3-2-1z"/>` : ''}
  </svg>`;
}

function coinIcon(rim, body, shine, shadow) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" class="salmon-icon" aria-hidden="true" shape-rendering="crispEdges">
    <path fill="#1e211c" d="M9 5h14v2h4v4h2v13h-3v3H7v-3H3V11h3V7h3z"/>
    <path fill="${shadow}" d="M7 12h19v12h-3v2H9v-2H6V12z"/>
    <path fill="${rim}" d="M9 7h14v2h3v3h1v9h-3v3H9v-3H5v-9h2V9h2z"/>
    <path fill="${body}" d="M10 10h12v2h2v7h-3v3H11v-3H8v-7h2z"/>
    <path fill="${shine}" d="M10 8h12v2H10zM7 11h2v7H7zM13 12h6v2h-2v5h-3v-5h-1z"/>
    <path fill="${shadow}" d="M22 12h2v7h-3v2h-9v-2h9v-7z"/>
  </svg>`;
}

function potionIcon(color, light) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" class="salmon-icon" shape-rendering="crispEdges"><path fill="#17252b" d="M11 2h10v9l6 6v10l-4 4H9l-4-4V17l6-6z"/><path fill="#a9c5c5" d="M13 8h6v5l6 6v7l-3 3H10l-3-3v-7l6-6z"/><path fill="${color}" d="M10 18h12l2 3v5l-3 2H11l-3-2v-5z"/><path fill="${light}" d="M10 19h11v2H10zM9 22h2v3H9z"/><path fill="#e7eee0" d="M14 9h2v6h-2zM9 17h2v3H9z"/><path fill="#775337" d="M12 3h8v5h-8z"/><path fill="#cea369" d="M12 3h8v2h-8z"/></svg>`;
}

// Equipamentos próprios em pixel art; a paleta distingue couro, madeira e metal.
function equipmentIcon(kind, material = 'iron') {
  const colors = {
    leather: { base: '#9b7047', light: '#d3a76b', dark: '#5c3d2c', accent: '#dfbd65' },
    wood: { base: '#9c7145', light: '#d7ad6c', dark: '#5b3c2a', accent: '#b8c1b8' },
    iron: { base: '#84949f', light: '#d7e2df', dark: '#485863', accent: '#c7a455' },
    bronze: { base: '#be8844', light: '#f1ce85', dark: '#6e492d', accent: '#74bfc1' },
    silver: { base: '#a1b2bc', light: '#ecf3e8', dark: '#566877', accent: '#85b7df' },
  }[material];
  const shapes = {
    helmet: [
      'M9 4h14v3h4v5h2v13l-8 5-5-4-5 4-8-5V12h2V7h4z',
      'M10 6h12v3h3v14l-5 3-2-4v-9h-4v9l-2 4-5-3V9h3z',
      'M10 7h11v3H10zM7 11h3v10H7zM18 12h5v3h-5z',
      'M22 10h3v13l-5 3-2-4h4zM10 17h4v4h-4z',
      'M14 6h4v6h-4z',
    ],
    armor: [
      'M8 3h4l4 4 4-4h4l7 5-4 10-4-2 2 14H7L9 16l-4 2L1 8z',
      'M8 6h3l5 4 5-4h3l4 3-3 6-4-2 2 14H9l2-14-4 2-3-6z',
      'M8 7h3l4 4v7h-4v-6l-4 1-2-3zM11 21h10v3H11z',
      'M21 7h3l3 3-2 5-4-2 2 14h-5V12z',
      'M14 10h4v3h-4zM10 24h12v2H10z',
    ],
    legs: [
      'M5 2h22l-2 28H15l1-12-1 12H5L3 6z',
      'M7 4h18l-2 24h-6l1-16h-4l-1 16H7L5 6z',
      'M7 5h16v3H7zM7 10h3v15H8zM19 10h3v4h-3z',
      'M22 9h2l-1 19h-5v-3h3zM11 12h3l-1 16h-3z',
      'M7 7h17v3H7zM14 7h4v3h-4z',
    ],
    boots: [
      'M5 2h10v13l3 3V2h10v15l3 3v10H16v-2H1V18h3z',
      'M6 4h7v13l3 3v7H3v-7h3zM20 4h6v14l3 3v6H18v-7h2z',
      'M7 5h4v10H7zM21 5h3v10h-3zM4 22h8v2H4z',
      'M11 16h2v3l3 1v7h-5zM25 17h2v3l2 1v6h-4z',
      'M6 10h7v3H6zM20 10h6v3h-6z',
    ],
    shield: [
      'M15 1h2l3 3 10 3-2 15-5 6-7 4-7-4-5-6L2 7l10-3z',
      'M15 4h2l2 2 8 3-2 12-4 5-5 3-5-3-4-5L5 9l8-3z',
      'M14 6h3v20h-3zM7 10h3v10H7zM11 7h3v2h-3z',
      'M24 10h3l-2 11-4 5-4 2v-5l4-4z',
      'M13 12h6v3h-6zM14 11h3v9h-3z',
    ],
    necklace: [
      'M7 2h5v4H9v10l7 6 7-6V6h-3V2h5l3 5v11l-7 7-1 6h-8l-1-6-7-7V7z',
      'M7 4h3v3H8v10l8 7 8-7V7h-2V4h3l1 4v9l-9 9h-2L6 17V8zM13 24h6v5h-6z',
      'M7 6h2v10H7zM9 17l6 5-1 2-6-5zM14 25h3v2h-3z',
      'M24 8h2v9l-8 8-1-2 7-7zM17 27h2v2h-2z',
      'M14 23h4v4h-4z',
    ],
    ring: [
      'M11 2h10l4 5-2 6 5 5v9l-5 5H9l-5-5v-9l5-5-2-6z',
      'M12 4h8l2 4-3 6h-6l-3-6zM10 15h12l4 4v7l-4 4H10l-4-4v-7z',
      'M11 17h10l3 3v4l-3 3H11l-3-3v-4zM12 5h5v2h-5z',
      'M12 19h8l2 2v3l-2 2h-8l-2-2v-3zM21 7l1 1-3 6h-3z',
      'M13 6h6v4h-6z',
    ],
    arrows: [
      'M21 1h6v3h3v7h-6L11 27v4H2v-8h4L19 7V4h2z',
      'M23 3h2v3h3v3h-5L8 27H4v-3h3L21 7V5h2z',
      'M22 4h2v4L7 27H5v-2h2zM8 21h2v2H8z',
      'M24 7h4v2h-5L9 26H7L22 8z',
      'M3 23h3v5h4v2H3zM7 19h2v5H7z',
    ],
  }[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" class="salmon-icon" aria-hidden="true" shape-rendering="crispEdges">${[
    '#172126',
    colors.base,
    colors.light,
    colors.dark,
    colors.accent,
  ]
    .map((fill, index) => `<path fill="${fill}" d="${shapes[index]}"/>`)
    .join('')}</svg>`;
}

function equipment(name, equipmentSlot, material = 'iron', options = {}) {
  return {
    name,
    category: 'equipment',
    equipmentSlot,
    ...(['helmet', 'armor', 'legs', 'boots', 'shield'].includes(equipmentSlot) ? { arm: 1 } : {}),
    stackable: false,
    icon: equipmentIcon(equipmentSlot, material),
    ...options,
  };
}

export const EQUIPMENT_SLOT_IDS = [
  'weapon',
  'helmet',
  'armor',
  'legs',
  'boots',
  'shield',
  'necklace',
  'ring',
  'arrows',
];

export const ITEMS = {
  lightning_staff: {
    name: 'Cajado de raio',
    category: 'equipment',
    equipmentSlot: 'weapon',
    weapon: true,
    atk: 3,
    range: 3,
    stackable: false,
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" class="salmon-icon" shape-rendering="crispEdges"><path fill="#182733" d="M20 1h10v11l-8 7L9 31H2v-6l15-15z"/><path fill="#6088aa" d="m20 11 4 4L7 29H4v-3z"/><path fill="#c1dee7" d="m20 13 1 1L5 28v-1z"/><path fill="#987749" d="m20 3 9 2-1 8-7 4-4-6z"/><path fill="#f8db5c" d="M24 2h5l-5 7h5L18 21l4-10h-4z"/><path fill="#fff8c0" d="M25 3h2l-6 7h3l-3 4 2-5h-2z"/></svg>`,
  },
  health_potion: {
    name: 'Poção de vida',
    category: 'potion',
    restores: 'health',
    amount: 35,
    icon: potionIcon('#bd3b46', '#f08c85'),
  },
  mana_potion: {
    name: 'Poção de mana',
    category: 'potion',
    restores: 'mana',
    amount: 50,
    icon: potionIcon('#3c66bd', '#81c9ef'),
  },
  gold_coin: {
    name: 'Moeda dourada',
    category: 'currency',
    icon: coinIcon('#d5a52e', '#ad7c20', '#ffe797', '#714f19'),
  },
  silver_coin: {
    name: 'Moeda cinza',
    category: 'currency',
    icon: coinIcon('#aab0b2', '#737f87', '#e9f1ef', '#434c56'),
  },
  sword: {
    name: 'Espada',
    atk: 2,
    category: 'equipment',
    equipmentSlot: 'weapon',
    weapon: true,
    range: 1,
    stackable: false,
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" class="salmon-icon" aria-hidden="true" shape-rendering="crispEdges"><path fill="#141d21" d="M23 2h7v7L15 24l-3-3-6 9-4-4 8-7-4-4 3-3 5 4z"/><path fill="#9eafb5" d="M24 4h4v4L15 21l-4-4z"/><path fill="#deece4" d="m24 4 2 1-14 14-1-2z"/><path fill="#bd964e" d="m8 13 11 10-2 2L6 15z"/><path fill="#80603b" d="m10 20 3 3-7 6-3-3z"/><path fill="#e3c879" d="m4 25 3 3-2 2-3-3z"/></svg>`,
  },
  staff: {
    name: 'Cajado',
    atk: 1,
    category: 'equipment',
    equipmentSlot: 'weapon',
    weapon: true,
    range: 3,
    stackable: false,
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" class="salmon-icon" aria-hidden="true" shape-rendering="crispEdges"><path fill="#1a1c23" d="m22 1 8 5-2 9-6 3L9 31H3v-5l14-14-1-7z"/><path fill="#8c623a" d="m20 10 4 4L8 29H5v-2z"/><path fill="#c29b58" d="m20 12 1 2L6 28v-1z"/><path fill="#b29756" d="m21 3 7 4-2 7-6 2-3-6 1-5z"/><path fill="#474c94" d="m22 4 4 3-2 6-4-1-1-4z"/><path fill="#99c8f5" d="m22 5 2 2-2 4-2-1z"/></svg>`,
  },
  raw_salmon: {
    name: 'Salmão cru',
    category: 'food',
    icon: salmonIcon({
      outline: '#14242a',
      skin: '#9eacaa',
      back: '#658c94',
      flesh: '#dfa28e',
      shine: '#ede0c5',
      detail: '#1b2629',
    }),
  },
  roasted_salmon: {
    name: 'Salmão assado',
    category: 'food',
    icon: salmonIcon({
      outline: '#362314',
      skin: '#c58b4d',
      back: '#8b4c27',
      flesh: '#e3a35c',
      shine: '#f4cb89',
      detail: '#63321c',
      roasted: true,
    }),
  },
  burnt_salmon: {
    name: 'Salmão queimado',
    category: 'food',
    icon: salmonIcon({
      outline: '#080909',
      skin: '#252727',
      back: '#111313',
      flesh: '#191b1b',
      shine: '#4c4b46',
      detail: '#080909',
      roasted: true,
    }),
  },
  leather_helmet: equipment('Elmo de couro', 'helmet', 'leather'),
  leather_armor: equipment('Armadura de couro', 'armor', 'leather'),
  leather_legs: equipment('Calça de couro', 'legs', 'leather'),
  leather_boots: equipment('Botas de couro', 'boots', 'leather'),
  iron_helmet: equipment('Elmo de ferro', 'helmet'),
  iron_armor: equipment('Armadura de ferro', 'armor'),
  iron_legs: equipment('Calça de ferro', 'legs'),
  iron_boots: equipment('Botas de ferro', 'boots'),
  wooden_shield: equipment('Escudo de madeira', 'shield', 'wood'),
  iron_shield: equipment('Escudo de ferro', 'shield'),
  bronze_necklace: equipment('Colar de bronze', 'necklace', 'bronze'),
  silver_necklace: equipment('Colar de prata', 'necklace', 'silver'),
  bronze_ring: equipment('Anel de bronze', 'ring', 'bronze'),
  silver_ring: equipment('Anel de prata', 'ring', 'silver'),
  arrows: equipment('Flechas', 'arrows', 'wood', { stackable: true }),
};
