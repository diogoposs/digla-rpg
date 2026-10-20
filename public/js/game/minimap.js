import {
  WIDTH,
  HEIGHT,
  STOVE,
  TEMPLE,
  WELL,
  FIRE_REGION,
  WATER_REGION,
  SAFE_ZONE,
} from '../config.js';
import { tileAt, propAt, houses, FISHING_SPOTS } from '../world/map.js';
import { rect, ellipse, canvas } from '../graphics/drawing.js';
import { MOB_DEFINITIONS } from './world-rules.js';
import { TOWN_POINTS } from './town-rules.js';
import { floorOf, FLOOR_LINKS, ORC_REGION, ORC_CASTLE, regionalPoint } from '../world/elevation.js';

export const MINIMAP_MARKERS = [
  {
    id: 'orc-castle',
    type: 'castle',
    name: 'Castelo Presa de Pedra',
    x: ORC_CASTLE.x + 6,
    y: ORC_CASTLE.y + 4,
    z: 0,
    dx: 0,
    dy: -3,
  },
  ...FLOOR_LINKS.map((link) => ({ id: link.id, type: link.kind, name: link.name, ...link.from })),
  {
    id: 'cave-fishing',
    type: 'fishing',
    name: 'Pesca — Gruta das Marés',
    ...regionalPoint('water', { x: 90, y: 56, z: -1 }),
  },
  { id: 'healing', type: 'healing', name: 'Templo — Vida e mana', ...WELL, dx: -4, dy: -10 },
  { id: 'stove', type: 'stove', name: 'Fogão — Culinária', ...STOVE, dx: 1, dy: 12 },
  ...Object.values(TOWN_POINTS).map((point) => ({
    ...point,
    type: point.kind === 'bank' ? 'bank' : point.id,
    dx: point.id === 'food' ? -7 : point.id === 'gear' ? 7 : 11,
    dy: point.id === 'food' ? 2 : point.id === 'gear' ? -8 : 3,
  })),
  ...FISHING_SPOTS.map((point) => ({ ...point, type: 'fishing' })),
];

export const MINIMAP_LEGEND =
  'Peixe: pesca · Cruz: templo · Fogo: fogão · Pão: alimentos · Espada: equipamentos · Baú: banco · Dado: apostas · Escada: andar · Círculo: caverna · Torre: castelo';

const terrainColors = {
  void: '#0c141b',
  cliff: '#77786b',
  castle_wall: '#4b5d41',
  castle_floor: '#8e9479',
  rampart: '#adb08f',
  cave: '#535045',
  cave_wall: '#272e2b',
  'stairs-up': '#d7c16e',
  'stairs-down': '#d7c16e',
  'ladder-up': '#6dc3b8',
  hole: '#181918',
  water: '#039af1',
  stone: '#a3a392',
  cobble: '#a3a392',
  bridge: '#b99965',
  gravel: '#7c7b69',
  sand: '#c8bb91',
  ash: '#786064',
  obsidian: '#3c414b',
  lava: '#f07932',
};

function drawMarker(ctx, marker, x, y) {
  const px = Math.round(x + (marker.dx || 0));
  const py = Math.round(y + (marker.dy || 0));
  if (marker.dx || marker.dy) {
    ctx.strokeStyle = '#e1d7b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, Math.round(y) + 0.5);
    ctx.lineTo(px + 0.5, py + 0.5);
    ctx.stroke();
  }
  rect(ctx, '#172626', px - 4, py - 4, 9, 9);
  rect(ctx, '#d1c7a1', px - 3, py - 3, 7, 7);
  rect(ctx, '#334744', px - 2, py - 2, 5, 5);
  if (marker.type === 'fishing') {
    rect(ctx, '#77d1ef', px - 2, py - 1, 4, 3);
    rect(ctx, '#c5f1f4', px - 1, py - 2, 2, 1);
    rect(ctx, '#77d1ef', px + 2, py - 2, 1, 5);
    rect(ctx, '#21383a', px - 2, py, 1, 1);
  } else if (['stairs-up', 'stairs-down', 'ladder-up'].includes(marker.type)) {
    for (let row = 0; row < 3; row++)
      rect(ctx, '#f0dc89', px - 2 + row, py + 2 - row * 2, 5 - row, 1);
    rect(ctx, marker.type === 'stairs-down' ? '#ed8b58' : '#93e3b9', px - 2, py - 2, 2, 2);
  } else if (marker.type === 'hole') {
    ellipse(ctx, '#b99061', px, py, 3, 3);
    ellipse(ctx, '#10191d', px, py, 2, 2);
  } else if (marker.type === 'castle') {
    rect(ctx, '#b9c29b', px - 2, py, 5, 3);
    for (let i = 0; i < 3; i++) rect(ctx, '#e1d9b6', px - 2 + i * 2, py - 2, 1, 3);
    rect(ctx, '#273a30', px, py + 1, 1, 2);
  } else if (marker.type === 'healing') {
    rect(ctx, '#a4ecdf', px - 2, py, 5, 1);
    rect(ctx, '#a4ecdf', px, py - 2, 1, 5);
  } else if (marker.type === 'stove') {
    rect(ctx, '#e46b35', px - 2, py, 5, 3);
    rect(ctx, '#ffba55', px - 1, py - 2, 2, 4);
    rect(ctx, '#ffdf87', px, py, 1, 2);
  } else if (marker.type === 'food') {
    rect(ctx, '#bb8243', px - 2, py - 1, 5, 3);
    rect(ctx, '#f7d592', px - 1, py - 2, 3, 1);
    rect(ctx, '#f7d592', px - 1, py - 1, 1, 2);
    rect(ctx, '#f7d592', px + 1, py - 1, 1, 2);
  } else if (marker.type === 'potions') {
    rect(ctx, '#ed696a', px - 2, py - 1, 2, 4);
    rect(ctx, '#79b5eb', px + 1, py - 1, 2, 4);
    rect(ctx, '#e9e6b9', px - 2, py - 2, 2, 1);
    rect(ctx, '#e9e6b9', px + 1, py - 2, 2, 1);
  } else if (marker.type === 'gear') {
    rect(ctx, '#d8e5df', px, py - 2, 1, 3);
    rect(ctx, '#e7bd67', px - 1, py + 1, 3, 1);
    rect(ctx, '#b08556', px, py + 2, 1, 1);
  } else if (marker.type === 'bank') {
    rect(ctx, '#c79249', px - 2, py - 1, 5, 4);
    rect(ctx, '#eed089', px - 2, py - 2, 5, 1);
    rect(ctx, '#4c422f', px - 2, py, 5, 1);
    rect(ctx, '#fce3a0', px, py, 1, 2);
  } else if (marker.type === 'dice') {
    rect(ctx, '#eee4ba', px - 2, py - 2, 5, 5);
    for (const [dx, dy] of [
      [-1, -1],
      [1, -1],
      [0, 0],
      [-1, 1],
      [1, 1],
    ])
      rect(ctx, '#35463a', px + dx, py + dy, 1, 1);
  }
}

// Fundo do minimapa é calculado uma vez; a posição do jogador é atualizada a cada passo.
let background, backgroundFloor;
export function minimapView(position, zoom = 1) {
  const width = WIDTH / zoom,
    height = HEIGHT / zoom;
  return {
    left: Math.max(0, Math.min(WIDTH - width, position.x + 0.5 - width / 2)),
    top: Math.max(0, Math.min(HEIGHT - height, position.y + 0.5 - height / 2)),
    width,
    height,
  };
}
export function minimapTile(target, clientX, clientY, position, zoom = 1) {
  const box = target.getBoundingClientRect(),
    view = minimapView(position, zoom);
  const px = ((clientX - box.left) / box.width) * target.width,
    py = ((clientY - box.top) / box.height) * target.height;
  const sx = target.width / view.width,
    sy = target.height / view.height;
  const hit = MINIMAP_MARKERS.filter((marker) => floorOf(marker) === floorOf(position))
    .map((marker) => ({
      marker,
      distance: Math.hypot(
        (marker.x + 0.5 - view.left) * sx + (marker.dx || 0) - px,
        (marker.y + 0.5 - view.top) * sy + (marker.dy || 0) - py,
      ),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (hit?.distance <= 5) return { x: hit.marker.x, y: hit.marker.y, z: floorOf(position) };
  return {
    x: Math.min(WIDTH - 1, Math.max(0, Math.floor(view.left + px / sx))),
    y: Math.min(HEIGHT - 1, Math.max(0, Math.floor(view.top + py / sy))),
    z: floorOf(position),
  };
}
export function drawMinimap(target, position, zoom = 1, destination = null) {
  const z = floorOf(position);
  const sx = target.width / WIDTH,
    sy = target.height / HEIGHT;
  if (
    !background ||
    background.width !== target.width ||
    background.height !== target.height ||
    backgroundFloor !== z
  ) {
    backgroundFloor = z;
    background = canvas(target.width, target.height);
    const ctx = background.getContext('2d');
    for (let y = 0; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++) {
        const type = tileAt(x, y, z),
          prop = propAt(x, y, z);
        ctx.fillStyle =
          type === 'void'
            ? z > 0
              ? '#344c50'
              : '#252f32'
            : ['tree', 'pine'].includes(prop)
              ? '#354830'
              : terrainColors[type] || '#5b7140';
        ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
      }
    if (z === 0) {
      for (const h of houses)
        rect(ctx, '#b0855a', h.x * sx, h.y * sy, Math.ceil(h.w * sx), Math.ceil(h.h * sy));
      rect(ctx, '#d1c89d', TEMPLE.x * sx, TEMPLE.y * sy, TEMPLE.w * sx, TEMPLE.h * sy);
      rect(ctx, '#59ccd1', WELL.x * sx, WELL.y * sy, Math.ceil(sx), Math.ceil(sy));
    }
  }
  const ctx = target.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const view = minimapView(position, zoom),
    vx = target.width / view.width,
    vy = target.height / view.height;
  target.dataset.view = JSON.stringify(view);
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(
    background,
    view.left * sx,
    view.top * sy,
    view.width * sx,
    view.height * sy,
    0,
    0,
    target.width,
    target.height,
  );
  if (z === 0) {
    ctx.strokeStyle = '#8dd3cd';
    ctx.strokeRect(
      (SAFE_ZONE.x - view.left) * vx,
      (SAFE_ZONE.y - view.top) * vy,
      SAFE_ZONE.w * vx,
      SAFE_ZONE.h * vy,
    );
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    for (const [region, text, color] of [
      [ORC_REGION, 'ORCS', '#cae4a1'],
      [FIRE_REGION, 'BRASAS', '#ffd193'],
      [WATER_REGION, 'MARÉS', '#d8f4ff'],
    ]) {
      const x = Math.round((region.x + region.w / 2 - view.left) * vx);
      const y = Math.round((region.y + 3 - view.top) * vy);
      ctx.fillStyle = '#182a2c';
      ctx.fillText(text, x + 1, y + 1);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    }
  }
  for (const mob of Object.values(MOB_DEFINITIONS).filter((mob) => floorOf(mob.spawn) === z))
    rect(
      ctx,
      mob.kind === 'fire' ? '#f88135' : mob.kind === 'water' ? '#62c8ed' : '#94bd5c',
      (mob.spawn.x - view.left + 0.5) * vx - 1,
      (mob.spawn.y - view.top + 0.5) * vy - 1,
      4,
      4,
    );
  for (const marker of MINIMAP_MARKERS.filter((marker) => floorOf(marker) === z))
    drawMarker(ctx, marker, (marker.x + 0.5 - view.left) * vx, (marker.y + 0.5 - view.top) * vy);
  if (destination && floorOf(destination) === z) {
    const x = (destination.x + 0.5 - view.left) * vx,
      y = (destination.y + 0.5 - view.top) * vy;
    rect(ctx, '#fff0ad', x - 4, y, 9, 1);
    rect(ctx, '#fff0ad', x, y - 4, 1, 9);
  }
  const x = (position.x + 0.5 - view.left) * vx,
    y = (position.y + 0.5 - view.top) * vy;
  ellipse(ctx, '#171f17', x, y, 4, 4);
  rect(ctx, '#eee2ad', x - 2, y - 2, 4, 4);
  rect(ctx, '#fff4cf', x - 1, y - 1, 2, 2);
}
