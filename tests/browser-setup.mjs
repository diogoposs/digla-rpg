import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { scryptSync, randomBytes } from 'node:crypto';
import { DEFAULT_OUTFIT } from '../public/js/config.js';

export default async function setup() {
  // Fixtures only, in the ignored browser-data directory; never read the user's data/.
  const directory = new URL('../test-results/browser-data/', import.meta.url);
  await mkdir(directory, { recursive: true });
  let doc;
  try {
    doc = JSON.parse(await readFile(new URL('game.json', directory), 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    doc = { schema: 1, accounts: {}, world: {} };
  }
  for (const [name, items] of [
    [
      'Net Alpha',
      [
        { id: 'sword', quantity: 1 },
        { id: 'mana_potion', quantity: 2 },
      ],
    ],
    [
      'Net Beta',
      [
        { id: 'gold_coin', quantity: 10 },
        { id: 'health_potion', quantity: 3 },
      ],
    ],
  ]) {
    const salt = randomBytes(16).toString('hex');
    doc.accounts[name.toLowerCase()] = {
      username: name,
      salt,
      digest: scryptSync('test-multiplayer-only', salt, 64).toString('hex'),
      outfit: DEFAULT_OUTFIT,
      position: { x: 29, y: 27 },
      inventory: items,
    };
  }
  await writeFile(new URL('game.json', directory), JSON.stringify(doc));
  // Spawn Node directly: this also allows reliable teardown on Windows.
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: '3001', DIGLA_DATA_DIR: './test-results/browser-data' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('O servidor de teste não iniciou.'));
    }, 10000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.stdout.on('data', (data) => {
      if (data.toString().includes('localhost:3001')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on('data', (data) => process.stderr.write(data));
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Servidor de teste encerrou: ${code}`));
    });
  });
  return async () => {
    if (child.exitCode === null)
      await new Promise((resolve) => {
        child.once('exit', resolve);
        child.kill();
      });
  };
}
