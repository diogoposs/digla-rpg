import { WIDTH, HEIGHT, WELL, STOVE, TEMPLE, FIRE_REGION, WATER_REGION } from '../config.js';
import { TOWN_POINTS, BANK_HALL } from '../game/town-rules.js';
import { hash } from './random.js';
import { treeStyleAt, BIOME_TREES } from './vegetation.js';
import {
  ORC_REGION,
  ORC_CASTLE,
  inArea,
  mountainAt,
  caveAt,
  castleWall,
  onRampart,
  transitionAt,
  FLOOR_LINKS,
  FLOORS,
  REGION_OFFSETS,
  regionalPoint,
} from './elevation.js';

// x/y: canto superior esquerdo; w/h: largura/altura em tiles.
export const houses = [
  {
    x: 15,
    y: 19,
    w: 6,
    h: 5,
    roof: 'blue',
    interior: true,
    shop: 'potions',
    name: 'Pang — Poções',
  },
  {
    x: 23,
    y: 17,
    w: 6,
    h: 5,
    roof: 'red',
    interior: true,
    shop: 'food',
    name: 'Rafhi — Alimentos',
  },
  {
    x: 34,
    y: 20,
    w: 5,
    h: 5,
    roof: 'blue',
    interior: true,
    shop: 'gear',
    name: 'Matlo — Equipamentos',
  },
  { x: 18, y: 29, w: 5, h: 4, roof: 'red', interior: true, entrance: 'north', name: 'Cozinha' },
  BANK_HALL,
];

export const houseAt = (x, y) =>
  houses.find(
    (house) => x >= house.x && x < house.x + house.w && y >= house.y && y < house.y + house.h,
  );
export const houseDoor = (house) => ({
  x: house.x + Math.floor(house.w / 2),
  y: house.entrance === 'north' ? house.y : house.y + house.h - 1,
});
export function houseWall(house, x, y) {
  if (!house.interior) return true;
  const door = houseDoor(house);
  if (x === door.x && y === door.y) return false;
  if (house.bank && x === door.x && y === house.y) return false;
  return (
    x === house.x || x === house.x + house.w - 1 || y === house.y || y === house.y + house.h - 1
  );
}

// Pontos sugeridos no minimapa: a pesca continua possível em qualquer margem.
export const FISHING_SPOTS = [
  { id: 'village-lake', name: 'Pesca — Lago da vila', x: 38, y: 31 },
  { id: 'tide-west', name: 'Pesca — Costa das Marés', ...regionalPoint('water', { x: 81, y: 43 }) },
  { id: 'tide-reef', name: 'Pesca — Recife', ...regionalPoint('water', { x: 94, y: 46 }) },
  { id: 'tide-south', name: 'Pesca — Enseada sul', ...regionalPoint('water', { x: 88, y: 58 }) },
];

const inRegion = (x, y, region) =>
  x >= region.x && y >= region.y && x < region.x + region.w && y < region.y + region.h;
const oval = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;

export function regionAt(x, y) {
  if (inArea(x, y, ORC_REGION)) return 'orc';
  if (inRegion(x, y, FIRE_REGION)) return 'fire';
  if (inRegion(x, y, WATER_REGION)) return 'water';
  return 'village';
}

function townSquare(x, y) {
  return Object.values(TOWN_POINTS).some(
    (point) => Math.max(Math.abs(x - point.x), Math.abs(y - point.y)) <= 1,
  );
}

// Estradas contínuas evitam que árvores isolem os novos territórios.
function connectingRoad(x, y) {
  return (
    (y === BANK_HALL.y - 1 && x >= 29 && x <= BANK_HALL.x + Math.floor(BANK_HALL.w / 2)) ||
    (x === BANK_HALL.x + Math.floor(BANK_HALL.w / 2) && y >= BANK_HALL.y - 2 && y <= BANK_HALL.y) ||
    (x === 20 && y >= 27 && y <= 29) ||
    (x === 18 && y >= 23 && y <= 27) ||
    (Math.abs(x - 29) <= 1 && y >= 10 && y <= 112) ||
    (Math.abs(y - 10) <= 1 && x >= 29 && x <= 78) ||
    (Math.abs(x - 78) <= 1 && y >= 10 && y <= 33) ||
    (Math.abs(y - 33) <= 1 && x >= 78 && x <= 94) ||
    (Math.abs(y - 112) <= 1 && x >= 29 && x <= 58) ||
    (Math.abs(y - 27) <= 1 && x >= 39 && x <= 60) ||
    (Math.abs(x - 60) <= 1 && y >= 27 && y <= 45) ||
    (Math.abs(y - 45) <= 1 && x >= 60 && x <= 143) ||
    (Math.abs(x - 143) <= 1 && y >= 45 && y <= 73)
  );
}

function fireRoad(x, y) {
  return (
    (Math.abs(y - 64) <= 1 && x >= 28 && x <= 56) ||
    (Math.abs(x - 42) <= 1 && y >= 60 && y <= 81) ||
    (Math.abs(y - 74) <= 1 && x >= 41 && x <= 57) ||
    (Math.abs(y - 79) <= 1 && x >= 32 && x <= 43)
  );
}

function waterCauseway(x, y) {
  return (
    (Math.abs(y - 37) <= 1 && x >= 73 && x <= 100) ||
    (Math.abs(x - 82) <= 1 && y >= 26 && y <= 61) ||
    (Math.abs(y - 47) <= 1 && x >= 81 && x <= 100) ||
    (Math.abs(y - 59) <= 1 && x >= 81 && x <= 100)
  );
}

// Sem paredes: somente as quatro colunas dos cantos bloqueiam o passo.
export function templeObstacle(x, y) {
  return (
    [TEMPLE.x, TEMPLE.x + TEMPLE.w - 1].includes(x) &&
    [TEMPLE.y, TEMPLE.y + TEMPLE.h - 1].includes(y)
  );
}

// Ordem: limites → novas regiões/estradas → vila original.
export function tileAt(x, y, z = 0) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return 'void';
  if (!FLOORS.includes(z)) return 'void';
  const link = transitionAt(x, y, z);
  if (link) return link.kind;
  if (z === -1) {
    const cave = caveAt(x, y);
    if (!cave) return 'void';
    if (x === cave.x || y === cave.y || x === cave.x + cave.w - 1 || y === cave.y + cave.h - 1)
      return 'cave_wall';
    if (
      cave.id === 'fire' &&
      x >= cave.x + 15 &&
      x <= cave.x + 20 &&
      y >= cave.y + 3 &&
      y <= cave.y + 6
    )
      return 'lava';
    if (
      cave.id === 'water' &&
      x >= cave.x + 15 &&
      x <= cave.x + 21 &&
      y >= cave.y + 5 &&
      y <= cave.y + 13
    )
      return 'water';
    return cave.ground;
  }
  if (z === 1) {
    if (onRampart(x, y)) return 'rampart';
    return mountainAt(x, y)?.ground || 'void';
  }
  if (mountainAt(x, y)) return 'cliff';
  if (inArea(x, y, ORC_CASTLE)) return castleWall(x, y) ? 'castle_wall' : 'castle_floor';
  // Clareiras deixam passagens e pontos de chegada acessíveis.
  if (
    FLOOR_LINKS.some((entry) =>
      [entry.from, entry.to].some(
        (point) => point.z === 0 && Math.max(Math.abs(x - point.x), Math.abs(y - point.y)) <= 1,
      ),
    )
  )
    return 'stone';
  const ox = x - REGION_OFFSETS.orc.x,
    oy = y - REGION_OFFSETS.orc.y;
  if (
    (Math.abs(ox - 12) <= 1 && oy >= 12 && oy <= 27) ||
    (Math.abs(oy - 27) <= 1 && ox >= 11 && ox <= 29)
  )
    return 'cobble';
  if ((ox >= 19 && ox <= 21 && oy >= 12 && oy <= 27) || (oy === 13 && ox >= 12 && ox <= 20))
    return 'cobble';
  const wx = x - REGION_OFFSETS.water.x,
    wy = y - REGION_OFFSETS.water.y;
  if (wx >= 100 && wx <= 102 && wy >= 32 && wy <= 37) return 'sand';
  if (houseAt(x, y)) return 'stone';
  if (regionAt(x, y) === 'fire') {
    const fx = x - REGION_OFFSETS.fire.x,
      fy = y - REGION_OFFSETS.fire.y;
    if (connectingRoad(x, y) || fireRoad(fx, fy)) return 'obsidian';
    if (oval(fx, fy, 33, 59, 5, 4) || oval(fx, fy, 55, 68, 7, 5) || oval(fx, fy, 25, 79, 4, 6))
      return 'lava';
    return hash(Math.floor(x / 3), Math.floor(y / 3), 210) > 0.62 ? 'obsidian' : 'ash';
  }
  if (regionAt(x, y) === 'water') {
    if (connectingRoad(x, y) || waterCauseway(wx, wy)) return 'sand';
    return oval(wx, wy, 92, 44, 17, 25) || oval(wx, wy, 101, 65, 9, 7) ? 'water' : 'sand';
  }
  if (connectingRoad(x, y)) {
    return oval(x, y, 44, 31, 6, 5) ? 'bridge' : 'cobble';
  }
  if (townSquare(x, y)) return 'stone';
  if (oval(x, y, 44, 31, 6, 5) || (x > 47 && x < 51 && y > 31 && y < 52)) return 'water';
  if (x >= 26 && x <= 33 && y >= 24 && y <= 30) return 'stone';

  const mainStreets =
    (Math.abs(x - 29) <= 1 && y > 13 && y < 42) || (Math.abs(y - 27) <= 1 && x > 13 && x < 40);
  const doorways =
    (x >= 24 && x <= 27 && y > 19 && y < 25) ||
    (x >= 35 && x <= 36 && y >= 24 && y < 28) ||
    (x === 20 && y >= 27 && y <= 29);
  if (mainStreets || doorways) return 'cobble';

  // A vila tem chão pedregoso; vegetação fica nas franjas do mapa.
  const outskirts = x < 10 || x > 53 || y < 10 || y > 43;
  return outskirts && hash(x, y, 4) > 0.45 ? 'grass' : 'gravel';
}

// Objetos: árvores, pedregulhos, arbustos, postes e a placa da vila.
export function propAt(x, y, z = 0) {
  if (z !== 0) return null;
  if (townSquare(x, y) || connectingRoad(x, y)) return null;
  if (
    BIOME_TREES.some(([tx, ty]) => tx === x && ty === y) &&
    ['ash', 'obsidian', 'sand'].includes(tileAt(x, y))
  )
    return 'tree';
  if (!['grass', 'gravel'].includes(tileAt(x, y))) return null;
  for (const house of houses) {
    if (
      x >= house.x - 1 &&
      x <= house.x + house.w &&
      y >= house.y - 2 &&
      y <= house.y + house.h + 1
    )
      return null;
  }
  if (x === 25 && y === 25) return 'sign';
  if ((x === 25 || x === 34) && y === 30) return 'lamp';
  const edge = x < 3 || y < 3 || x >= WIDTH - 3 || y >= HEIGHT - 3;
  const value = hash(x, y, 13);
  if (edge || (value < 0.115 && (Math.abs(x - 29) > 6 || Math.abs(y - 27) > 6)))
    return treeStyleAt(x, y) === 'pine' ? 'pine' : 'tree';
  if (value > 0.972) return 'rock';
  if (value > 0.94) return 'bush';
  if (value > 0.88) return 'flowers';
  return null;
}

// Usado pelo navegador E pelo servidor para ambos concordarem sobre colisões.
export function walkable(x, y, z = 0) {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 2 ||
    y < 2 ||
    x >= WIDTH - 2 ||
    y >= HEIGHT - 2
  )
    return false;
  if (['water', 'lava', 'void', 'cliff', 'castle_wall', 'cave_wall'].includes(tileAt(x, y, z)))
    return false;
  if (z !== 0) return true;
  if (x === WELL.x && y === WELL.y) return false;
  if (x === STOVE.x && y === STOVE.y) return false;
  if (Object.values(TOWN_POINTS).some((point) => point.x === x && point.y === y)) return false;
  if (templeObstacle(x, y)) return false;
  const house = houseAt(x, y);
  if (house && houseWall(house, x, y)) return false;
  return !['tree', 'pine', 'rock', 'lamp', 'sign'].includes(propAt(x, y));
}
