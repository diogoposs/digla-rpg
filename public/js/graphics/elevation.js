import { TILE } from '../config.js';
import { ORC_CASTLE } from '../world/elevation.js';
import { rect, pixels, ellipse } from './drawing.js';

function tower(ctx, x, y) {
  ellipse(ctx, '#111a1688', x, y + 10, 24, 7);
  rect(ctx, '#222c27', x - 22, y - 58, 44, 70);
  rect(ctx, '#69715c', x - 20, y - 56, 40, 66);
  rect(ctx, '#8d9275', x - 18, y - 54, 13, 62);
  rect(ctx, '#465642', x + 12, y - 54, 7, 62);
  for (let row = 0; row < 7; row++) {
    rect(ctx, '#394936', x - 20, y - 49 + row * 9, 40, 1);
    for (let col = 0; col < 3; col++)
      rect(ctx, '#4b5843', x - 15 + col * 13 + (row % 2 ? 4 : 0), y - 55 + row * 9, 1, 6);
  }
  rect(ctx, '#25332b', x - 25, y - 68, 50, 13);
  rect(ctx, '#899076', x - 24, y - 66, 48, 9);
  for (let i = 0; i < 4; i++) {
    rect(ctx, '#2d3a2e', x - 23 + i * 13, y - 76, 10, 12);
    rect(ctx, '#abb08b', x - 22 + i * 13, y - 75, 8, 3);
  }
  rect(ctx, '#202b26', x - 6, y - 42, 12, 23);
  rect(ctx, '#a4b98a', x - 4, y - 40, 2, 16);
  rect(ctx, '#282b22', x + 8, y - 48, 2, 43);
  pixels(ctx, '#9c382f', [
    [x + 10, y - 46],
    [x + 25, y - 46],
    [x + 25, y - 24],
    [x + 18, y - 28],
    [x + 10, y - 24],
  ]);
  rect(ctx, '#e9cc8c', x + 14, y - 41, 7, 7);
  rect(ctx, '#753b2a', x + 16, y - 39, 3, 3);
}

export function elevationObjects(ctx, camera, time, z) {
  if (z !== 0) return [];
  const castle = ORC_CASTLE;
  const objects = [];
  for (const [x, y] of [
    [castle.x, castle.y],
    [castle.x + castle.w - 1, castle.y],
    [castle.x, castle.y + castle.h - 1],
    [castle.x + castle.w - 1, castle.y + castle.h - 1],
  ])
    objects.push({
      depth: y * TILE + 30,
      draw: () => tower(ctx, x * TILE + 16 - camera.x, y * TILE + 24 - camera.y),
    });
  objects.push({
    depth: (castle.y + castle.h - 1) * TILE + 26,
    draw() {
      const x = (castle.x + Math.floor(castle.w / 2)) * TILE + 16 - camera.x,
        y = (castle.y + castle.h - 1) * TILE - camera.y;
      rect(ctx, '#263329', x - 27, y - 34, 54, 9);
      rect(ctx, '#939476', x - 26, y - 33, 52, 5);
      rect(ctx, '#c0b98c', x - 28, y - 35, 56, 3);
      for (const dx of [-25, 22]) {
        rect(ctx, '#3b3327', x + dx, y - 25, 3, 44);
        ellipse(ctx, '#b64c28', x + dx + 1, y - 24, 4, 7);
        rect(ctx, '#ffd66f', x + dx, y - 28 + (Math.floor(time / 150) % 2), 2, 6);
      }
    },
  });
  return objects;
}
