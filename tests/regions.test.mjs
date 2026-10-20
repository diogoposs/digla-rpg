import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDTH, HEIGHT, SPAWN, WELL, STOVE } from '../public/js/config.js';
import {
  FISHING_SPOTS,
  regionAt,
  tileAt,
  walkable,
  houses,
  houseAt,
  houseDoor,
} from '../public/js/world/map.js';
import { nearWater } from '../public/js/game/fishing-rules.js';
import { TOWN_POINTS } from '../public/js/game/town-rules.js';
import { MINIMAP_MARKERS } from '../public/js/game/minimap.js';
import { regionalPoint, floorOf } from '../public/js/world/elevation.js';
import { MOB_DEFINITIONS } from '../public/js/game/world-rules.js';

function reachableTiles() {
  const queue = [{ ...SPAWN }];
  const visited = new Set([`${SPAWN.x},${SPAWN.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const x = point.x + dx;
      const y = point.y + dy;
      const key = `${x},${y}`;
      if (visited.has(key) || !walkable(x, y)) continue;
      visited.add(key);
      queue.push({ x, y });
    }
  }
  return visited;
}

test('mundo ampliado preserva a vila e distingue terrenos de fogo e costa', () => {
  assert.equal(WIDTH, 192);
  assert.equal(HEIGHT, 168);
  assert.equal(walkable(SPAWN.x, SPAWN.y), true);
  assert.equal(walkable(WELL.x, WELL.y), false);
  assert.equal(walkable(STOVE.x, STOVE.y), false);
  assert.equal(tileAt(44, 31), 'water');
  assert.equal(walkable(23, 18), false);
  assert.equal(walkable(24, 18), true);
  const fire = regionalPoint('fire', { x: 33, y: 59 }),
    water = regionalPoint('water', { x: 92, y: 44 });
  assert.equal(regionAt(fire.x, fire.y), 'fire');
  assert.equal(regionAt(water.x, water.y), 'water');
  assert.equal(tileAt(fire.x, fire.y), 'lava');
  assert.equal(walkable(fire.x, fire.y), false);
  assert.equal(tileAt(water.x, water.y), 'water');
  assert.equal(walkable(water.x, water.y), false);
  assert.equal(walkable(WIDTH, HEIGHT), false);
});

test('estradas conectam o spawn a todos os novos grupos de mobs e às margens de pesca', () => {
  const reachable = reachableTiles();
  for (const {
    spawn: { x, y },
  } of Object.values(MOB_DEFINITIONS).filter((mob) => floorOf(mob.spawn) === 0))
    assert.equal(reachable.has(`${x},${y}`), true, `Mob isolado em ${x},${y}`);
  for (const spot of FISHING_SPOTS) {
    assert.equal(nearWater(spot), true, `${spot.name} precisa ter água ao lado`);
    assert.equal(reachable.has(`${spot.x},${spot.y}`), true, `${spot.name} está isolado`);
  }
});

test('comerciantes e banco bloqueiam somente seus tiles com acesso pelos quatro lados', () => {
  const reachable = reachableTiles();
  for (const point of Object.values(TOWN_POINTS)) {
    assert.equal(walkable(point.x, point.y), false);
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ])
      assert.equal(
        reachable.has(`${point.x + dx},${point.y + dy}`),
        true,
        `Acesso a ${point.name}`,
      );
  }
});

test('minimapa identifica pesca, templo, fogão, alimentos, equipamentos e banco', () => {
  for (const type of ['fishing', 'healing', 'stove', 'food', 'gear', 'bank'])
    assert.ok(MINIMAP_MARKERS.some((marker) => marker.type === type));
  for (const marker of MINIMAP_MARKERS) {
    assert.ok(marker.x > 0 && marker.x < WIDTH);
    assert.ok(marker.y > 0 && marker.y < HEIGHT);
    assert.ok(marker.name.length > 0);
  }
});

test('três casas têm portas acessíveis, paredes e destinos em interiores separados', () => {
  const reachable = reachableTiles();
  const destinations = [TOWN_POINTS.food, TOWN_POINTS.gear, STOVE];
  assert.equal(new Set(destinations.map((point) => houseAt(point.x, point.y))).size, 3);
  for (const house of houses) {
    const door = houseDoor(house);
    assert.equal(reachable.has(`${door.x},${door.y}`), true);
    assert.equal(walkable(house.x, house.y), false);
  }
  for (const point of destinations)
    assert.ok(
      [...reachable].some((key) => {
        const [x, y] = key.split(',').map(Number);
        return Math.max(Math.abs(x - point.x), Math.abs(y - point.y)) === 1;
      }),
    );
});
