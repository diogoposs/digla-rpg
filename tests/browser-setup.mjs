import { spawn } from 'node:child_process';

export default async function setup() {
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
