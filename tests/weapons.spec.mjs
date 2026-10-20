import { test, expect } from '@playwright/test';
import { setup, setupCombat } from './helpers/world.mjs';
import { orcPoint } from './helpers/combat.mjs';
import { ORC_SPAWN } from '../public/js/game/world-rules.js';

test('loot equipa cajado, botão esquerdo não ataca, elementos animam e ataque continua ao andar', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { account, events } = await setupCombat(page, orcPoint(0, 3), 100, () => 0, {
    inventory: [],
    corpse: {
      id: 'staff-corpse',
      ...orcPoint(0, 4),
      slots: [{ id: 'staff', quantity: 1 }, null, null, null, null, null],
    },
  });
  const box = await page.locator('#world').boundingBox();
  await page
    .locator('#world')
    .click({ button: 'right', position: { x: box.width / 2, y: box.height / 2 + 64 } });
  await expect(page.locator('#loot-panel')).toBeVisible();
  await page
    .locator('#loot-grid')
    .getByRole('listitem', { name: 'Cajado × 1', exact: true })
    .dragTo(page.locator('[data-equipment="sword"]'));
  await expect(page.locator('[data-equipment="sword"]')).toHaveAttribute(
    'aria-label',
    'Cajado — equipado',
  );
  expect(account.corpse.slots.filter(Boolean)).toHaveLength(0);
  await page.getByRole('button', { name: 'Fechar loot', exact: true }).click();
  const hp = account.orc.health;
  await page.locator('#orc-label').click();
  expect(account.orc.health).toBe(hp);
  await page.locator('[data-equipment="sword"]').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#staff-panel')).toBeVisible();
  await page.locator('#orc-label').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('.element-hit.element-fire').last()).toBeVisible();
  await expect(page.locator('.damage-number.element-fire').last()).toHaveCSS(
    'color',
    'rgb(255, 80, 43)',
  );
  for (const [element, color] of [
    ['water', 'rgb(76, 175, 255)'],
    ['lightning', 'rgb(255, 228, 93)'],
  ]) {
    await page.locator('#element-' + element).click();
    await expect(page.locator('#element-' + element)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.element-hit.element-' + element).last()).toBeVisible();
    await expect(page.locator('.damage-number.element-' + element).last()).toHaveCSS(
      'color',
      color,
    );
    await page.screenshot({
      path: `test-results/screenshots/staff-${element}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Fechar cajado', exact: true }).click();
  const hits = events.filter((event) => event.type === 'player-hit').length;
  await page.keyboard.down('ArrowDown');
  await expect.poll(() => account.position.y).toBe(ORC_SPAWN.y + 4);
  await page.keyboard.up('ArrowDown');
  await expect
    .poll(() => events.filter((event) => event.type === 'player-hit').length)
    .toBeGreaterThan(hits);
  await page.locator('#toggle-skills').click();
  await expect.poll(() => account.skills.magic.xp).toBeGreaterThan(0);
  await expect(page.locator('#magic-xp')).not.toHaveText('0 / 100 XP');
  expect(errors).toEqual([]);
});

test('clique caminha contornando poço e arrasto distante aproxima antes de recolher', async ({
  page,
}) => {
  const { account } = await setup(page, { x: 29, y: 27 }, 100, () => 0.9999, {
    inventory: [],
    groundItems: [{ id: 'far-sword', itemId: 'sword', quantity: 1, x: 33, y: 27 }],
  });
  let box = await page.locator('#world').boundingBox();
  await page
    .locator('#world')
    .click({ position: { x: box.width / 2 + 128, y: box.height / 2 - 128 } });
  await expect(page.locator('#coordinates')).toHaveText('X: 31 · Y: 25');
  await page
    .getByRole('button', { name: 'Mochila — botão direito para abrir', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  const floor = page.getByRole('img', { name: 'Espada × 1 no chão', exact: true });
  await floor.dragTo(page.locator('#inventory-grid [data-slot="0"]'));
  await expect(page.locator('#inventory-grid [data-slot="0"]')).toHaveAttribute(
    'data-item',
    'sword',
  );
  expect(
    Math.max(Math.abs(account.position.x - 33), Math.abs(account.position.y - 27)),
  ).toBeLessThanOrEqual(1);
  expect(account.groundItems).toHaveLength(0);
  await page
    .locator('#inventory-grid [data-slot="0"]')
    .dragTo(page.locator('[data-equipment="sword"]'));
  await expect(page.locator('[data-equipment="sword"]')).toHaveAttribute(
    'aria-label',
    'Espada — equipado',
  );
});

test('espada ganha Combate e arrastar item distante começa caminhada já no dragstart', async ({
  page,
}) => {
  const { account } = await setupCombat(page, orcPoint(), 100, () => 0, {
    inventory: [{ id: 'sword', quantity: 1 }],
    groundItems: [{ id: 'far-fish', itemId: 'raw_salmon', quantity: 2, ...orcPoint(4, 1) }],
  });
  const fish = page.getByRole('img', { name: 'Salmão cru × 2 no chão', exact: true });
  const rect = await fish.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 12, rect.y + rect.height / 2, { steps: 3 });
  await expect.poll(() => account.position.x).toBeGreaterThan(ORC_SPAWN.x);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  // Uma segunda navegação permite voltar e lutar sem depender do caminho anterior.
  await page
    .getByRole('button', { name: 'Mochila — botão direito para abrir', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await page.locator('#inventory-grid [data-slot="0"]').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('[data-equipment="sword"]')).toHaveAttribute('data-item', 'sword');
  await page.locator('#orc-label').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect.poll(() => account.skills.combat.xp, { timeout: 8000 }).toBeGreaterThan(0);
  expect(account.skills.magic.xp).toBe(0);
});
