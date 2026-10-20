import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('jornada completa: conta, outfits, movimento, câmera, colisão e novo login', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Seu lugar é aqui.' })).toBeVisible();
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({ path: 'test-results/screenshots/login.png', fullPage: true });
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  const username = `Heroi ${Date.now().toString().slice(-8)}`;
  await page.getByLabel('Nome do aventureiro').fill(username);
  await page.getByLabel('Senha', { exact: false }).first().fill('aventura-123');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.locator('#password')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar senha' }).click();
  await page.getByRole('button', { name: 'Escolher meu personagem' }).click();
  for (const name of ['Mage', 'Warrior', 'Citizen']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  await page.getByRole('button', { name: 'Rosa', exact: true }).click();
  await page.getByRole('button', { name: 'Corpo', exact: true }).click();
  await page.getByRole('button', { name: 'Azul', exact: true }).click();
  await page.getByRole('button', { name: 'Girar personagem à esquerda' }).click();
  await page.getByRole('button', { name: 'Girar personagem à direita' }).click();
  await page.screenshot({ path: 'test-results/screenshots/outfit.png', fullPage: true });
  await page.getByRole('button', { name: 'Começar minha jornada' }).click();
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#player-label')).toHaveText(username);
  const account = await page.evaluate(async () => await (await fetch('/api/session')).json());
  expect(account.outfit.head).toBe(13);
  expect(account.outfit.body).toBe(7);
  const coords = page.locator('#coordinates');
  await expect(coords).toHaveText('X: 29 · Y: 27');
  async function step(key, x, y) {
    await page.keyboard.down(key);
    await expect(coords).toHaveText(`X: ${x} · Y: ${y}`, { timeout: 2000 });
    await page.keyboard.up(key);
    // Let interpolation finish before examining the camera or the next tile.
    await page.waitForTimeout(180);
  }
  async function pinkCenter() {
    return await page.locator('#world').evaluate((canvas) => {
      const ctx = canvas.getContext('2d'),
        { width: w, height: h } = canvas,
        data = ctx.getImageData(0, 0, w, h).data;
      let x = 0,
        y = 0,
        count = 0;
      for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) {
          const i = (yy * w + xx) * 4;
          if (data[i] === 216 && data[i + 1] === 137 && data[i + 2] === 140) {
            x += xx;
            y += yy;
            count++;
          }
        }
      return { x: x / count, y: y / count, count, w, h };
    });
  }
  const before = await pinkCenter();
  expect(before.count).toBeGreaterThan(10);
  await step('ArrowLeft', 28, 27);
  const after = await pinkCenter();
  expect(Math.abs(before.x - after.x)).toBeLessThan(2);
  expect(Math.abs(before.y - after.y)).toBeLessThan(2);
  await step('ArrowRight', 29, 27);
  await step('ArrowUp', 29, 26);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowUp');
  await expect(coords).toHaveText('X: 29 · Y: 26'); // A fonte central bloqueia o passo.
  await page.keyboard.down('w');
  await page.waitForTimeout(200);
  await page.keyboard.up('w');
  await expect(coords).toHaveText('X: 29 · Y: 26');
  await step('ArrowDown', 29, 27);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(200);
  const stopped = await coords.textContent();
  await page.waitForTimeout(400);
  await expect(coords).toHaveText(stopped);
  await page.screenshot({ path: 'test-results/screenshots/world.png', fullPage: true });
  await page.reload();
  await expect(page.locator('#game')).toBeVisible();
  await expect(coords).toHaveText(stopped);
  await page.getByRole('button', { name: 'Sair do mundo' }).click();
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar no mundo', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Nome ou senha incorretos.');
  await page.locator('#password').fill('aventura-123');
  await page.getByRole('button', { name: 'Entrar no mundo', exact: true }).click();
  await expect(page.locator('#game')).toBeVisible();
  await expect(coords).toHaveText(stopped);
  // A lost or expired session must return to login instead of trapping the player.
  await page.context().clearCookies();
  const previousX = Number(/X: (\d+)/.exec(stopped)[1]);
  await step('ArrowLeft', previousX - 1, 27);
  await expect(page.locator('#menu')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#auth-error')).toHaveText(
    'Sua sessão terminou. Entre novamente para continuar.',
  );
  expect(errors).toEqual([]);
});

test('menu e personalização se adaptam a uma tela estreita', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  await page.locator('#username').fill('Pequeno heroi');
  await page.locator('#password').fill('aventura-123');
  await page.getByRole('button', { name: 'Escolher meu personagem' }).click();
  await expect(page.getByRole('button', { name: 'Começar minha jornada' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/screenshots/mobile.png', fullPage: true });
});

test.describe('arte e texto em tela com escala de 125%', () => {
  test.use({ deviceScaleFactor: 1.25 });

  test('nome usa resolução nativa e os outfits têm quatro sentidos e três poses', async ({
    page,
  }) => {
    const username = `Nitidez ${Date.now().toString().slice(-8)}`;
    const response = await page.request.post('/api/register', {
      data: {
        username,
        password: 'aventura-123',
        outfit: { type: 'warrior', head: 14, body: 2, legs: 5, feet: 15 },
      },
    });
    expect(response.status()).toBe(201);
    await page.goto('/');
    await expect(page.locator('#game')).toBeVisible();
    await expect(page.locator('#player-label')).toHaveText(username);
    const size = await page.locator('#world').evaluate((target) => {
      const box = target.getBoundingClientRect();
      return { actual: target.width, expected: Math.round(box.width * devicePixelRatio) };
    });
    expect(size.actual).toBe(size.expected);
    await expect(page.locator('#player-label')).toHaveCSS('font-size', '12px');
    const label = await page.locator('#player-label').boundingBox();
    const viewport = await page.locator('#world').boundingBox();
    expect(Math.abs(label.x + label.width / 2 - viewport.x - viewport.width / 2)).toBeLessThan(2);
    await page.screenshot({ path: 'test-results/screenshots/dpi-125.png', fullPage: true });

    // Prancha de inspeção: cada outfit nas quatro direções, parado e em dois passos.
    const atlas = await page.evaluate(async () => {
      const { drawAvatar } = await import('/js/graphics/character.js');
      const target = document.createElement('canvas');
      target.width = 960;
      target.height = 432;
      const ctx = target.getContext('2d');
      ctx.fillStyle = '#222924';
      ctx.fillRect(0, 0, 960, 432);
      ctx.font = '12px Verdana';
      ctx.textAlign = 'center';
      ['citizen', 'mage', 'warrior'].forEach((type, row) => {
        const outfit = {
          type,
          head: row === 1 ? 7 : row === 2 ? 14 : 1,
          body: row === 1 ? 7 : row === 2 ? 2 : 10,
          legs: 5,
          feet: 15,
        };
        ['down', 'left', 'up', 'right'].forEach((direction, col) => {
          for (let step = 0; step < 3; step++) {
            const x = (col * 3 + step) * 80 + 40,
              y = row * 144;
            drawAvatar(ctx, outfit, direction, x, y + 112, 2, step);
            ctx.fillStyle = '#d9d3b8';
            ctx.fillText(`${type} ${step}`, x, y + 131);
          }
        });
      });
      return target.toDataURL('image/png').split(',')[1];
    });
    await writeFile(
      'test-results/screenshots/outfits-directions.png',
      Buffer.from(atlas, 'base64'),
    );
  });
});
