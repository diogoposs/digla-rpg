import { TILE } from '../config.js';
import { TOWN_POINTS } from '../game/town-rules.js';
import { drawAvatar } from './character.js';
import { ellipse, pixels, rect } from './drawing.js';

function counter(ctx, x, y) {
  rect(ctx, '#342e29', x - 21, y - 1, 42, 17);
  rect(ctx, '#8b6240', x - 19, y + 1, 38, 13);
  rect(ctx, '#c09962', x - 20, y - 3, 40, 5);
  rect(ctx, '#e1ba7a', x - 20, y - 3, 40, 1);
  rect(ctx, '#b18451', x - 17, y + 4, 34, 1);
  for (const offset of [-16, -5, 7, 17]) rect(ctx, '#60482f', x + offset, y + 3, 1, 10);
}

function foodMerchant(ctx, x, y) {
  ellipse(ctx, '#16221d66', x, y + 6, 20, 5);
  drawAvatar(
    ctx,
    { type: 'citizen', head: 0, body: 2, legs: 15, feet: 15 },
    'down',
    x,
    y + 3,
    1,
    0,
  );
  // Avental claro e chapéu de padeiro, com cesta de pães e peixe na banca.
  rect(ctx, '#ded9b4', x - 5, y - 17, 10, 13);
  rect(ctx, '#a3a88f', x - 5, y - 6, 10, 2);
  rect(ctx, '#3a3931', x - 8, y - 38, 16, 7);
  rect(ctx, '#eee6c7', x - 7, y - 40, 14, 8);
  rect(ctx, '#fff2d8', x - 5, y - 42, 10, 3);
  counter(ctx, x, y);
  for (const offset of [-12, -5]) {
    ellipse(ctx, '#6d4628', x + offset, y - 5, 5, 3);
    ellipse(ctx, '#d39c53', x + offset, y - 6, 4, 2);
    rect(ctx, '#f2cc85', x + offset - 1, y - 8, 1, 3);
  }
  pixels(ctx, '#b6c6bf', [
    [x + 3, y - 6],
    [x + 10, y - 9],
    [x + 16, y - 7],
    [x + 18, y - 10],
    [x + 18, y - 4],
    [x + 15, y - 6],
    [x + 7, y - 3],
  ]);
  rect(ctx, '#223c3d', x + 6, y - 6, 1, 1);
}

function gearMerchant(ctx, x, y) {
  ellipse(ctx, '#16221d66', x, y + 6, 20, 5);
  drawAvatar(
    ctx,
    { type: 'warrior', head: 15, body: 7, legs: 6, feet: 15 },
    'down',
    x,
    y + 3,
    1,
    0,
  );
  counter(ctx, x, y);
  pixels(ctx, '#344b5b', [
    [x - 15, y - 13],
    [x - 5, y - 13],
    [x - 5, y - 4],
    [x - 10, y + 1],
    [x - 15, y - 4],
  ]);
  pixels(ctx, '#9da9a0', [
    [x - 14, y - 12],
    [x - 6, y - 12],
    [x - 6, y - 4],
    [x - 10, y - 1],
    [x - 14, y - 4],
  ]);
  rect(ctx, '#e2c06c', x - 11, y - 11, 2, 9);
  rect(ctx, '#263339', x + 8, y - 21, 3, 21);
  rect(ctx, '#d7e0d6', x + 9, y - 22, 2, 14);
  rect(ctx, '#8c9ca5', x + 8, y - 20, 1, 12);
  rect(ctx, '#dfba66', x + 4, y - 8, 11, 2);
  rect(ctx, '#805334', x + 9, y - 6, 2, 5);
}

function potionMerchant(ctx, x, y) {
  ellipse(ctx, '#16221d66', x, y + 6, 20, 5);
  drawAvatar(ctx, { type: 'mage', head: 4, body: 10, legs: 15, feet: 15 }, 'down', x, y + 3, 1, 0);
  counter(ctx, x, y);
  for (const [dx, color, shine] of [
    [-12, '#bf4152', '#f7a392'],
    [4, '#396ab8', '#94d3ed'],
  ]) {
    rect(ctx, '#bbcfc4', x + dx + 3, y - 16, 4, 5);
    rect(ctx, '#b39259', x + dx + 3, y - 18, 4, 3);
    rect(ctx, '#bed8d1', x + dx, y - 11, 10, 9);
    rect(ctx, color, x + dx + 1, y - 9, 8, 6);
    rect(ctx, shine, x + dx + 2, y - 9, 2, 4);
  }
}

function bank(ctx, x, y, time) {
  ellipse(ctx, '#14231e66', x, y + 14, 26, 7);
  // Cofre público em pódio aberto: não cria paredes nem tiles invisíveis.
  rect(ctx, '#303f41', x - 24, y + 5, 48, 15);
  rect(ctx, '#81928a', x - 22, y + 5, 44, 12);
  rect(ctx, '#b5c0a8', x - 22, y + 5, 44, 2);
  rect(ctx, '#34464b', x - 18, y - 19, 36, 29);
  rect(ctx, '#55717a', x - 16, y - 17, 32, 25);
  rect(ctx, '#9db7b8', x - 15, y - 17, 30, 2);
  rect(ctx, '#243b42', x - 15, y - 2, 30, 2);
  for (const offset of [-12, 10]) {
    rect(ctx, '#d6b56d', x + offset, y - 17, 3, 25);
    rect(ctx, '#ffdf92', x + offset, y - 17, 1, 23);
  }
  rect(ctx, '#273432', x - 4, y - 4, 9, 10);
  rect(ctx, '#e7bd56', x - 3, y - 5, 7, 9);
  rect(ctx, '#573d26', x, y - 2, 1, 4);
  rect(ctx, '#526c70', x - 24, y - 35, 4, 43);
  rect(ctx, '#c2b88e', x - 25, y - 36, 6, 2);
  const sway = Math.floor(time / 650) % 2;
  rect(ctx, '#273d54', x - 20, y - 34, 17, 18);
  rect(ctx, '#3d6590', x - 19, y - 33, 15 - sway, 15);
  ellipse(ctx, '#dfbd6c', x - 12, y - 26, 4, 4);
  rect(ctx, '#fff1b6', x - 13, y - 29, 1, 6);
}

function diceMerchant(ctx, x, y) {
  ellipse(ctx, '#16221d66', x, y + 6, 20, 5);
  drawAvatar(
    ctx,
    { type: 'citizen', head: 4, body: 7, legs: 15, feet: 15 },
    'down',
    x,
    y + 3,
    1,
    0,
  );
  counter(ctx, x, y);
  rect(ctx, '#3b5f48', x - 17, y - 4, 34, 5);
  for (const offset of [-9, 5]) {
    rect(ctx, '#273b33', x + offset - 1, y - 12, 11, 10);
    rect(ctx, '#f1e5bd', x + offset, y - 11, 9, 8);
    rect(ctx, '#786b4c', x + offset + 1, y - 9, 2, 2);
    rect(ctx, '#786b4c', x + offset + 5, y - 5, 2, 2);
  }
}

// A ordenação por profundidade é feita pelo renderer junto com jogador e cenário.
export function townObjects(ctx, camera, time = 0) {
  return Object.values(TOWN_POINTS).map((point) => ({
    depth: point.y * TILE + 28,
    draw() {
      const x = point.x * TILE + 16 - camera.x;
      const y = point.y * TILE + 21 - camera.y;
      if (point.id === 'food') foodMerchant(ctx, x, y);
      else if (point.id === 'gear') gearMerchant(ctx, x, y);
      else if (point.id === 'potions') potionMerchant(ctx, x, y);
      else if (point.kind === 'dice') diceMerchant(ctx, x, y);
      else bank(ctx, x, y, time);
    },
  }));
}
