import { rect, pixels } from './drawing.js';

// Emblemas originais de 20 × 20 pixels, compartilhados pela parede e pela placa.
export function drawShopEmblem(ctx, kind, x, y) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'potions') {
    for (const [px, color, shine] of [
      [1, '#ba4253', '#f6a291'],
      [11, '#3b70ba', '#a0dbef'],
    ]) {
      rect(ctx, '#c5d6c9', px + 2, 4, 4, 5);
      rect(ctx, '#6e5135', px + 2, 2, 4, 3);
      rect(ctx, '#d4e4d9', px, 9, 8, 9);
      rect(ctx, color, px + 1, 11, 6, 6);
      rect(ctx, shine, px + 1, 11, 2, 4);
    }
  } else if (kind === 'food') {
    pixels(ctx, '#243d42', [
      [1, 6],
      [5, 9],
      [9, 5],
      [15, 4],
      [19, 8],
      [19, 12],
      [15, 15],
      [9, 14],
      [5, 11],
      [1, 14],
    ]);
    pixels(ctx, '#8ab9b8', [
      [2, 8],
      [5, 10],
      [10, 6],
      [15, 6],
      [18, 9],
      [17, 12],
      [12, 13],
      [6, 10],
      [2, 12],
    ]);
    rect(ctx, '#cde2ca', 9, 7, 7, 2);
    rect(ctx, '#da9270', 10, 10, 7, 2);
    rect(ctx, '#172e30', 16, 8, 1, 1);
    rect(ctx, '#557a86', 9, 5, 4, 1);
  } else {
    pixels(ctx, '#23333a', [
      [5, 2],
      [8, 2],
      [10, 5],
      [12, 2],
      [15, 2],
      [20, 6],
      [17, 12],
      [15, 11],
      [16, 19],
      [4, 19],
      [5, 11],
      [3, 12],
      [0, 6],
    ]);
    pixels(ctx, '#879eaa', [
      [5, 4],
      [8, 4],
      [10, 7],
      [12, 4],
      [15, 4],
      [18, 7],
      [16, 10],
      [13, 9],
      [14, 17],
      [6, 17],
      [7, 9],
      [4, 10],
      [2, 7],
    ]);
    rect(ctx, '#d9e3d5', 5, 5, 3, 3);
    rect(ctx, '#d9e3d5', 7, 10, 2, 5);
    rect(ctx, '#4b6776', 12, 9, 2, 7);
    rect(ctx, '#dfbc68', 8, 15, 5, 2);
  }
  ctx.restore();
}

export function drawShopPlaque(ctx, kind, x, y) {
  rect(ctx, '#373428', x + 4, y - 5, 3, 7);
  rect(ctx, '#373428', x + 19, y - 5, 3, 7);
  rect(ctx, '#2a3028', x - 1, y - 1, 28, 27);
  rect(ctx, '#c9ad71', x, y, 26, 25);
  rect(ctx, '#7d5e3b', x + 1, y + 1, 24, 23);
  rect(ctx, '#493e2d', x + 3, y + 3, 20, 19);
  rect(ctx, '#edcf8c', x + 1, y + 1, 24, 1);
  drawShopEmblem(ctx, kind, x + 3, y + 3);
}
