import { expect } from '@playwright/test';
import { createWorldService } from '../../server/world.mjs';
import { ensureProgress, publicProgress } from '../../public/js/game/progression.js';
import { walkable } from '../../public/js/world/map.js';
import { createFishingService } from '../../server/fishing.mjs';
import { createCookingService } from '../../server/cooking.mjs';
import { floorOf, validFloorMove } from '../../public/js/world/elevation.js';
import { isolateMobs, orcPoint } from './combat.mjs';
export const setupCombat = (
  page,
  position = orcPoint(),
  health = 100,
  random = () => 0.99999,
  extras = {},
) => setup(page, position, health, random, { ...extras, isolateMobs: ['orc'] });
export async function setup(page, position, health = 95, random = () => 0.99999, extras = {}) {
  // These fixtures exercise production game services through mocked HTTP routes.
  // Authentication has separate real-server tests; avoid exhausting its IP rate limit.
  const identity = {
    username: `Mundo ${Date.now().toString().slice(-8)}`,
    outfit: { type: 'citizen', head: 1, body: 10, legs: 15, feet: 15 },
  };
  const account = ensureProgress({
    position,
    inventory: [
      { id: 'raw_salmon', quantity: 3 },
      { id: 'roasted_salmon', quantity: 2 },
      { id: 'burnt_salmon', quantity: 1 },
    ],
    ...extras,
  });
  account.vitals.health = health;
  if (extras.isolateMobs) isolateMobs(account, extras.isolateMobs);
  const service = createWorldService({ save: async () => {}, random }),
    events = [];
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: {
        username: identity.username,
        outfit: identity.outfit,
        position: account.position,
        ...publicProgress(account),
      },
    }),
  );
  await page.route('**/api/world/*', async (route) => {
    const action = route.request().url().split('/').at(-1);
    const result =
      action === 'tick'
        ? await service.tick(account)
        : action === 'attack'
          ? await service.attack(account, route.request().postDataJSON())
          : action === 'cast'
            ? await service.cast(account, route.request().postDataJSON())
            : action === 'utility'
              ? await service.utility(account, route.request().postDataJSON())
              : action === 'adventure'
                ? await service.adventure(account, route.request().postDataJSON())
                : action === 'loot'
                  ? service.loot(account, route.request().postDataJSON())
                  : action === 'heal'
                    ? await service.heal(account)
                    : service.stop(account, route.request().postDataJSON());
    events.push(...(result.events || []));
    await route.fulfill({ json: result });
  });
  await page.route('**/api/items/*', async (route) => {
    const action = route.request().url().split('/').at(-1),
      data = route.request().postDataJSON();
    await route.fulfill({ json: await service[action](account, data) });
  });
  await page.route('**/api/town/*', async (route) => {
    const action = route.request().url().split('/').at(-1);
    const method = action === 'open' ? 'townOpen' : action;
    await route.fulfill({ json: await service[method](account, route.request().postDataJSON()) });
  });
  for (const [kind, activity] of [
    ['fishing', createFishingService({ save: async () => {}, random })],
    ['cooking', createCookingService({ save: async () => {}, random })],
  ])
    await page.route(`**/api/${kind}/*`, async (route) => {
      const method = route.request().url().split('/').at(-1),
        data = route.request().postDataJSON();
      const result =
        method === 'tick'
          ? await activity.tick(account)
          : method === 'start'
            ? kind === 'fishing'
              ? activity.start(account)
              : activity.start(account, data.recipe, data.quantity)
            : method === 'press'
              ? activity.press(account, data.challengeId)
              : method === 'open'
                ? activity.open(account)
                : activity.stop(account);
      await route.fulfill({ json: result });
    });
  await page.route('**/api/position', async (route) => {
    const data = route.request().postDataJSON(),
      { x, y } = data;
    if (
      walkable(x, y, floorOf(data)) &&
      validFloorMove(account.position, data) &&
      service.canMove(account, x, y, floorOf(data))
    ) {
      service.moved(account, data);
      account.position = data;
      await route.fulfill({
        json: {
          ok: true,
          worldRevision: account.worldRevision,
          utility: account.utility,
          serverNow: Date.now(),
        },
      });
    } else
      await route.fulfill({
        status: 409,
        json: { error: 'Posição ocupada.', position: account.position, ...publicProgress(account) },
      });
  });
  await page.goto('/');
  await expect(page.locator('#game')).toBeVisible();
  return { account, events };
}
