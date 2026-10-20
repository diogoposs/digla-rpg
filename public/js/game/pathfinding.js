import { distance } from './world-rules.js';
import { WIDTH, HEIGHT } from '../config.js';
import { sameFloor } from '../world/elevation.js';

// Caminhos de quatro direções, iguais às setinhas. Alcance 1 termina ao lado do alvo.
export function findPath(start, target, canWalk, range = 0) {
  if (!sameFloor(start, target)) return null;
  if (distance(start, target) <= range) return [];
  const queue = [{ ...start, parent: -1 }],
    seen = new Set([`${start.x},${start.y}`]);
  for (let i = 0; i < queue.length && i < WIDTH * HEIGHT; i++) {
    const point = queue[i];
    if (distance(point, target) <= range) {
      const path = [];
      for (let cursor = i; queue[cursor].parent !== -1; cursor = queue[cursor].parent)
        path.unshift({ x: queue[cursor].x, y: queue[cursor].y });
      return path;
    }
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ]) {
      const next = { x: point.x + dx, y: point.y + dy, z: start.z, parent: i },
        key = `${next.x},${next.y}`;
      if (!seen.has(key) && canWalk(next.x, next.y)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return null;
}

// Bresenham: ataques à distância não atravessam casas/árvores/obstáculos.
export function lineOfSight(from, to, canWalk) {
  if (!sameFloor(from, to)) return false;
  let x = from.x,
    y = from.y;
  const dx = Math.abs(to.x - x),
    dy = -Math.abs(to.y - y),
    sx = x < to.x ? 1 : -1,
    sy = y < to.y ? 1 : -1;
  let error = dx + dy;
  while (x !== to.x || y !== to.y) {
    const doubled = error * 2;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
    if ((x !== to.x || y !== to.y) && !canWalk(x, y)) return false;
  }
  return true;
}
