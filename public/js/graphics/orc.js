import { canvas, rect, pixels, ellipse, outline } from './drawing.js';

const sprites = new Map();
function sprite(direction, step) {
  const key = direction + step;
  if (sprites.has(key)) return sprites.get(key);
  const target = canvas(36, 42),
    ctx = target.getContext('2d');
  if (direction === 'right') {
    ctx.translate(36, 0);
    ctx.scale(-1, 1);
  }
  const back = direction === 'up',
    side = direction === 'left' || direction === 'right',
    bob = step ? 1 : 0,
    walk = step === 1 ? 1 : step === 2 ? -1 : 0;
  for (const [x, dy] of [
    [11, walk],
    [21, -walk],
  ]) {
    rect(ctx, '#49392a', x, 28 + dy, 5, 9);
    rect(ctx, '#806345', x, 29 + dy, 2, 5);
    pixels(ctx, '#282c22', [
      [x - 1, 35 + dy],
      [x + 5, 35 + dy],
      [x + 6, 39 + dy],
      [x - 2, 39 + dy],
    ]);
    rect(ctx, '#696346', x - 1, 36 + dy, 4, 1);
  }
  pixels(ctx, '#314c26', [
    [10, 17 + bob],
    [15, 15 + bob],
    [24, 17 + bob],
    [28, 23 + bob],
    [25, 31 + bob],
    [11, 31 + bob],
    [7, 24 + bob],
  ]);
  pixels(ctx, '#66813c', [
    [11, 18 + bob],
    [18, 16 + bob],
    [24, 18 + bob],
    [24, 26 + bob],
    [20, 29 + bob],
    [11, 26 + bob],
  ]);
  rect(ctx, '#8a9c4b', 12, 18 + bob, 4, 5);
  rect(ctx, '#3c5b2b', 20, 20 + bob, 4, 6);
  pixels(ctx, '#71503a', [
    [11, 24 + bob],
    [25, 24 + bob],
    [26, 32 + bob],
    [11, 33 + bob],
    [9, 30 + bob],
  ]);
  rect(ctx, '#ad874e', 11, 25 + bob, 14, 2);
  rect(ctx, '#dab666', 17, 25 + bob, 3, 2);
  rect(ctx, '#392f24', 15, 28 + bob, 1, 5);
  rect(ctx, '#957047', 20, 29 + bob, 2, 3);
  for (const [x, dy] of [
    [5, -walk],
    [27, walk],
  ]) {
    pixels(ctx, '#3c5a2c', [
      [x + 1, 18 + bob + dy],
      [x + 5, 19 + bob + dy],
      [x + 6, 27 + bob + dy],
      [x + 2, 30 + bob + dy],
      [x - 1, 27 + bob + dy],
      [x - 1, 22 + bob + dy],
    ]);
    rect(ctx, '#749044', x + 1, 20 + bob + dy, 3, 6);
    rect(ctx, '#a2ad60', x + 1, 20 + bob + dy, 1, 3);
    rect(ctx, '#916a3d', x, 26 + bob + dy, 5, 2);
  }
  pixels(ctx, '#365128', [
    [11, 6 + bob],
    [15, 3 + bob],
    [23, 4 + bob],
    [27, 8 + bob],
    [26, 15 + bob],
    [22, 19 + bob],
    [14, 18 + bob],
    [10, 13 + bob],
  ]);
  pixels(ctx, '#7b9545', [
    [13, 5 + bob],
    [21, 5 + bob],
    [24, 8 + bob],
    [23, 15 + bob],
    [18, 17 + bob],
    [12, 13 + bob],
  ]);
  pixels(ctx, '#5c7935', [
    [11, 8 + bob],
    [6, 6 + bob],
    [9, 12 + bob],
    [12, 13 + bob],
  ]);
  pixels(ctx, '#799044', [
    [25, 8 + bob],
    [31, 6 + bob],
    [28, 12 + bob],
    [25, 13 + bob],
  ]);
  rect(ctx, '#9faa59', 14, 6 + bob, 5, 2);
  rect(ctx, '#4d682d', 22, 8 + bob, 3, 6);
  if (!back) {
    rect(ctx, '#344025', 12, 9 + bob, 5, 1);
    rect(ctx, '#344025', 21, 9 + bob, 4, 1);
    rect(ctx, '#e1bd58', 14, 10 + bob, 2, 1);
    if (!side) rect(ctx, '#e1bd58', 22, 10 + bob, 2, 1);
    rect(ctx, '#3d4429', 14, 14 + bob, 9, 2);
    rect(ctx, '#ddcf9a', 14, 13 + bob, 2, 3);
    rect(ctx, '#ddcf9a', 21, 13 + bob, 2, 3);
    rect(ctx, '#d1bd88', 15, 13 + bob, 1, 1);
    rect(ctx, '#a2b25b', 17, 11 + bob, 3, 2);
  } else {
    rect(ctx, '#394729', 14, 4 + bob, 9, 3);
    rect(ctx, '#495d2b', 13, 7 + bob, 2, 6);
  }
  // Clava de madeira com rebites; o dano continua sendo o intervalo configurado no servidor.
  rect(ctx, '#3b2c20', 31, 21, 2, 16);
  pixels(ctx, '#705434', [
    [29, 11],
    [34, 12],
    [35, 21],
    [33, 26],
    [29, 24],
    [27, 16],
  ]);
  rect(ctx, '#ab8752', 29, 13, 2, 8);
  rect(ctx, '#b5b59b', 28, 16, 6, 2);
  rect(ctx, '#b5b59b', 29, 22, 5, 2);
  const result = outline(target, '#171f18');
  sprites.set(key, result);
  return result;
}

export function drawOrc(ctx, orc, x, y, time) {
  const step = orc.moving ? (Math.floor(time / 120) % 2) + 1 : 0;
  ellipse(ctx, '#10201488', x, y + 1, 12, 4);
  ctx.drawImage(sprite(orc.direction || 'down', step), Math.round(x - 18), Math.round(y - 38));
}

let corpseSprite;
export function drawOrcCorpse(ctx, x, y) {
  if (!corpseSprite) {
    const target = canvas(42, 30),
      c = target.getContext('2d');
    ellipse(c, '#432b2588', 21, 21, 19, 6);
    pixels(c, '#3e512b', [
      [3, 15],
      [9, 9],
      [18, 11],
      [25, 14],
      [36, 13],
      [39, 21],
      [28, 24],
      [16, 23],
      [5, 21],
    ]);
    pixels(c, '#789345', [
      [4, 14],
      [10, 11],
      [15, 14],
      [14, 20],
      [8, 21],
      [4, 18],
    ]);
    pixels(c, '#526e32', [
      [15, 13],
      [23, 12],
      [29, 17],
      [26, 22],
      [17, 21],
    ]);
    rect(c, '#a1ad5b', 6, 13, 5, 2);
    rect(c, '#253021', 6, 16, 3, 1);
    rect(c, '#d8c88c', 10, 18, 2, 3);
    pixels(c, '#71503a', [
      [23, 14],
      [29, 14],
      [31, 23],
      [25, 24],
      [22, 21],
    ]);
    rect(c, '#bd9255', 24, 15, 2, 7);
    rect(c, '#3c3025', 30, 15, 9, 4);
    rect(c, '#6f5e3f', 31, 15, 6, 1);
    rect(c, '#303025', 33, 20, 7, 4);
    rect(c, '#7c9445', 15, 22, 7, 3);
    rect(c, '#9ca855', 15, 22, 4, 1);
    rect(c, '#705434', 13, 6, 20, 2);
    rect(c, '#947042', 27, 3, 9, 5);
    rect(c, '#b5b59b', 29, 3, 2, 5);
    corpseSprite = outline(target, '#171f18');
  }
  ctx.drawImage(corpseSprite, Math.round(x - 21), Math.round(y - 20));
}
