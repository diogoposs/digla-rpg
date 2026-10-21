// Servidor multiplayer: PostgreSQL com DATABASE_URL, JSON privado no uso local.
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openGameStore } from './server/storage.mjs';
import { createAccountApi } from './server/api.mjs';
import { reply, servePublic } from './server/http.mjs';
import { hostingConfig } from './server/hosting.mjs';
import { GAME_VERSION } from './public/js/config.js';

const root = path.dirname(fileURLToPath(import.meta.url));
let server,
  handleApi,
  shuttingDown = false;
const store = await openGameStore({
  directory: process.env.DIGLA_DATA_DIR || path.join(root, 'data'),
  onFatal(error) {
    console.error(error.message);
    void shutdown(true);
  },
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
const hosting = hostingConfig();
handleApi = createAccountApi({
  ...hosting,
  ...store,
  temporarySaves: store.backend === 'postgres' ? false : hosting.temporarySaves,
});
// Persist normalized accounts/world before advertising readiness.
await store.save().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz' && ['GET', 'HEAD'].includes(req.method))
      reply(res, store.healthy === false || shuttingDown ? 503 : 200, {
        status: store.healthy === false || shuttingDown ? 'unavailable' : 'ok',
        gameVersion: GAME_VERSION,
      });
    else if (shuttingDown)
      reply(res, 503, { error: 'Servidor reiniciando. Reconecte em instantes.' });
    else if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await servePublic(req, res, url.pathname, path.join(root, 'public'));
  } catch (error) {
    console.error(error.message);
    if (!res.headersSent)
      reply(res, error.status || 500, {
        error: error.status ? error.message : 'Não foi possível concluir. Tente novamente.',
      });
    else res.end();
  }
});
const port = Number(process.env.PORT || 3000);
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.listen(port, process.env.HOST || '0.0.0.0', () =>
  console.log('Digla RPG disponível em http://localhost:' + server.address().port),
);

async function shutdown(failed = false) {
  if (shuttingDown) return;
  shuttingDown = true;
  const timeout = setTimeout(() => process.exit(1), 20000).unref();
  try {
    await handleApi?.close();
    await store.close();
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
  } catch {
    failed = true;
  }
  clearTimeout(timeout);
  process.exit(failed ? 1 : 0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
