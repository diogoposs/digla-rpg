import { TILE } from '../config.js';
import { tileAt } from '../world/map.js';
import { hash } from '../world/random.js';
import { canvas, rect, ellipse, pixels, shade } from './drawing.js';

// Mude estas paletas para alterar o chão sem mexer nas regras do mapa.
const PALETTES = {
  stone: { mortar: '#484a43', stones: ['#8c8e81', '#969588', '#7d8278', '#a09d8c'] },
  cobble: { mortar: '#4d4e43', stones: ['#8b8c7d', '#9b9886', '#7c8276', '#a09a87'] },
  gravel: { base: '#777465', stones: ['#999583', '#8a8c7b', '#62675f', '#aaa18a'] },
};
const cache = new Map();

function pebble(ctx, x, y, width, height, color, seed) {
  const cut = width > 7 ? 2 : 1;
  const shape = [
    [x + cut, y],
    [x + width - 2, y],
    [x + width, y + 2],
    [x + width - 1, y + height - 2],
    [x + width - 3, y + height],
    [x + 1, y + height - 1],
    [x, y + 2],
  ];
  pixels(
    ctx,
    shade(color, -40),
    shape.map(([px, py]) => [px, py + 1]),
  );
  pixels(ctx, color, shape);
  rect(ctx, shade(color, 23), x + cut, y, width - cut - 2, 1);
  rect(ctx, shade(color, 11), x + 1, y + 1, Math.max(1, (width / 2) | 0), 1);
  rect(ctx, shade(color, -21), x + width - 2, y + 2, 1, Math.max(1, height - 4));
  if (width > 9 && seed > 0.55) {
    rect(ctx, shade(color, -31), x + 5, y + 3, 2, 1);
    rect(ctx, shade(color, -25), x + 6, y + 4, 1, 2);
    rect(ctx, shade(color, 10), x + 7, y + 4, 1, 1);
  }
}

function drawPaving(ctx, kind, variation) {
  const palette = PALETTES[kind];
  rect(ctx, palette.mortar, 0, 0, TILE, TILE);
  const rowHeight = 8;
  for (let row = -1; row < 5; row++) {
    for (let col = -1; col < 4; col++) {
      const random = hash(col + 5, row + 7, variation + 130);
      const width = kind === 'stone' ? 16 : 8;
      const x = col * width + (row % 2) * Math.floor(width / 2);
      const y = row * rowHeight;
      pebble(
        ctx,
        x + 1,
        y + 1,
        width - 1,
        rowHeight - 1,
        palette.stones[(row + col + variation + 12) % 4],
        random,
      );
    }
  }
  // Pequenas manchas de musgo e areia nas juntas entre as pedras.
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(hash(i, variation, 131) * 32),
      y = Math.floor(hash(i, variation, 132) * 32);
    rect(ctx, i % 3 === 0 ? '#626c4b' : '#55594c', x, y, 2, 1);
  }
}

function drawGravel(ctx, variation) {
  const palette = PALETTES.gravel;
  rect(ctx, palette.base, 0, 0, TILE, TILE);
  for (let i = 0; i < 100; i++) {
    rect(
      ctx,
      ['#858071', '#6a6c60', '#928b78', '#737261'][i % 4],
      Math.floor(hash(i, variation, 136) * 32),
      Math.floor(hash(i, variation, 137) * 32),
      1,
      1,
    );
  }
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) {
      const n = row * 4 + col,
        random = hash(n, variation, 139);
      const x = col * 8 + Math.floor(random * 3),
        y = row * 8 + Math.floor(hash(n, variation, 140) * 3);
      pebble(
        ctx,
        x,
        y,
        3 + Math.floor(random * 4),
        3 + Math.floor(hash(n, variation, 141) * 3),
        palette.stones[(n + variation) % 4],
        random,
      );
    }
  if (variation % 3 === 0) {
    rect(ctx, '#5d674b', 4, 25, 3, 1);
    rect(ctx, '#6b7450', 5, 24, 1, 2);
  }
}

function drawGrass(ctx, variation) {
  rect(ctx, '#52613b', 0, 0, TILE, TILE);
  for (let i = 0; i < 60; i++)
    rect(
      ctx,
      ['#667244', '#445734', '#72774b'][i % 3],
      Math.floor(hash(i, variation, 144) * 32),
      Math.floor(hash(i, variation, 145) * 32),
      i % 4 ? 1 : 2,
      1,
    );
  for (let i = 0; i < 4; i++)
    pebble(
      ctx,
      Math.floor(hash(i, variation, 146) * 28),
      Math.floor(hash(i, variation, 147) * 28),
      3,
      3,
      '#8a8870',
      0,
    );
}

function drawSand(ctx, variation) {
  rect(ctx, '#c6b78b', 0, 0, TILE, TILE);
  for (let i = 0; i < 65; i++)
    rect(
      ctx,
      ['#daceaa', '#acaa8b', '#b6a77d'][i % 3],
      Math.floor(hash(i, variation, 202) * 32),
      Math.floor(hash(i, variation, 203) * 32),
      i % 9 ? 1 : 3,
      1,
    );
  if (variation % 3 === 0) {
    pebble(ctx, 21, 16, 6, 4, '#a0aba1', 0);
    rect(ctx, '#f0e4c1', 5, 24, 4, 2);
    rect(ctx, '#a3947d', 6, 26, 2, 1);
  }
}

function drawVolcanic(ctx, variation, obsidian = false) {
  rect(ctx, obsidian ? '#282e36' : '#5c5051', 0, 0, TILE, TILE);
  for (let i = 0; i < 70; i++)
    rect(
      ctx,
      (obsidian ? ['#3c4650', '#202930', '#4a4549'] : ['#786264', '#493f45', '#8c7068'])[i % 3],
      Math.floor(hash(i, variation, 208) * 32),
      Math.floor(hash(i, variation, 209) * 32),
      1 + (i % 7 === 0),
      1,
    );
  for (let i = 0; i < 5; i++)
    pebble(
      ctx,
      Math.floor(hash(i, variation, 212) * 26),
      Math.floor(hash(i, variation, 213) * 26),
      4 + (i % 3),
      4,
      obsidian ? '#3c3d48' : '#6e595c',
      i / 5,
    );
  if (variation === 1 || variation === 5) {
    const x = 8 + variation;
    rect(ctx, '#3b252c', x - 1, 4, 3, 8);
    rect(ctx, '#a6533a', x, 5, 1, 5);
    rect(ctx, '#b96a41', x + 1, 10, 3, 1);
    rect(ctx, '#723b35', x + 3, 11, 1, 7);
  }
}

function drawLava(ctx, variation) {
  rect(ctx, '#c14028', 0, 0, TILE, TILE);
  for (let row = -1; row < 6; row++) {
    const y = row * 7 + Math.floor(hash(row, variation, 214) * 4);
    for (let col = -1; col < 5; col++) {
      const x = col * 11 + (row % 2) * 4;
      rect(ctx, '#f39836', x, y, 10, 2);
      rect(ctx, '#ffd565', x + 2, y, 5, 1);
      rect(ctx, '#ed682b', x + 6, y + 2, 5, 3);
    }
  }
  pebble(ctx, 6 + (variation % 3), 11, 12, 8, '#542c2b', 0.8);
  pebble(ctx, 23, 25, 8, 5, '#76322b', 0.2);
}

function drawBridge(ctx, variation) {
  drawWater(ctx, variation, 0);
  for (let row = 0; row < 8; row++) {
    rect(ctx, '#493f33', 0, row * 4, 32, 4);
    rect(ctx, row % 2 ? '#9b8159' : '#b09262', 1, row * 4, 30, 3);
    rect(ctx, '#c1a576', 2, row * 4, 28, 1);
    rect(ctx, '#61503a', 6 + (row % 3) * 7, row * 4 + 2, 6, 1);
  }
  rect(ctx, '#514437', 0, 0, 2, 32);
  rect(ctx, '#514437', 30, 0, 2, 32);
}

function drawWater(ctx, variation, shore) {
  rect(ctx, ' #0084ff', 0, 0, TILE, TILE);
  for (let i = 0; i < 16; i++)
    rect(
      ctx,
      i % 3 === 0 ? '#5c8880' : '#326b6c',
      Math.floor(hash(i, variation, 34) * 28),
      Math.floor(hash(i, variation, 35) * 32),
      3 + Math.floor(hash(i, variation, 36) * 4),
      1,
    );
  if (shore & 1) {
    rect(ctx, '#8a8971', 0, 0, 32, 3);
    rect(ctx, '#b0a58b', 0, 0, 32, 1);
    rect(ctx, '#79a296', 0, 3, 32, 1);
  }
  if (shore & 2) {
    rect(ctx, '#8a8971', 29, 0, 3, 32);
    rect(ctx, '#79a296', 28, 2, 1, 28);
  }
  if (shore & 4) {
    rect(ctx, '#8a8971', 0, 29, 32, 3);
    rect(ctx, '#79a296', 1, 28, 28, 1);
  }
  if (shore & 8) {
    rect(ctx, '#8a8971', 0, 0, 3, 32);
    rect(ctx, '#79a296', 3, 2, 1, 28);
  }
  if (variation === 2 || variation === 5) {
    ellipse(ctx, '#637a3d', 17, 17, 5, 2);
    rect(ctx, '#91a15b', 13, 16, 5, 1);
    rect(ctx, '#365544', 17, 15, 1, 3);
  }
}

function drawRockWall(ctx, variation, castle) {
  if (!castle) {
    rect(ctx, '#303b3c', 0, 0, 32, 32);
    pixels(ctx, '#73796c', [
      [0, 3],
      [9, 0],
      [19, 2],
      [28, 0],
      [32, 6],
      [30, 17],
      [32, 27],
      [23, 32],
      [9, 29],
      [0, 32],
    ]);
    pixels(ctx, '#515e58', [
      [0, 14],
      [8, 12],
      [13, 17],
      [23, 14],
      [32, 19],
      [32, 29],
      [22, 25],
      [14, 28],
      [5, 23],
      [0, 25],
    ]);
    rect(ctx, '#a4a58b', 1, 3, 10, 2);
    rect(ctx, '#8d9784', 19, 4, 10, 1);
    rect(ctx, '#303f3d', 10, 8, 2, 12);
    rect(ctx, '#394946', 12, 18, 5, 2);
    rect(ctx, '#26383a', 25, 15, 2, 14);
    rect(ctx, '#8c927a', 3, 25, 7, 1);
    for (let i = 0; i < 4; i++)
      rect(ctx, '#78816d', (i * 9 + variation) % 28, (i * 13 + variation) % 29, 3, 1);
    return;
  }
  rect(ctx, castle ? '#26362b' : '#262a2d', 0, 0, 32, 32);
  for (let row = 0; row < 4; row++) {
    const offset = (row % 2) * 8;
    for (let col = -1; col < 3; col++) {
      const x = col * 16 + offset;
      rect(ctx, castle ? '#697358' : '#67696a', x + 1, row * 8 + 1, 14, 6);
      rect(ctx, castle ? '#9a9b75' : '#8c8e86', x + 2, row * 8 + 1, 12, 1);
      rect(ctx, '#343e35', x + 2, row * 8 + 6, 12, 1);
    }
  }
  if (castle) for (let i = 0; i < 4; i++) rect(ctx, '#b0ad83', i * 9, 0, 6, 4);
  else {
    rect(ctx, '#a8a58c', 1, 1, 12, 2);
    rect(ctx, '#464d43', 18, 14, 2, 13);
  }
}
function drawPassage(ctx, kind) {
  drawGravel(ctx, 2);
  if (kind === 'hole' || kind === 'ladder-up') {
    ellipse(ctx, '#242b25', 16, 18, 15, 12);
    ellipse(ctx, '#655c44', 16, 17, 13, 10);
    ellipse(ctx, '#070d12', 16, 18, 10, 8);
    if (kind === 'ladder-up') {
      rect(ctx, '#d0a56b', 11, 5, 2, 24);
      rect(ctx, '#956a42', 21, 5, 2, 24);
      for (let i = 0; i < 5; i++) rect(ctx, '#e2be7d', 12, 7 + i * 4, 10, 2);
    }
    return;
  }
  rect(ctx, '#30352f', 3, 1, 26, 30);
  for (let i = 0; i < 6; i++) {
    const y = 3 + i * 4,
      inset = kind === 'stairs-up' ? i : 5 - i;
    rect(ctx, '#a6a38c', 5 + inset, y, 22 - inset * 2, 3);
    rect(ctx, '#d4c9a3', 5 + inset, y, 22 - inset * 2, 1);
  }
  rect(ctx, '#d6b860', 1, 1, 2, 29);
  rect(ctx, '#d6b860', 29, 1, 2, 29);
}

export function terrain(x, y, z = 0) {
  const kind = tileAt(x, y, z),
    variation = Math.floor(hash(x, y, 1) * 9);
  let shore = 0;
  if (kind === 'water')
    [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ].forEach(([dx, dy], index) => {
      if (tileAt(x + dx, y + dy, z) !== 'water') shore |= 1 << index;
    });
  const key = `${kind}-${variation}-${shore}-${kind === 'void' ? z : 0}`;
  if (cache.has(key)) return cache.get(key);
  const target = canvas(TILE, TILE),
    ctx = target.getContext('2d');
  if (['stairs-up', 'stairs-down', 'ladder-up', 'hole'].includes(kind)) drawPassage(ctx, kind);
  else if (['cliff', 'castle_wall', 'cave_wall'].includes(kind))
    drawRockWall(ctx, variation, kind === 'castle_wall');
  else if (kind === 'cave') {
    rect(ctx, '#41423b', 0, 0, 32, 32);
    for (let i = 0; i < 7; i++)
      pebble(ctx, (i * 13 + variation) % 28, (i * 7 + variation) % 28, 5, 3, '#656455', 0.2);
  } else if (kind === 'castle_floor' || kind === 'rampart') drawPaving(ctx, 'cobble', variation);
  else if (kind === 'stone' || kind === 'cobble') drawPaving(ctx, kind, variation);
  else if (kind === 'gravel') drawGravel(ctx, variation);
  else if (kind === 'grass') drawGrass(ctx, variation);
  else if (kind === 'sand') drawSand(ctx, variation);
  else if (kind === 'ash' || kind === 'obsidian') drawVolcanic(ctx, variation, kind === 'obsidian');
  else if (kind === 'lava') drawLava(ctx, variation);
  else if (kind === 'bridge') drawBridge(ctx, variation);
  else if (kind === 'water') drawWater(ctx, variation, shore);
  else {
    // Non-walkable backdrop: layered mist upstairs, textured bedrock underground.
    rect(ctx, z > 0 ? '#344c50' : '#252f32', 0, 0, TILE, TILE);
    for (let row = 0; row < 4; row++) {
      const offset = (row % 2) * 8;
      for (let col = -1; col < 3; col++) {
        const px = col * 16 + offset;
        if (z > 0) {
          rect(ctx, '#3c5759', px, row * 8 + 2, 13, 3);
          rect(ctx, '#496164', px + 3, row * 8 + 1, 8, 1);
        } else {
          pebble(
            ctx,
            px + 1,
            row * 8 + 1,
            14,
            6,
            ['#303b3d', '#354143', '#2c383b'][(row + col + variation + 6) % 3],
            0.2,
          );
        }
      }
    }
  }
  cache.set(key, target);
  return target;
}
