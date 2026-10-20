import { canvas, pixels, rect, ellipse, outline } from './drawing.js';

const sprites = new Map();
function sprite(kind, frame, direction, variant = 'elemental') {
  const key = `${kind}:${frame}:${direction}:${variant}`;
  if (sprites.has(key)) return sprites.get(key);
  const target = canvas(44, 50),
    ctx = target.getContext('2d'),
    water = kind === 'water';
  if (direction === 'right') {
    ctx.translate(44, 0);
    ctx.scale(-1, 1);
  }
  const bob = frame % 2,
    dark = water ? '#19597d' : '#9f331d',
    mid = water ? '#329fc1' : '#f16a22',
    light = water ? '#89dcec' : '#ffc34d',
    core = water ? '#d5fff4' : '#fff0a1';
  if (['wisp', 'drake', 'serpent'].includes(variant)) {
    if (variant === 'wisp') {
      const y = 23 + bob * 2;
      pixels(ctx, dark, [
        [10, y + 4],
        [13, y - 8],
        [21, y - 14],
        [31, y - 6],
        [34, y + 6],
        [26, y + 13],
        [15, y + 11],
      ]);
      ellipse(ctx, mid, 22, y, 9, 11);
      ellipse(ctx, light, 23, y - 2, 6, 7);
      ellipse(ctx, core, 24, y - 4, 3, 4);
      rect(ctx, dark, 16, y, 3, 2);
      rect(ctx, dark, 25, y, 3, 2);
      for (let i = 0; i < 3; i++) rect(ctx, light, 10 + i * 11, 42 - ((frame + i) % 3) * 6, 2, 2);
    } else if (variant === 'drake') {
      pixels(ctx, dark, [
        [4, 10],
        [16, 20],
        [22, 31],
        [9, 35],
        [10, 26],
        [1, 29],
      ]);
      pixels(ctx, mid, [
        [6, 15],
        [14, 23],
        [16, 29],
        [9, 26],
        [4, 27],
      ]);
      pixels(ctx, dark, [
        [39, 10],
        [29, 20],
        [23, 31],
        [36, 35],
        [34, 26],
        [43, 29],
      ]);
      pixels(ctx, mid, [
        [37, 15],
        [30, 23],
        [27, 29],
        [34, 26],
        [40, 27],
      ]);
      pixels(ctx, dark, [
        [15, 20],
        [16, 9],
        [20, 12],
        [27, 6],
        [30, 15],
        [34, 21],
        [29, 26],
        [29, 37],
        [37, 43],
        [27, 45],
        [19, 40],
        [12, 44],
        [10, 41],
        [15, 34],
      ]);
      pixels(ctx, mid, [
        [18, 20],
        [20, 15],
        [27, 12],
        [29, 19],
        [26, 24],
        [26, 36],
        [31, 42],
        [25, 41],
        [21, 34],
        [16, 37],
      ]);
      pixels(ctx, light, [
        [22, 25],
        [26, 25],
        [24, 36],
        [21, 38],
        [19, 34],
      ]);
      rect(ctx, core, 25, 17, 3, 2);
      rect(ctx, '#472024', 27, 22, 5, 1);
      rect(ctx, '#f8e9bc', 27, 23, 1, 2);
      rect(ctx, '#f8e9bc', 30, 23, 1, 2);
      rect(ctx, light, 17, 41, 3, 3);
    } else {
      ellipse(ctx, dark, 22, 39, 18, 6);
      ellipse(ctx, mid, 22, 38, 14, 4);
      ellipse(ctx, dark, 21, 37, 7, 2);
      pixels(ctx, dark, [
        [12, 34],
        [16, 29],
        [25, 27],
        [24, 22],
        [17, 18],
        [15, 11],
        [21, 5],
        [30, 8],
        [34, 15],
        [28, 22],
        [31, 29],
        [27, 36],
        [18, 39],
      ]);
      pixels(ctx, mid, [
        [16, 33],
        [22, 30],
        [28, 30],
        [25, 23],
        [19, 17],
        [19, 11],
        [23, 8],
        [29, 11],
        [29, 16],
        [24, 20],
        [27, 27],
        [26, 33],
        [20, 36],
      ]);
      pixels(ctx, light, [
        [19, 32],
        [24, 30],
        [24, 24],
        [22, 20],
        [24, 20],
        [27, 25],
        [28, 32],
        [23, 35],
      ]);
      rect(ctx, core, 22, 12, 3, 2);
      rect(ctx, '#163a51', 23, 12, 1, 2);
      rect(ctx, '#143e5b', 17, 17, 7, 1);
      rect(ctx, '#d5fff4', 18, 18, 1, 2);
      rect(ctx, '#d5fff4', 22, 18, 1, 2);
    }
    const result = outline(target, water ? '#123c53' : '#60231c');
    sprites.set(key, result);
    return result;
  }
  ellipse(ctx, water ? '#1b7388aa' : '#9f3b2388', 22, 44, 15, 4);
  pixels(ctx, dark, [
    [8, 37],
    [12, 25],
    [13, 18],
    [9, 11],
    [17, 15],
    [20, 3 + bob * 2],
    [25, 14],
    [32, 8],
    [31, 20],
    [35, 26],
    [37, 39],
    [30, 44],
    [15, 45],
  ]);
  pixels(ctx, mid, [
    [12, 36],
    [15, 23],
    [17, 16],
    [21, 9],
    [24, 20],
    [29, 16],
    [28, 24],
    [32, 32],
    [32, 39],
    [25, 44],
    [15, 41],
  ]);
  pixels(ctx, light, [
    [17, 37],
    [18, 28],
    [22, 21],
    [26, 30],
    [28, 39],
    [22, 42],
  ]);
  pixels(ctx, dark, [
    [12, 23],
    [6, 26],
    [3, 35],
    [8, 38],
    [11, 33],
    [16, 30],
  ]);
  pixels(ctx, mid, [
    [7, 27],
    [4, 33],
    [8, 35],
    [13, 28],
  ]);
  pixels(ctx, dark, [
    [30, 23],
    [37, 26],
    [41, 34],
    [37, 39],
    [32, 34],
    [27, 29],
  ]);
  pixels(ctx, light, [
    [34, 27],
    [38, 33],
    [36, 35],
    [31, 29],
  ]);
  if (water) {
    pixels(ctx, light, [
      [13, 17],
      [11, 11 + bob],
      [16, 13],
      [21, 6],
      [23, 15],
      [29, 12],
      [27, 19],
    ]);
    rect(ctx, '#225781', 12, 35, 19, 2);
    rect(ctx, '#b0f1ea', 15, 36, 12, 1);
    rect(ctx, '#175b83', 16, 42, 14, 2);
    ellipse(ctx, '#70d2e4', 6 + frame * 8, 43, 3, 1);
    rect(ctx, '#b6f6ff', 16, 20, 4, 3);
    rect(ctx, '#b6f6ff', 25, 20, 4, 3);
    rect(ctx, '#133d6e', 18, 21, 1, 1);
    rect(ctx, '#133d6e', 25, 21, 1, 1);
  } else {
    pixels(ctx, core, [
      [20, 37],
      [19, 31],
      [22, 26],
      [24, 34],
      [23, 40],
    ]);
    pixels(ctx, light, [
      [11, 20],
      [8, 12 - frame],
      [13, 16],
      [16, 10],
      [15, 22],
    ]);
    pixels(ctx, mid, [
      [31, 23],
      [32, 15],
      [36, 9 + frame],
      [35, 21],
    ]);
    rect(ctx, '#4a1d24', 15, 20, 6, 3);
    rect(ctx, '#4a1d24', 24, 20, 6, 3);
    rect(ctx, '#fff3ae', 17, 21, 3, 1);
    rect(ctx, '#fff3ae', 25, 21, 3, 1);
    rect(ctx, '#efb245', 6 + frame * 9, 5 + frame * 3, 1, 3);
    rect(ctx, '#fff0a1', 30 - frame * 6, 3 + frame * 2, 2, 2);
  }
  if (variant === 'guardian') {
    const stone = water ? '#557f93' : '#785b53';
    const edge = water ? '#a3cbd2' : '#c49a73';
    pixels(ctx, '#26363d', [
      [10, 24],
      [15, 20],
      [29, 20],
      [34, 24],
      [30, 38],
      [14, 38],
    ]);
    pixels(ctx, stone, [
      [12, 25],
      [17, 22],
      [27, 22],
      [32, 25],
      [28, 35],
      [16, 35],
    ]);
    rect(ctx, edge, 16, 24, 13, 2);
    rect(ctx, light, 20, 27, 5, 6);
    rect(ctx, core, 22, 28, 1, 3);
    rect(ctx, stone, 3, 27, 8, 8);
    rect(ctx, stone, 33, 27, 8, 8);
    rect(ctx, edge, 3, 27, 8, 2);
    rect(ctx, edge, 33, 27, 8, 2);
    rect(ctx, stone, 11, 39, 9, 5);
    rect(ctx, stone, 25, 39, 9, 5);
  }
  const result = outline(target, water ? '#123c53' : '#60231c');
  sprites.set(key, result);
  return result;
}
export function drawElemental(ctx, mob, x, y, time) {
  const frame = Math.floor(time / 180) % 3;
  ellipse(ctx, '#12212688', x, y + 2, 14, 4);
  ctx.drawImage(
    sprite(mob.kind, frame, mob.direction || 'down', mob.variant),
    Math.round(x - 22),
    Math.round(y - 44),
  );
}
export function drawElementalCorpse(ctx, corpse, x, y) {
  const water = corpse.kind === 'water';
  ellipse(ctx, water ? '#185e7f' : '#572720', x, y - 2, 18, 8);
  ellipse(ctx, water ? '#52bed1' : '#9c4324', x, y - 4, 15, 5);
  rect(ctx, water ? '#b1e8e3' : '#e7a347', x - 8, y - 6, 9, 2);
  pixels(ctx, water ? '#3c8ca9' : '#552b21', [
    [x - 13, y - 1],
    [x - 7, y - 7],
    [x + 3, y - 6],
    [x + 14, y],
    [x + 4, y + 3],
  ]);
}
