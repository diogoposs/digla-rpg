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
