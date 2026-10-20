import { TEMPLE, TILE, WELL } from '../config.js';
import { canvas, rect, pixels, ellipse } from './drawing.js';

// Pátio simétrico sem paredes. As colunas dos cantos respeitam a profundidade.
let floor;
export function drawTempleFloor(ctx, camera) {
  if (!floor) {
    floor = canvas(TEMPLE.w * TILE, TEMPLE.h * TILE);
    const c = floor.getContext('2d');
    rect(c, '#666f69', 0, 0, floor.width, floor.height);
    for (let y = 0; y < TEMPLE.h; y++)
      for (let x = 0; x < TEMPLE.w; x++) {
        const px = x * TILE,
          py = y * TILE;
        rect(c, (x + y) % 2 ? '#a8ac96' : '#b9bba6', px + 1, py + 1, 30, 30);
        rect(c, '#d4d0b7', px + 2, py + 2, 28, 1);
        rect(c, '#8a9383', px + 2, py + 29, 28, 1);
        if (x === 0 || x === TEMPLE.w - 1 || y === 0 || y === TEMPLE.h - 1) {
          rect(c, '#81754c', px + 4, py + 4, 24, 24);
          rect(c, '#c7b77a', px + 5, py + 5, 22, 22);
          rect(c, '#a4ab95', px + 7, py + 7, 18, 18);
        }
      }
    // Mosaico de estrela e caminho cerimonial até a fonte.
    const x = (WELL.x - TEMPLE.x) * TILE + 16,
      y = (WELL.y - TEMPLE.y) * TILE + 16;
    pixels(c, '#788e87', [
      [x, y - 34],
      [x + 10, y - 10],
      [x + 34, y],
      [x + 10, y + 10],
      [x, y + 34],
      [x - 10, y + 10],
      [x - 34, y],
      [x - 10, y - 10],
    ]);
    pixels(c, '#d7c887', [
      [x, y - 25],
      [x + 6, y - 6],
      [x + 25, y],
      [x + 6, y + 6],
      [x, y + 25],
      [x - 6, y + 6],
      [x - 25, y],
      [x - 6, y - 6],
    ]);
    for (let row = 3; row < TEMPLE.h; row++) {
      rect(c, '#c9bc84', x - 5, row * TILE + 8, 10, 16);
      rect(c, '#e0d2a2', x - 4, row * TILE + 8, 8, 2);
    }
  }
  ctx.drawImage(floor, TEMPLE.x * TILE - camera.x, TEMPLE.y * TILE - camera.y);
}

function column(ctx, x, y) {
  ellipse(ctx, '#28332d55', x + 18, y + 29, 19, 5);
  rect(ctx, '#515e56', x + 1, y + 23, 30, 8);
  rect(ctx, '#b9b99e', x + 2, y + 21, 28, 7);
  rect(ctx, '#e0dcc2', x + 3, y + 21, 26, 2);
  rect(ctx, '#777f70', x + 7, y - 22, 18, 44);
  rect(ctx, '#bfc3ae', x + 8, y - 22, 16, 43);
  rect(ctx, '#e2dfc7', x + 9, y - 21, 4, 41);
  rect(ctx, '#9aab9a', x + 18, y - 21, 3, 41);
  rect(ctx, '#6c8177', x + 23, y - 21, 2, 41);
  rect(ctx, '#9d8750', x + 7, y - 20, 18, 4);
  rect(ctx, '#d8c583', x + 8, y - 20, 16, 1);
  rect(ctx, '#7d8875', x + 2, y - 28, 28, 7);
  rect(ctx, '#c3c4aa', x, y - 32, 32, 6);
  rect(ctx, '#ece3c4', x + 1, y - 32, 30, 2);
  rect(ctx, '#b5a268', x + 5, y - 35, 22, 3);
}

export function templeObjects(ctx, camera) {
  const objects = [];
  for (const dx of [0, TEMPLE.w - 1])
    for (const dy of [0, TEMPLE.h - 1]) {
      const tx = TEMPLE.x + dx,
        ty = TEMPLE.y + dy;
      objects.push({
        depth: ty * TILE + 29,
        draw: () => column(ctx, tx * TILE - camera.x, ty * TILE - camera.y),
      });
    }
  return objects;
}

export function drawFountain(ctx, x, y, time) {
  ellipse(ctx, '#263c3877', x + 18, y + 29, 23, 8);
  pixels(ctx, '#576c66', [
    [x - 6, y + 10],
    [x + 3, y + 2],
    [x + 28, y + 2],
    [x + 38, y + 10],
    [x + 38, y + 24],
    [x + 28, y + 31],
    [x + 2, y + 31],
    [x - 6, y + 23],
  ]);
  ellipse(ctx, '#a3b6a5', x + 16, y + 16, 23, 13);
  ellipse(ctx, '#d4d3af', x + 16, y + 12, 22, 10);
  ellipse(ctx, '#3a9caa', x + 16, y + 12, 18, 7);
  ellipse(ctx, '#77d0c8', x + 16, y + 10, 14, 4);
  rect(ctx, '#737f6e', x + 11, y - 15, 10, 28);
  rect(ctx, '#c8c7a2', x + 12, y - 15, 8, 26);
  rect(ctx, '#e8dfb5', x + 12, y - 14, 2, 23);
  rect(ctx, '#b6a66c', x + 7, y - 18, 18, 5);
  ellipse(ctx, '#d0c58d', x + 16, y - 20, 13, 5);
  ellipse(ctx, '#4ba8aa', x + 16, y - 22, 10, 3);
  pixels(ctx, '#73d7d2', [
    [x + 16, y - 42],
    [x + 21, y - 33],
    [x + 16, y - 25],
    [x + 11, y - 33],
  ]);
  rect(ctx, '#d8fff0', x + 15, y - 38, 2, 9);
  for (let i = 0; i < 5; i++) {
    const phase = (time / 160 + i * 3) % 16;
    rect(ctx, i % 2 ? '#a7e7d9' : '#d2fff0', x + 3 + i * 6, y - 8 + phase, 1, 3);
  }
  ellipse(ctx, '#d7f8df99', x + 16, y + 12, 11 + Math.sin(time / 400) * 2, 3);
}
