// Andares: 0 = superfície, 1 = montanhas/muralhas, -1 = cavernas.
// Contas antigas sem z continuam na superfície.
import { SAFE_ZONE } from '../config.js';
export const FLOORS = [-1, 0, 1];
export const WORLD_LAYOUT_VERSION = 3;
export const floorOf = (point) => point?.z ?? 0;
export const sameFloor = (a, b) => floorOf(a) === floorOf(b);
export const inArea = (x, y, area) =>
  x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h;
export const REGION_OFFSETS = {
  orc: { x: 74, y: 6 },
  fire: { x: 16, y: 48 },
  water: { x: 69, y: 36 },
};
export const regionalPoint = (biome, point) => ({
  ...point,
  x: point.x + REGION_OFFSETS[biome].x,
  y: point.y + REGION_OFFSETS[biome].y,
});
export const isSafeZone = (point) =>
  floorOf(point) === 0 && !!point && inArea(point.x, point.y, SAFE_ZONE);
export const ORC_REGION = { x: 76, y: 8, w: 28, h: 29, name: 'Domínio dos Orcs' };
export const ORC_CASTLE = { x: 80, y: 20, w: 13, h: 10, name: 'Castelo Presa de Pedra' };
export const MOUNTAINS = [
  { id: 'orc', x: 7, y: 5, w: 11, h: 7, name: 'Montanha Presa de Pedra', ground: 'gravel' },
  { id: 'fire', x: 23, y: 54, w: 8, h: 7, name: 'Pico das Brasas', ground: 'obsidian' },
  { id: 'water', x: 98, y: 23, w: 8, h: 9, name: 'Falésias das Marés', ground: 'sand' },
].map((area) => ({ ...area, ...regionalPoint(area.id, area) }));
export const CAVES = [
  { id: 'orc', x: 5, y: 6, w: 17, h: 18, name: 'Cavernas dos Orcs', ground: 'cave' },
  { id: 'fire', x: 34, y: 66, w: 24, h: 18, name: 'Cavernas de Magma', ground: 'obsidian' },
  { id: 'water', x: 76, y: 47, w: 26, h: 20, name: 'Gruta das Marés', ground: 'cave' },
].map((area) => ({ ...area, ...regionalPoint(area.id, area) }));
export const mountainAt = (x, y) =>
  MOUNTAINS.find(
    (area) =>
      inArea(x, y, area) &&
      ((x - (area.x + (area.w - 1) / 2)) / (area.w / 2)) ** 2 +
        ((y - (area.y + (area.h - 1) / 2)) / (area.h / 2)) ** 2 <=
        1,
  );
export const caveAt = (x, y) => CAVES.find((area) => inArea(x, y, area));
export function castleWall(x, y) {
  if (!inArea(x, y, ORC_CASTLE)) return false;
  if (x === ORC_CASTLE.x + Math.floor(ORC_CASTLE.w / 2) && y === ORC_CASTLE.y + ORC_CASTLE.h - 1)
    return false;
  return (
    x === ORC_CASTLE.x ||
    x === ORC_CASTLE.x + ORC_CASTLE.w - 1 ||
    y === ORC_CASTLE.y ||
    y === ORC_CASTLE.y + ORC_CASTLE.h - 1
  );
}
export const onRampart = (x, y) =>
  inArea(x, y, ORC_CASTLE) &&
  (x <= ORC_CASTLE.x + 1 ||
    x >= ORC_CASTLE.x + ORC_CASTLE.w - 2 ||
    y <= ORC_CASTLE.y + 1 ||
    y >= ORC_CASTLE.y + ORC_CASTLE.h - 2);

function pair(id, name, up, summit, down, base, kind = 'stairs-up') {
  return [
    { id: id + '-in', name, kind, from: up, to: summit },
    {
      id: id + '-out',
      name: 'Retornar — ' + name,
      kind: kind === 'hole' ? 'ladder-up' : 'stairs-down',
      from: down,
      to: base,
    },
  ];
}
export const FLOOR_LINKS = [
  ...pair(
    'orc-mountain',
    'Montanha dos Orcs',
    { x: 12, y: 12, z: 0 },
    { x: 12, y: 9, z: 1 },
    { x: 12, y: 10, z: 1 },
    { x: 12, y: 13, z: 0 },
  ),
  ...pair(
    'fire-mountain',
    'Pico das Brasas',
    { x: 27, y: 61, z: 0 },
    { x: 27, y: 58, z: 1 },
    { x: 27, y: 59, z: 1 },
    { x: 27, y: 62, z: 0 },
  ),
  ...pair(
    'water-mountain',
    'Falésias das Marés',
    { x: 101, y: 32, z: 0 },
    { x: 101, y: 29, z: 1 },
    { x: 101, y: 30, z: 1 },
    { x: 101, y: 33, z: 0 },
  ),
  ...pair(
    'castle',
    'Muralhas do castelo',
    { x: 17, y: 16, z: 0 },
    { x: 17, y: 18, z: 1 },
    { x: 17, y: 17, z: 1 },
    { x: 17, y: 17, z: 0 },
  ),
  ...pair(
    'orc-cave',
    'Cavernas dos Orcs',
    { x: 20, y: 20, z: 0 },
    { x: 19, y: 20, z: -1 },
    { x: 20, y: 20, z: -1 },
    { x: 20, y: 21, z: 0 },
    'hole',
  ),
  ...pair(
    'fire-cave',
    'Cavernas de Magma',
    { x: 45, y: 76, z: 0 },
    { x: 44, y: 76, z: -1 },
    { x: 45, y: 76, z: -1 },
    { x: 45, y: 77, z: 0 },
    'hole',
  ),
  ...pair(
    'water-cave',
    'Gruta das Marés',
    { x: 85, y: 58, z: 0 },
    { x: 84, y: 58, z: -1 },
    { x: 85, y: 58, z: -1 },
    { x: 85, y: 59, z: 0 },
    'hole',
  ),
].map((link) => {
  const biome = link.id.startsWith('castle') ? 'orc' : link.id.split('-')[0];
  return { ...link, from: regionalPoint(biome, link.from), to: regionalPoint(biome, link.to) };
});
export const transitionAt = (x, y, z = 0) =>
  FLOOR_LINKS.find((link) => link.from.x === x && link.from.y === y && link.from.z === z);
export function validFloorMove(from, to) {
  if (!FLOORS.includes(floorOf(to))) return false;
  if (sameFloor(from, to)) return true;
  return FLOOR_LINKS.some(
    (link) =>
      sameFloor(from, link.from) &&
      sameFloor(to, link.to) &&
      Math.max(Math.abs(from.x - link.from.x), Math.abs(from.y - link.from.y)) <= 1 &&
      to.x === link.to.x &&
      to.y === link.to.y,
  );
}
export function floorName(position) {
  if (floorOf(position) === 0)
    return isSafeZone(position) ? 'Área inicial protegida · Piso 0' : 'Superfície · Piso 0';
  if (floorOf(position) === -1)
    return `${caveAt(position.x, position.y)?.name || 'Subsolo'} · Piso -1`;
  return `${mountainAt(position.x, position.y)?.name || 'Muralhas do castelo'} · Piso +1`;
}
