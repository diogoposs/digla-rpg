import { hash } from '../world/random.js';
import { canvas, rect, ellipse, pixels } from './drawing.js';
import { DICE_ALCOVE } from '../game/town-rules.js';
import { drawShopEmblem, drawShopPlaque } from './shop-details.js';
const propCache = new Map();

export function makeProp(type, variant, treeStyle = type === 'pine' ? 'pine' : 'oak') {
  if (type === 'tree' || type === 'pine') variant = 0;
  const key = type + variant + treeStyle;
  if (propCache.has(key)) return propCache.get(key);
  const c = canvas(80, 96),
    ctx = c.getContext('2d');
  if (type === 'tree' || type === 'pine') {
    ellipse(ctx, '#1c301f66', 42, 84, 24, 8);
    if (treeStyle === 'oak' || treeStyle === 'pine') {
      rect(ctx, '#3c3928', 35, 50, 10, 32);
      rect(ctx, '#756144', 37, 55, 5, 27);
      rect(ctx, '#92734a', 38, 58, 2, 19);
      rect(ctx, '#514b31', 31, 82, 18, 3);
    }
    if (treeStyle === 'charred') {
      rect(ctx, '#242b2c', 32, 31, 14, 50);
      rect(ctx, '#56443d', 35, 34, 8, 47);
      rect(ctx, '#927360', 36, 36, 2, 41);
      pixels(ctx, '#3b3434', [
        [35, 52],
        [20, 41],
        [16, 24],
        [20, 23],
        [25, 38],
        [37, 43],
        [45, 27],
        [57, 15],
        [61, 17],
        [48, 34],
        [44, 56],
      ]);
      rect(ctx, '#76604f', 20, 28, 2, 10);
      rect(ctx, '#b46a3f', 38, 65, 1, 10);
      rect(ctx, '#c18a52', 39, 70, 2, 2);
    } else if (treeStyle === 'palm') {
      pixels(ctx, '#6a5137', [
        [34, 82],
        [39, 54],
        [45, 32],
        [50, 31],
        [45, 57],
        [41, 82],
      ]);
      for (let i = 0; i < 8; i++) rect(ctx, '#c4a274', 38 + Math.floor(i / 2), 76 - i * 5, 5, 2);
      for (const shape of [
        [
          [47, 31],
          [31, 14],
          [15, 17],
          [5, 28],
          [22, 23],
          [35, 25],
        ],
        [
          [47, 31],
          [48, 9],
          [61, 6],
          [74, 14],
          [58, 13],
          [53, 29],
        ],
        [
          [46, 31],
          [66, 22],
          [77, 32],
          [79, 48],
          [67, 36],
          [52, 34],
        ],
        [
          [45, 31],
          [25, 30],
          [14, 42],
          [10, 55],
          [26, 42],
          [43, 35],
        ],
        [
          [47, 30],
          [56, 40],
          [57, 56],
          [51, 64],
          [50, 44],
          [43, 34],
        ],
      ]) {
        pixels(
          ctx,
          '#244b40',
          shape.map(([x, y]) => [x, y + 3]),
        );
        pixels(ctx, '#477c57', shape);
        rect(ctx, '#7ea367', shape[1][0], shape[1][1] + 1, 6, 2);
      }
      rect(ctx, '#9c7744', 44, 33, 7, 5);
    } else if (treeStyle === 'pine') {
      const rows = [
        [34, 8, 10],
        [28, 16, 22],
        [22, 28, 34],
        [17, 40, 44],
        [12, 53, 54],
        [15, 65, 48],
      ];
      for (const [xx, yy, ww] of rows) {
        rect(ctx, '#263f2a', xx, yy + 3, ww, 14);
        rect(ctx, '#365638', xx + 2, yy, ww - 4, 12);
        rect(ctx, '#45663b', xx + 4, yy, ww - 8, 5);
        rect(ctx, '#526f3f', xx + 5, yy + 1, Math.floor(ww * 0.35), 2);
        rect(ctx, '#2d4930', xx + Math.floor(ww * 0.6), yy + 7, Math.floor(ww * 0.4), 5);
      }
    } else {
      const colors = ['#263d28', '#38522d', '#486332', '#587539', '#6d8441'];
      const blobs = [
        [18, 38, 21, 19],
        [40, 37, 24, 24],
        [24, 22, 29, 27],
        [14, 30, 20, 22],
        [41, 25, 20, 21],
        [29, 13, 24, 24],
        [22, 46, 24, 21],
        [49, 41, 16, 19],
      ];
      // Copas recortadas em grupos de folhas, com silhueta orgânica e sombra abaixo.
      blobs.forEach(([xx, yy, ww, hh], i) => {
        const shape = [
          [xx + 5, yy],
          [xx + ww - 6, yy - 1],
          [xx + ww - 1, yy + 4],
          [xx + ww + 1, yy + hh - 6],
          [xx + ww - 5, yy + hh],
          [xx + 5, yy + hh + 1],
          [xx - 1, yy + hh - 5],
          [xx, yy + 5],
        ];
        pixels(
          ctx,
          colors[0],
          shape.map(([x, y]) => [x, y + 2]),
        );
        pixels(ctx, colors[1], shape);
        pixels(ctx, colors[2], [
          [xx + 5, yy],
          [xx + ww - 6, yy],
          [xx + ww - 2, yy + 5],
          [xx + ww - 5, yy + hh - 5],
          [xx + 6, yy + hh - 3],
          [xx + 1, yy + 6],
        ]);
        pixels(ctx, colors[3], [
          [xx + 6, yy],
          [xx + ww - 8, yy],
          [xx + ww - 5, yy + 4],
          [xx + ww - 9, yy + 6],
          [xx + 5, yy + 5],
          [xx + 2, yy + 7],
        ]);
        rect(ctx, colors[4], xx + 7, yy + 1, 3, 1);
      });
      for (let i = 0; i < 50; i++) {
        const xx = 14 + Math.floor(hash(i, variant, 51) * 50),
          yy = 20 + Math.floor(hash(i, variant, 52) * 40);
        if (ctx.getImageData(xx, yy, 1, 1).data[3])
          rect(ctx, i % 3 ? colors[3] : colors[0], xx, yy, 2, 1);
      }
    }
  } else if (type === 'rock') {
    ellipse(ctx, '#27392066', 40, 84, 14, 4);
    rect(ctx, '#535b49', 27, 75, 27, 10);
    rect(ctx, '#7a7f6a', 29, 70, 23, 12);
    rect(ctx, '#969781', 33, 68, 14, 4);
    rect(ctx, '#acaa8d', 33, 69, 9, 2);
    rect(ctx, '#616c54', 43, 77, 8, 6);
    rect(ctx, '#69804a', 26, 83, 11, 2);
  } else if (type === 'bush') {
    ellipse(ctx, '#2d442a66', 40, 84, 13, 4);
    [
      [28, 76, 11, 9],
      [36, 72, 13, 13],
      [45, 77, 9, 8],
    ].forEach(([x, y, w, h]) => {
      rect(ctx, '#344e2e', x, y, w, h);
      rect(ctx, '#5e793b', x + 1, y, w - 2, 4);
      rect(ctx, '#7b8e46', x + 2, y + 1, 3, 1);
    });
    if (variant === 1) {
      rect(ctx, '#bd7157', 34, 79, 2, 2);
      rect(ctx, '#b85b49', 45, 80, 2, 2);
    }
  } else if (type === 'flowers') {
    for (let i = 0; i < 6; i++) {
      const xx = 29 + Math.floor(hash(i, variant, 61) * 22),
        yy = 76 + Math.floor(hash(i, variant, 62) * 10);
      rect(ctx, '#38592d', xx, yy, 1, 4);
      rect(ctx, variant === 2 ? '#bf855d' : '#d4ca88', xx - 1, yy - 2, 3, 2);
      rect(ctx, '#a5a55e', xx, yy - 1, 1, 1);
    }
  } else if (type === 'sign') {
    rect(ctx, '#56432c', 39, 65, 3, 20);
    rect(ctx, '#352e23', 28, 63, 26, 11);
    rect(ctx, '#b59660', 29, 64, 24, 8);
    rect(ctx, '#d2b67a', 30, 64, 21, 1);
    rect(ctx, '#77603d', 32, 67, 14, 1);
    rect(ctx, '#77603d', 34, 69, 9, 1);
  } else if (type === 'lamp') {
    ellipse(ctx, '#202f2266', 41, 85, 9, 3);
    rect(ctx, '#30372d', 39, 56, 3, 29);
    rect(ctx, '#73745a', 40, 58, 1, 26);
    rect(ctx, '#323b2c', 35, 48, 11, 12);
    rect(ctx, '#e6bf6e', 37, 50, 7, 7);
    rect(ctx, '#f6dfa0', 39, 51, 3, 4);
    rect(ctx, '#454e34', 36, 45, 9, 3);
    rect(ctx, '#242f24', 40, 42, 2, 4);
    rect(ctx, '#303a2a', 36, 83, 9, 3);
  }
  propCache.set(key, c);
  return c;
}
const houseCache = new Map();
function drawBankInterior(ctx, h) {
  const x = 8,
    y = 40,
    w = h.w * 32,
    height = h.h * 32,
    door = Math.floor(h.w / 2) * 32;
  rect(ctx, '#353e38', x, y, w, height);
  for (let row = 0; row < height; row += 16)
    for (let col = 0; col < w; col += 16) {
      rect(ctx, (row + col) % 32 ? '#8d947c' : '#9ba28c', x + col + 1, y + row + 1, 14, 14);
      rect(ctx, '#b5b99d', x + col + 2, y + row + 1, 12, 1);
    }
  const wall = (xx, yy, ww, hh) => {
    rect(ctx, '#34473e', xx, yy, ww, hh);
    rect(ctx, '#87987f', xx + 2, yy + 2, ww - 4, hh - 4);
    rect(ctx, '#c5c5a0', xx + 2, yy + 2, ww - 4, 3);
    for (let row = 8; row < hh; row += 8) rect(ctx, '#65755f', xx + 2, yy + row, ww - 4, 1);
  };
  wall(x, y, door, 25);
  wall(x + door + 32, y, w - door - 32, 25);
  wall(x, y + 25, 24, height - 25);
  wall(x + w - 24, y + 25, 24, height - 25);
  wall(x, y + height - 24, door, 24);
  wall(x + door + 32, y + height - 24, w - door - 32, 24);
  for (const yy of [y, y + height - 6]) rect(ctx, '#d0c49a', x + door, yy, 32, 6);
  const area = DICE_ALCOVE,
    ax = x + (area.x - h.x) * 32,
    ay = y + (area.y - h.y) * 32;
  rect(ctx, '#b99b61', ax - 2, ay - 2, area.w * 32 + 4, area.h * 32 + 4);
  rect(ctx, '#43536a', ax, ay, area.w * 32, area.h * 32);
  rect(ctx, '#73829a', ax + 3, ay + 3, area.w * 32 - 6, 1);
  // Cantinho de apostas do Dário; o centro do salão fica com piso comum.
  for (const [dx, dy] of [
    [12, 12],
    [22, 22],
    [32, 32],
  ])
    rect(ctx, '#e5d4a2', ax + dx, ay + dy, 3, 3);
}
// Casas abertas em corte: o piso fica abaixo do jogador e a porta coincide com a colisão.
function drawHouseInterior(ctx, h) {
  if (h.bank) {
    drawBankInterior(ctx, h);
    return;
  }
  const w = h.w * 32,
    height = h.h * 32,
    x = 8,
    y = 40;
  rect(ctx, '#2c2924', x, y, w, height);
  rect(ctx, '#9a7d52', x + 16, y + 16, w - 32, height - 32);
  for (let row = 0; row < height - 32; row += 8) {
    rect(ctx, row % 16 ? '#a98b60' : '#b3976a', x + 16, y + 16 + row, w - 32, 7);
    for (let column = 16 + (row % 16 ? 24 : 0); column < w - 16; column += 40)
      rect(ctx, '#795f40', x + column, y + 16 + row, 1, 7);
  }
  const blue = h.roof === 'blue';
  rect(ctx, blue ? '#38535a' : '#805447', x + 38, y + 45, w - 76, height - 78);
  rect(ctx, '#c7ad71', x + 40, y + 47, w - 80, 2);
  const wall = (xx, yy, ww, hh) => {
    rect(ctx, '#4b493a', xx, yy - 12, ww, hh + 12);
    rect(ctx, '#a19d7f', xx + 1, yy - 11, ww - 2, hh + 9);
    for (let row = 0; row < hh + 8; row += 8) {
      rect(ctx, '#77765f', xx + 1, yy - 5 + row, ww - 2, 1);
      for (let col = 10 + (row % 16 ? 8 : 0); col < ww - 2; col += 16)
        rect(ctx, '#77765f', xx + col, yy - 11 + row, 1, 6);
    }
    rect(ctx, '#d3c7a0', xx, yy - 13, ww, 3);
  };
  const door = Math.floor(h.w / 2) * 32;
  const north = h.entrance === 'north';
  if (north) {
    wall(x, y, door, 25);
    wall(x + door + 32, y, w - door - 32, 25);
  } else wall(x, y, w, 25);
  wall(x, y + 28, 24, height - 28);
  wall(x + w - 24, y + 28, 24, height - 28);
  if (north) wall(x, y + height - 24, w, 24);
  else {
    wall(x, y + height - 24, door, 24);
    wall(x + door + 32, y + height - 24, w - door - 32, 24);
  }
  const threshold = north ? y : y + height - 7;
  rect(ctx, '#c7b990', x + door, threshold, 32, 7);
  rect(ctx, '#e1d1a8', x + door, threshold, 32, 2);
  // Prateleira presa à parede do fundo, sem bloquear um quadrado adicional.
  const shelfY = north ? y + height - 28 : y;
  rect(ctx, '#473c2b', x + 38, shelfY + 5, w - 76, 12);
  rect(ctx, '#c09a64', x + 37, shelfY + 16, w - 74, 3);
  for (let i = 0; i < 4; i++) {
    rect(ctx, ['#917a4b', '#6b8e86', '#a76a4c', '#8f9970'][i], x + 42 + i * 18, shelfY + 7, 8, 8);
    rect(ctx, '#dcc48a', x + 44 + i * 18, shelfY + 7, 4, 1);
  }
  if (h.shop) {
    // Expositores na parede norte, sem ocupar a passagem ou esconder o vendedor.
    const count = 1; // Um quadro em cada loja.
    for (let i = 0; i < count; i++) {
      const xx = x + w / 2 - 12 + (i - (count - 1) / 2) * 36;
      rect(ctx, '#3c3429', xx - 2, y - 9, 28, 29);
      rect(ctx, '#9b7d4b', xx - 1, y - 8, 26, 27);
      rect(ctx, h.shop === 'food' ? '#354b48' : '#34414c', xx + 1, y - 6, 22, 23);
      drawShopEmblem(ctx, h.shop, xx + 2, y - 5);
      rect(ctx, '#cfb57a', xx, y - 8, 24, 1);
    }
    // Placa ao lado esquerdo da porta, sem fechar sua abertura.
    drawShopPlaque(ctx, h.shop, x + door - 29, y + height - 29);
  }
}
export function houseSprite(h) {
  const key = `${h.w}-${h.h}-${h.roof}-${!!h.interior}-${!!h.bank}-${h.shop || ''}-${h.entrance || 'south'}`;
  if (houseCache.has(key)) return houseCache.get(key);
  const w = h.w * 32,
    ht = h.h * 32,
    c = canvas(w + 16, ht + 52),
    ctx = c.getContext('2d');
  if (h.interior) {
    drawHouseInterior(ctx, h);
    houseCache.set(key, c);
    return c;
  }
  ellipse(ctx, '#1b2d1b55', w / 2 + 12, ht + 38, w / 2 + 4, 12);
  rect(ctx, '#504d37', 8, 30, w, ht);
  rect(ctx, '#ad9b6b', 11, 33, w - 6, ht - 8);
  for (let yy = 36; yy < ht + 22; yy += 14)
    for (let xx = 14; xx < w; xx += 20) {
      rect(ctx, '#9a8a5d', xx + (yy % 28 ? 0 : 7), yy, 12, 1);
      rect(ctx, '#c1ad7e', xx + 2, yy + 2, 9, 1);
    }
  rect(ctx, '#594c32', 10, 43, 7, ht - 12);
  rect(ctx, '#74603e', 11, 43, 2, ht - 12);
  rect(ctx, '#594c32', w - 3, 43, 7, ht - 12);
  rect(ctx, '#594c32', 12, ht - 8, w - 10, 6);
  rect(ctx, '#58492e', w / 2 - 9, ht - 18, 28, 48);
  rect(ctx, '#342f22', w / 2 - 6, ht - 16, 22, 44);
  rect(ctx, '#81653c', w / 2 - 4, ht - 14, 17, 42);
  for (let xx = w / 2 - 2; xx < w / 2 + 12; xx += 5) rect(ctx, '#644d30', xx, ht - 12, 1, 39);
  rect(ctx, '#c1a35d', w / 2 + 8, ht + 6, 2, 3);
  rect(ctx, '#9b9375', w / 2 - 13, ht + 30, 36, 5);
  rect(ctx, '#bab08b', w / 2 - 15, ht + 35, 40, 4);
  for (const wx of [29, w - 42]) {
    rect(ctx, '#544b31', wx, ht - 21, 25, 29);
    rect(ctx, '#38483d', wx + 3, ht - 18, 19, 22);
    rect(ctx, '#9eaf8c', wx + 4, ht - 17, 8, 9);
    rect(ctx, '#758f7c', wx + 14, ht - 17, 7, 9);
    rect(ctx, '#d5ba73', wx + 4, ht - 6, 17, 7);
    rect(ctx, '#6d5d3c', wx + 12, ht - 18, 2, 23);
    rect(ctx, '#b19b66', wx + 1, ht + 8, 24, 3);
    rect(ctx, '#536e37', wx - 2, ht + 10, 28, 6);
    rect(ctx, '#b78e5f', wx, ht + 14, 24, 5);
    rect(ctx, '#d1b87a', wx + 3, ht + 9, 2, 3);
  }
  const roof =
    h.roof === 'red'
      ? ['#4c392d', '#77503c', '#956345', '#b17a52']
      : ['#35443f', '#4e655b', '#647c6d', '#84917a'];
  for (let row = 0; row < 8; row++) {
    const inset = Math.abs(3 - row) * 2;
    rect(ctx, roof[0], inset, 8 + row * 8, w + 16 - inset * 2, 10);
    rect(ctx, roof[1], inset + 1, 8 + row * 8, w + 14 - inset * 2, 6);
    for (let xx = inset + 2; xx < w + 10 - inset; xx += 14) {
      rect(ctx, roof[2], xx + (row % 2) * 5, 8 + row * 8, 11, 5);
      rect(ctx, roof[3], xx + (row % 2) * 5, 8 + row * 8, 9, 1);
    }
  }
  rect(ctx, '#c0ac7a', 5, 7, w + 6, 3);
  rect(ctx, roof[0], 0, 71, w + 16, 5);
  rect(ctx, '#a79973', w - 34, 0, 17, 27);
  rect(ctx, '#78765b', w - 36, 0, 21, 5);
  rect(ctx, '#44483a', w - 32, 0, 12, 2);
  houseCache.set(key, c);
  return c;
}
