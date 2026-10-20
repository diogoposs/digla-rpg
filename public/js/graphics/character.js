import { COLORS } from '../config.js';
import { canvas, rect, pixels, ellipse, shade, outline } from './drawing.js';

// Sprites originais de 32 × 40 pixels. Cada parte é desenhada em camadas.
// Cabeça/corpo/pernas/botas usam índices de COLORS, preservando os personagens salvos.
const cache = new Map();
const INK = '#191b1e';
const SKIN = '#c99a70';
const GOLD = '#bb9349';
const STEEL = '#929fa3';

function drawLegs(ctx, palette, walk, mage) {
  for (const [x, offset] of [
    [11, walk],
    [18, -walk],
  ]) {
    pixels(ctx, shade(palette.legs, -26), [
      [x, 26],
      [x + 5, 26],
      [x + 5, 34 + offset],
      [x + 3, 36 + offset],
      [x - 1, 34 + offset],
    ]);
    rect(ctx, palette.legs, x, 27 + offset, 3, 6);
    rect(ctx, shade(palette.legs, 31), x, 28 + offset, 1, 4);
    pixels(ctx, shade(palette.feet, -25), [
      [x - 1, 33 + offset],
      [x + 4, 33 + offset],
      [x + 5, 36 + offset],
      [x + 4, 38 + offset],
      [x - 2, 38 + offset],
      [x - 2, 36 + offset],
    ]);
    rect(ctx, palette.feet, x - 1, 34 + offset, 4, 2);
    rect(ctx, shade(palette.feet, 40), x, 34 + offset, 3, 1);
    rect(ctx, INK, x - 2, 38 + offset, 6, 1);
  }
  if (mage) {
    pixels(ctx, shade(palette.body, -39), [
      [10, 21],
      [23, 21],
      [26, 35],
      [23, 37],
      [9, 37],
      [7, 35],
    ]);
    pixels(ctx, palette.body, [
      [11, 23],
      [21, 23],
      [24, 35],
      [10, 36],
      [9, 34],
    ]);
    pixels(ctx, shade(palette.body, 22), [
      [12, 24],
      [14, 24],
      [13, 34],
      [10, 35],
    ]);
    pixels(ctx, shade(palette.body, -24), [
      [18, 24],
      [21, 25],
      [23, 35],
      [19, 35],
    ]);
    rect(ctx, GOLD, 10, 35, 13, 1);
    for (const x of [12, 17, 21]) {
      rect(ctx, '#e3c679', x, 34, 1, 1);
      rect(ctx, shade(palette.body, -42), x + 1, 28, 1, 5);
    }
  }
}

function drawBody(ctx, palette, bob, side, back) {
  const p = (points) => points.map(([x, y]) => [x, y + bob]);
  pixels(
    ctx,
    shade(palette.body, -38),
    p([
      [10, 16],
      [14, 15],
      [20, 15],
      [24, 18],
      [23, 24],
      [21, 29],
      [12, 29],
      [9, 25],
      [8, 19],
    ]),
  );
  pixels(
    ctx,
    palette.body,
    p([
      [11, 17],
      [15, 16],
      [20, 16],
      [22, 19],
      [21, 26],
      [13, 27],
      [10, 23],
    ]),
  );
  pixels(
    ctx,
    shade(palette.body, 29),
    p([
      [11, 18],
      [14, 17],
      [15, 19],
      [13, 25],
      [11, 24],
    ]),
  );
  rect(ctx, shade(palette.body, -19), 18, 20 + bob, 2, 6);
  rect(ctx, shade(palette.body, 15), 16, 20 + bob, 1, 4);
  rect(ctx, '#49362a', 11, 27 + bob, 12, 2);
  rect(ctx, GOLD, 16, 27 + bob, 3, 2);
  rect(ctx, '#ead08a', 16, 27 + bob, 2, 1);
  if (back) {
    rect(ctx, shade(palette.body, -24), 12, 17 + bob, 9, 7);
    rect(ctx, shade(palette.body, 17), 13, 18 + bob, 2, 5);
  }
  if (side) {
    pixels(
      ctx,
      shade(palette.body, -25),
      p([
        [19, 16],
        [23, 17],
        [24, 23],
        [21, 27],
        [19, 25],
      ]),
    );
  }
}

function drawArms(ctx, palette, bob, walk, warrior) {
  for (const [x, swing] of [
    [7, -walk],
    [23, walk],
  ]) {
    const y = 18 + bob + swing;
    pixels(ctx, shade(palette.body, -30), [
      [x + 1, y - 1],
      [x + 4, y],
      [x + 5, y + 5],
      [x + 3, y + 9],
      [x, y + 7],
      [x - 1, y + 3],
    ]);
    rect(ctx, palette.body, x, y, 3, 5);
    rect(ctx, shade(palette.body, 27), x, y, 1, 4);
    rect(ctx, '#755537', x, y + 6, 3, 2);
    rect(ctx, warrior ? '#9ba7a4' : SKIN, x, y + 8, 3, 2);
    rect(ctx, warrior ? '#d4d5bf' : '#e1b98a', x, y + 8, 2, 1);
  }
}

function drawFace(ctx, palette, bob, side, back) {
  const y = 8 + bob;
  pixels(ctx, '#765039', [
    [12, y],
    [20, y],
    [23, y + 3],
    [22, y + 8],
    [19, y + 11],
    [14, y + 10],
    [11, y + 7],
    [10, y + 3],
  ]);
  pixels(ctx, SKIN, [
    [12, y],
    [20, y + 1],
    [21, y + 7],
    [18, y + 10],
    [14, y + 8],
    [11, y + 5],
  ]);
  rect(ctx, '#e6bc8a', 12, y + 2, 6, 3);
  rect(ctx, '#ddb082', 13, y + 5, 3, 2);
  if (back) {
    rect(ctx, shade(palette.head, -29), 11, y, 11, 7);
    rect(ctx, palette.head, 12, y, 7, 5);
    rect(ctx, shade(palette.head, 27), 13, y + 1, 2, 3);
    return;
  }
  if (side) {
    rect(ctx, INK, 11, y + 3, 2, 1);
    rect(ctx, '#f3dfbe', 11, y + 3, 1, 1);
    rect(ctx, '#e1b382', 9, y + 5, 3, 2);
    rect(ctx, '#81533d', 11, y + 8, 3, 1);
  } else {
    rect(ctx, '#604333', 12, y + 3, 3, 1);
    rect(ctx, '#604333', 18, y + 3, 3, 1);
    rect(ctx, INK, 13, y + 4, 2, 1);
    rect(ctx, INK, 19, y + 4, 2, 1);
    rect(ctx, '#f2dbb9', 13, y + 4, 1, 1);
    rect(ctx, '#f2dbb9', 19, y + 4, 1, 1);
    rect(ctx, '#9d6848', 16, y + 5, 1, 2);
    rect(ctx, '#81533d', 15, y + 8, 4, 1);
  }
}

function drawCitizen(ctx, palette, bob, side, back) {
  const head = palette.head;
  // Chapéu com aba recortada, faixa e addon de pena.
  pixels(ctx, shade(head, -31), [
    [9, 7 + bob],
    [11, 4 + bob],
    [18, 3 + bob],
    [22, 5 + bob],
    [24, 9 + bob],
    [25, 11 + bob],
    [7, 11 + bob],
    [7, 9 + bob],
  ]);
  pixels(ctx, head, [
    [10, 6 + bob],
    [13, 4 + bob],
    [19, 4 + bob],
    [22, 7 + bob],
    [21, 9 + bob],
    [10, 9 + bob],
  ]);
  rect(ctx, shade(head, 33), 12, 5 + bob, 6, 1);
  rect(ctx, shade(head, 20), 10, 6 + bob, 3, 1);
  rect(ctx, '#4d3b2a', 9, 8 + bob, 14, 2);
  rect(ctx, '#c9a45a', 11, 8 + bob, 7, 1);
  rect(ctx, head, 7, 10 + bob, 18, 1);
  pixels(ctx, '#a49566', [
    [22, 8 + bob],
    [22, 3 + bob],
    [25, 1 + bob],
    [26, 1 + bob],
    [25, 5 + bob],
    [23, 7 + bob],
  ]);
  rect(ctx, '#e8dcac', 24, 2 + bob, 1, 3);
  rect(ctx, '#d2c18e', 23, 4 + bob, 1, 3);
  // Costuras, botões e tiras de couro.
  rect(ctx, '#d4b16b', 12, 19 + bob, 1, 7);
  rect(ctx, '#74603a', 13, 19 + bob, 1, 7);
  rect(ctx, shade(palette.body, -46), 16, 20 + bob, 1, 6);
  for (const y of [21, 24]) rect(ctx, '#d5c285', 17, y + bob, 1, 1);
  if (back || side) {
    const x = side ? 19 : 12;
    pixels(ctx, '#493628', [
      [x, 18 + bob],
      [x + 7, 17 + bob],
      [x + 9, 20 + bob],
      [x + 8, 28 + bob],
      [x, 29 + bob],
      [x - 1, 24 + bob],
    ]);
    rect(ctx, '#947044', x, 19 + bob, 7, 7);
    rect(ctx, '#b89359', x + 1, 19 + bob, 5, 2);
    rect(ctx, '#5e462e', x, 23 + bob, 7, 1);
    rect(ctx, '#d6b56a', x + 3, 23 + bob, 1, 3);
    rect(ctx, '#624b30', x + 1, 27 + bob, 5, 1);
  }
}

function drawMage(ctx, palette, bob, side, back) {
  const head = palette.head;
  // Capuz dobrado, aro dourado e bordados na túnica.
  pixels(ctx, shade(head, -37), [
    [10, 9 + bob],
    [10, 5 + bob],
    [13, 2 + bob],
    [19, 2 + bob],
    [23, 5 + bob],
    [24, 11 + bob],
    [21, 15 + bob],
    [21, 7 + bob],
    [13, 7 + bob],
    [12, 14 + bob],
    [9, 12 + bob],
  ]);
  pixels(ctx, head, [
    [11, 8 + bob],
    [12, 5 + bob],
    [15, 3 + bob],
    [19, 3 + bob],
    [22, 6 + bob],
    [22, 9 + bob],
    [19, 7 + bob],
    [13, 7 + bob],
    [12, 12 + bob],
  ]);
  rect(ctx, shade(head, 35), 14, 4 + bob, 5, 1);
  rect(ctx, shade(head, 23), 12, 6 + bob, 2, 2);
  rect(ctx, GOLD, 12, 8 + bob, 10, 1);
  rect(ctx, '#f3d887', 16, 7 + bob, 2, 2);
  rect(ctx, '#7a5853', 17, 8 + bob, 1, 1);
  if (!back) {
    pixels(ctx, '#8f8b7e', [
      [12, 15 + bob],
      [15, 16 + bob],
      [20, 15 + bob],
      [20, 19 + bob],
      [17, 23 + bob],
      [14, 21 + bob],
    ]);
    rect(ctx, '#dfd8be', 13, 16 + bob, 2, 3);
    rect(ctx, '#c2baa1', 16, 18 + bob, 3, 3);
    rect(ctx, '#e5ddc4', 16, 20 + bob, 1, 2);
  }
  for (const [x, y] of [
    [11, 23],
    [21, 23],
    [13, 30],
    [20, 31],
  ]) {
    rect(ctx, GOLD, x, y + bob, 1, 3);
    rect(ctx, '#e9d297', x + 1, y + 1 + bob, 1, 1);
  }
  // Addon de cajado com caveira e empunhadura envolta em tiras.
  rect(ctx, '#3b2e22', 28, 12, 2, 25);
  rect(ctx, '#9c7947', 28, 13, 1, 23);
  for (let y = 22; y < 28; y += 2) rect(ctx, '#d4bc83', 27, y, 3, 1);
  pixels(ctx, '#8a8978', [
    [26, 7],
    [27, 5],
    [30, 5],
    [31, 7],
    [31, 11],
    [29, 13],
    [26, 11],
  ]);
  rect(ctx, '#d5d2b5', 27, 6, 3, 5);
  rect(ctx, '#f0e7c5', 27, 6, 2, 1);
  rect(ctx, INK, 27, 8, 1, 1);
  rect(ctx, INK, 29, 8, 1, 1);
  rect(ctx, '#b7a779', 28, 11, 2, 1);
}

function drawWarrior(ctx, palette, bob, side, back) {
  const head = palette.head;
  pixels(ctx, shade(head, -40), [
    [10, 9 + bob],
    [10, 5 + bob],
    [13, 3 + bob],
    [20, 3 + bob],
    [23, 6 + bob],
    [23, 11 + bob],
    [21, 13 + bob],
    [20, 8 + bob],
    [12, 8 + bob],
    [12, 12 + bob],
    [10, 11 + bob],
  ]);
  pixels(ctx, head, [
    [11, 6 + bob],
    [14, 4 + bob],
    [20, 4 + bob],
    [22, 7 + bob],
    [21, 9 + bob],
    [11, 9 + bob],
  ]);
  rect(ctx, shade(head, 46), 13, 5 + bob, 5, 1);
  rect(ctx, STEEL, 16, 4 + bob, 2, 5);
  rect(ctx, '#e4e3c8', 16, 4 + bob, 1, 4);
  for (const [x, sign] of [
    [9, -1],
    [23, 1],
  ]) {
    pixels(ctx, '#8c8065', [
      [x, 7 + bob],
      [x + sign * 3, 5 + bob],
      [x + sign * 4, 2 + bob],
      [x + sign * 2, 2 + bob],
      [x + sign * 2, 4 + bob],
      [x + 1, 5 + bob],
    ]);
    rect(ctx, '#ded3a6', x + sign * 2, 3 + bob, 1, 2);
  }
  // Ombreiras arredondadas, rebites, peitoral e cota de malha.
  for (const x of [6, 22]) {
    pixels(ctx, '#4d5b60', [
      [x + 1, 16 + bob],
      [x + 5, 16 + bob],
      [x + 7, 19 + bob],
      [x + 5, 22 + bob],
      [x, 21 + bob],
      [x - 1, 18 + bob],
    ]);
    rect(ctx, STEEL, x + 1, 17 + bob, 4, 2);
    rect(ctx, '#e0dec4', x + 1, 17 + bob, 3, 1);
    rect(ctx, '#636f71', x + 1, 20 + bob, 5, 1);
    rect(ctx, GOLD, x + 4, 18 + bob, 1, 1);
  }
  pixels(ctx, '#56646a', [
    [12, 18 + bob],
    [16, 19 + bob],
    [21, 18 + bob],
    [22, 24 + bob],
    [18, 27 + bob],
    [12, 25 + bob],
  ]);
  pixels(ctx, STEEL, [
    [12, 18 + bob],
    [16, 20 + bob],
    [20, 18 + bob],
    [20, 23 + bob],
    [17, 25 + bob],
    [12, 23 + bob],
  ]);
  rect(ctx, '#d2d5c5', 12, 19 + bob, 2, 3);
  rect(ctx, '#b9c4bf', 15, 22 + bob, 4, 1);
  rect(ctx, GOLD, 16, 20 + bob, 2, 2);
  for (let y = 25; y < 29; y += 2)
    for (let x = 11; x < 23; x += 3)
      rect(ctx, (x + y) % 2 ? '#84918d' : '#4d5b5a', x, y + bob, 1, 1);
  // Os addons incluem escudo com aro de aço e espada com lâmina iluminada.
  pixels(ctx, '#4b565b', [
    [3, 23 + bob],
    [9, 21 + bob],
    [12, 23 + bob],
    [11, 30 + bob],
    [7, 34 + bob],
    [3, 30 + bob],
  ]);
  pixels(ctx, palette.head, [
    [4, 24 + bob],
    [9, 23 + bob],
    [10, 24 + bob],
    [9, 29 + bob],
    [7, 32 + bob],
    [5, 29 + bob],
  ]);
  rect(ctx, '#d8d6b9', 4, 23 + bob, 5, 1);
  rect(ctx, '#b9c3bb', 4, 24 + bob, 1, 5);
  rect(ctx, '#9ca8a3', 7, 24 + bob, 1, 7);
  rect(ctx, '#d9c48a', 5, 26 + bob, 5, 1);
  pixels(ctx, '#5c6a6d', [
    [28, 17 + bob],
    [30, 14 + bob],
    [30, 29 + bob],
    [28, 31 + bob],
    [27, 29 + bob],
  ]);
  rect(ctx, '#d9dfcf', 29, 18 + bob, 1, 12);
  rect(ctx, '#9eaba7', 28, 22 + bob, 1, 7);
  rect(ctx, GOLD, 26, 30 + bob, 6, 1);
  rect(ctx, '#d9bc73', 27, 29 + bob, 4, 1);
  rect(ctx, '#664832', 28, 32 + bob, 2, 3);
  if (back) rect(ctx, shade(palette.body, -12), 13, 20 + bob, 6, 4);
}

export function avatarSprite(outfit, direction = 'down', step = 0) {
  const key = JSON.stringify([outfit, direction, step]);
  if (cache.has(key)) return cache.get(key);
  const target = canvas(32, 40),
    ctx = target.getContext('2d');
  if (direction === 'right') {
    ctx.translate(32, 0);
    ctx.scale(-1, 1);
  }
  const palette = Object.fromEntries(
    ['head', 'body', 'legs', 'feet'].map((part) => [part, COLORS[outfit[part]]]),
  );
  const back = direction === 'up',
    side = direction === 'left' || direction === 'right';
  const bob = step === 0 ? 0 : 1,
    walk = step === 1 ? 1 : step === 2 ? -1 : 0;
  drawLegs(ctx, palette, walk, outfit.type === 'mage');
  drawBody(ctx, palette, bob, side, back);
  drawArms(ctx, palette, bob, walk, outfit.type === 'warrior');
  drawFace(ctx, palette, bob, side, back);
  const drawOutfit = { citizen: drawCitizen, mage: drawMage, warrior: drawWarrior }[outfit.type];
  drawOutfit(ctx, palette, bob, side, back);
  const result = outline(target, INK);
  cache.set(key, result);
  return result;
}

export function drawAvatar(ctx, outfit, direction, x, y, scale = 1, step = 0) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    avatarSprite(outfit, direction, step),
    Math.round(x - 16 * scale),
    Math.round(y - 36 * scale),
    32 * scale,
    40 * scale,
  );
}

export function drawPreview(target, outfit, direction = 'down', scale = 3) {
  const ctx = target.getContext('2d');
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.imageSmoothingEnabled = false;
  const x = target.width / 2,
    y = Math.floor(target.height * 0.79);
  ellipse(ctx, '#050c0960', x, y, 10 * scale, 3 * scale);
  drawAvatar(ctx, outfit, direction, x, y, scale);
}
