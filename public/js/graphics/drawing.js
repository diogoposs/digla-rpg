// Ferramentas de pixel art compartilhadas por chão, cenário e personagens.
export function canvas(width, height) {
  const target = document.createElement('canvas');
  target.width = width;
  target.height = height;
  return target;
}

export function rect(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
}

export function ellipse(ctx, color, x, y, radiusX, radiusY) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Polígono por linhas inteiras, sem antialias nas bordas dos sprites.
export function pixels(ctx, color, points) {
  const minY = Math.ceil(Math.min(...points.map((point) => point[1])));
  const maxY = Math.floor(Math.max(...points.map((point) => point[1])));
  for (let y = minY; y < maxY; y++) {
    const crossings = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i],
        [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y + 0.5 && y2 > y + 0.5) || (y2 <= y + 0.5 && y1 > y + 0.5))
        crossings.push(x1 + ((y + 0.5 - y1) * (x2 - x1)) / (y2 - y1));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i < crossings.length; i += 2) {
      const left = Math.ceil(crossings[i] - 0.5),
        right = Math.ceil(crossings[i + 1] - 0.5);
      rect(ctx, color, left, y, right - left, 1);
    }
  }
}

export function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (n) =>
    Math.max(0, Math.min(255, n + amount))
      .toString(16)
      .padStart(2, '0');
  return '#' + channel(value >> 16) + channel((value >> 8) & 255) + channel(value & 255);
}

export function outline(source, color = '#171b1b') {
  const target = canvas(source.width, source.height);
  const ctx = target.getContext('2d');
  for (const [x, y] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ])
    ctx.drawImage(source, x, y);
  ctx.globalCompositeOperation = 'source-in';
  rect(ctx, color, 0, 0, target.width, target.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(source, 0, 0);
  return target;
}
