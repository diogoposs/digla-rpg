import { rect, ellipse, pixels } from './drawing.js';

// Fogão de pedra com chapa, chaminé e fogo. x/y são o canto do tile de colisão.
export function drawStove(ctx, x, y, time) {
  ellipse(ctx, '#161d1866', x + 17, y + 28, 19, 5);
  rect(ctx, '#171d1b', x + 1, y - 8, 30, 37);
  rect(ctx, '#606b65', x + 3, y - 6, 26, 33);
  rect(ctx, '#8d9486', x + 4, y - 5, 23, 5);
  rect(ctx, '#a8ac99', x + 4, y - 5, 22, 1);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 3; col++) {
      rect(
        ctx,
        row % 2 ? '#485650' : '#515b54',
        x + 3 + col * 9 + (row % 2) * 3,
        y + 3 + row * 6,
        8,
        1,
      );
    }
  rect(ctx, '#1c2726', x + 3, y - 10, 25, 6);
  rect(ctx, '#a4aaa0', x + 5, y - 10, 21, 1);
  ellipse(ctx, '#111918', x + 11, y - 6, 5, 2);
  ellipse(ctx, '#111918', x + 22, y - 6, 4, 2);
  rect(ctx, '#b28a50', x + 7, y - 6, 8, 1);
  rect(ctx, '#889082', x + 18, y - 6, 7, 1);
  rect(ctx, '#202a28', x + 24, y - 28, 7, 24);
  rect(ctx, '#64736a', x + 25, y - 27, 4, 23);
  rect(ctx, '#92a091', x + 25, y - 27, 1, 21);
  rect(ctx, '#222b27', x + 23, y - 30, 9, 4);
  rect(ctx, '#9ba593', x + 24, y - 30, 7, 1);
  rect(ctx, '#16201b', x + 6, y + 6, 20, 17);
  rect(ctx, '#612e20', x + 8, y + 8, 16, 12);
  const flicker = Math.floor(time / 180) % 2;
  pixels(ctx, '#d45e28', [
    [x + 9, y + 20],
    [x + 9, y + 15],
    [x + 12, y + 10 - flicker],
    [x + 14, y + 15],
    [x + 17, y + 10 + flicker],
    [x + 20, y + 14],
    [x + 22, y + 12],
    [x + 23, y + 21],
  ]);
  pixels(ctx, '#f3b74e', [
    [x + 11, y + 21],
    [x + 13, y + 16],
    [x + 15, y + 18],
    [x + 17, y + 14],
    [x + 20, y + 20],
    [x + 21, y + 21],
  ]);
  rect(ctx, '#ffdf8b', x + 15, y + 19, 3, 2);
  for (const offset of [0, 6, 12]) rect(ctx, '#26332e', x + 9 + offset, y + 7, 1, 16);
  rect(ctx, '#a9ad98', x + 4, y + 25, 24, 2);
  rect(ctx, '#293630', x + 4, y + 28, 5, 3);
  rect(ctx, '#293630', x + 23, y + 28, 5, 3);
}
