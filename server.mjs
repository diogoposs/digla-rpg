// Inicia o servidor local. Regras das contas estão em server/api.mjs.
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openAccountStore } from './server/storage.mjs';
import { createAccountApi } from './server/api.mjs';
import { reply, servePublic } from './server/http.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const store = await openAccountStore(process.env.DIGLA_DATA_DIR || path.join(root, 'data'));
const handleApi = createAccountApi(store);
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
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
server.listen(port, '127.0.0.1', () =>
  console.log('Digla RPG disponível em http://localhost:' + server.address().port),
);
