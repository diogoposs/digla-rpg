// Compatibility contract for the isolated-world API factory; production uses server.mjs.
import http from 'node:http';
import path from 'node:path';
import { openAccountStore } from '../../server/storage.mjs';
import { createAccountApi } from '../../server/api.mjs';
import { reply, servePublic } from '../../server/http.mjs';
const store = await openAccountStore(process.env.DIGLA_DATA_DIR);
const api = createAccountApi(store);
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else await servePublic(req, res, url.pathname, path.resolve('public'));
  } catch (error) {
    reply(res, error.status || 500, { error: error.message });
  }
});
server.listen(Number(process.env.PORT || 0), '127.0.0.1', () =>
  console.log('http://localhost:' + server.address().port),
);
