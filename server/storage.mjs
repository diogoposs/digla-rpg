import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';

// Único arquivo que lê/grava o banco. Mantém o formato das contas da versão anterior.
export async function openAccountStore(directory) {
  await mkdir(directory, { recursive: true });
  const databasePath = path.join(directory, 'accounts.json');
  let accounts = Object.create(null);
  try {
    accounts = Object.assign(accounts, JSON.parse(await readFile(databasePath, 'utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let pendingSave = Promise.resolve();
  return {
    accounts,
    save() {
      const snapshot = JSON.stringify(accounts, null, 2);
      pendingSave = pendingSave
        .catch(() => {})
        .then(async () => {
          await writeFile(databasePath + '.tmp', snapshot, { mode: 0o600 });
          await rename(databasePath + '.tmp', databasePath);
        });
      return pendingSave;
    },
  };
}

// One atomic document commits inventories and the shared world together, without a database.
// Legacy accounts.json is read once and left untouched as a private migration backup.
export async function readLocalDocument(directory) {
  const filename = path.join(directory, 'game.json');
  let document;
  try {
    document = JSON.parse(await readFile(filename, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    let accounts = {};
    try {
      accounts = JSON.parse(await readFile(path.join(directory, 'accounts.json'), 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    document = { schema: 1, accounts, world: {} };
  }
  if (
    document.schema !== 1 ||
    !document.accounts ||
    !document.world ||
    typeof document.accounts !== 'object' ||
    typeof document.world !== 'object' ||
    Array.isArray(document.accounts) ||
    Array.isArray(document.world)
  )
    throw new Error('Formato do salvamento multiplayer inválido.');
  return document;
}

export async function openMultiplayerStore(directory) {
  await mkdir(directory, { recursive: true });
  const filename = path.join(directory, 'game.json');
  const document = await readLocalDocument(directory);
  const accounts = Object.assign(Object.create(null), document.accounts),
    sharedWorld = document.world;
  let pending = Promise.resolve();
  return {
    backend: 'json',
    accounts,
    sharedWorld,
    save() {
      const snapshot = JSON.stringify({ schema: 1, accounts, world: sharedWorld });
      pending = pending
        .catch(() => {})
        .then(async () => {
          await writeFile(filename + '.tmp', snapshot, { mode: 0o600 });
          await rename(filename + '.tmp', filename);
        });
      return pending;
    },
    async close() {
      await pending;
    },
  };
}

export async function openGameStore({
  directory,
  connectionString = process.env.DATABASE_URL,
  onFatal,
} = {}) {
  if (!connectionString) return openMultiplayerStore(directory);
  const { openPostgresStore } = await import('./postgres.mjs');
  // A configured but unavailable database must never fall back to temporary files.
  return openPostgresStore({ directory, connectionString, onFatal });
}
