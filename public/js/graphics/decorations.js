import { rect, pixels, ellipse } from './drawing.js';

// Small original pixel sprites. Coordinates are local to a 32px tile.
export function drawDecoration(ctx, type, x, y, time = 0) {
  ctx.save();
  ctx.translate(x, y);
  ellipse(ctx, '#14212644', 16, 25, 11, 3);
  if (type === 'basalt' || type === 'crystal') {
    const crystal = type === 'crystal';
    for (const [px, py, h] of [
      [6, 25, 13],
      [13, 27, 23],
      [21, 25, 15],
    ]) {
      pixels(ctx, '#17252d', [
        [px - 1, py],
        [px - 1, py - h + 4],
        [px + 3, py - h - 1],
        [px + 8, py - h + 4],
        [px + 8, py],
      ]);
      pixels(ctx, crystal ? '#579ca8' : '#4d454c', [
        [px, py - 1],
        [px, py - h + 4],
        [px + 3, py - h],
        [px + 7, py - h + 4],
        [px + 7, py - 1],
      ]);
      rect(ctx, crystal ? '#b5eee0' : '#897674', px + 2, py - h + 4, 2, h - 5);
      rect(ctx, crystal ? '#315e80' : '#302e37', px + 5, py - h + 5, 2, h - 5);
    }
  } else if (type === 'embers' || type === 'fire_rune') {
    ellipse(ctx, '#372a30', 16, 23, 12, 6);
    for (let i = 0; i < 7; i++) {
      const px = 6 + i * 3,
        py = 20 + (i % 3) * 2;
      rect(ctx, '#93513a', px, py, 3, 3);
      rect(ctx, (Math.floor(time / 450) + i) % 3 ? '#e88c3d' : '#ffc572', px, py, 2, 1);
    }
    if (type === 'fire_rune') {
      rect(ctx, '#262c32', 10, 7, 13, 19);
      rect(ctx, '#6f6261', 11, 5, 10, 18);
      rect(ctx, '#f3a44b', 15, 9, 2, 10);
      rect(ctx, '#f3a44b', 12, 12, 8, 2);
    }
  } else if (type === 'stump' || type === 'driftwood') {
    pixels(ctx, '#282b2b', [
      [3, 24],
      [9, 18],
      [9, 6],
      [15, 5],
      [17, 17],
      [24, 13],
      [27, 16],
      [22, 22],
      [29, 26],
    ]);
    rect(ctx, type === 'stump' ? '#5d4942' : '#9b8460', 10, 8, 5, 16);
    rect(ctx, type === 'stump' ? '#897160' : '#d5bd8c', 11, 8, 2, 14);
    rect(ctx, '#675341', 16, 19, 8, 3);
    rect(ctx, '#b49971', 5, 24, 20, 2);
  } else if (type === 'bones' || type === 'shells' || type === 'moss') {
    for (let i = 0; i < 4; i++) {
      const px = 5 + i * 6,
        py = 19 + (i % 2) * 5;
      ellipse(ctx, type === 'moss' ? '#526349' : '#897d66', px, py, 4, 3);
      rect(ctx, type === 'moss' ? '#94a675' : '#e1d3ab', px - 2, py - 2, 5, 2);
    }
    if (type === 'bones') {
      rect(ctx, '#cfc7a1', 9, 14, 13, 2);
      rect(ctx, '#eee0b6', 10, 12, 2, 6);
      rect(ctx, '#eee0b6', 19, 12, 2, 6);
    }
  } else if (
    type === 'coral' ||
    type === 'reeds' ||
    type === 'mushrooms' ||
    type === 'wildflowers'
  ) {
    for (let i = 0; i < 5; i++) {
      const px = 5 + i * 5,
        py = 25 - (i % 2) * 3,
        h = 8 + (i % 3) * 4;
      rect(ctx, type === 'coral' ? '#9d596a' : '#52785b', px, py - h, 2, h);
      if (type === 'reeds') {
        rect(ctx, '#bcb374', px, py - h - 3, 2, 5);
        rect(ctx, '#75977b', px - 2, py - h + 4, 3, 1);
      } else {
        ellipse(
          ctx,
          type === 'coral' ? '#e19a9b' : type === 'mushrooms' ? '#8cbab4' : '#cbb6d0',
          px + 1,
          py - h,
          3,
          2,
        );
        rect(ctx, '#e9dec0', px, py - h - 1, 1, 1);
      }
    }
  } else if (type === 'banner' || type === 'skull') {
    rect(ctx, '#242c29', 14, 1, 4, 28);
    rect(ctx, '#947b50', 15, 2, 2, 25);
    if (type === 'banner') {
      pixels(ctx, '#374a2a', [
        [4, 3],
        [24, 3],
        [23, 20],
        [15, 17],
        [5, 20],
      ]);
      rect(ctx, '#a5b477', 6, 4, 16, 2);
      rect(ctx, '#d1c39c', 12, 8, 7, 6);
      rect(ctx, '#243626', 13, 10, 2, 2);
      rect(ctx, '#243626', 17, 10, 2, 2);
    } else {
      ellipse(ctx, '#d3c5a2', 16, 8, 6, 6);
      rect(ctx, '#313c32', 12, 6, 3, 3);
      rect(ctx, '#313c32', 18, 6, 3, 3);
      rect(ctx, '#9c987c', 13, 13, 7, 2);
    }
  } else if (type === 'crates') {
    for (const [px, py] of [
      [3, 16],
      [16, 11],
    ]) {
      rect(ctx, '#302d26', px, py, 14, 14);
      rect(ctx, '#94734c', px + 1, py + 1, 12, 12);
      rect(ctx, '#cab078', px + 1, py + 1, 12, 2);
      rect(ctx, '#5f5036', px + 3, py + 4, 2, 8);
      rect(ctx, '#5f5036', px + 9, py + 4, 2, 8);
      rect(ctx, '#c5a36d', px + 2, py + 10, 10, 2);
    }
  } else if (type === 'pillar') {
    rect(ctx, '#333d34', 6, 22, 22, 5);
    rect(ctx, '#a3a58b', 7, 21, 20, 3);
    pixels(ctx, '#7c8572', [
      [10, 21],
      [10, 9],
      [17, 6],
      [23, 10],
      [22, 21],
    ]);
    rect(ctx, '#c0bda0', 11, 10, 3, 10);
    rect(ctx, '#4e5e51', 20, 11, 2, 10);
    rect(ctx, '#c4bda1', 9, 7, 9, 3);
  }
  ctx.restore();
}
