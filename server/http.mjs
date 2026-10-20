import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function reply(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(data));
}

export async function readJSON(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw Object.assign(new Error('Dados muito grandes.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw Object.assign(new Error('Dados inválidos.'), { status: 400 });
  }
}

// Só public/ é servido. server/, data/ e testes nunca ficam acessíveis pela URL.
export async function servePublic(req, res, pathname, publicRoot) {
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return reply(res, 405, { error: 'Método não permitido.' });
  const requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const filename = path.resolve(publicRoot, '.' + requested);
  const relative = path.relative(publicRoot, filename);
  const allowed =
    requested === '/index.html' ||
    requested === '/app.js' ||
    requested === '/style.css' ||
    (requested.startsWith('/js/') && requested.endsWith('.js')) ||
    (requested.startsWith('/styles/') && requested.endsWith('.css'));
  if (!allowed || relative.startsWith('..') || path.isAbsolute(relative))
    return reply(res, 404, { error: 'Não encontrado.' });
  let content;
  try {
    content = await readFile(filename);
  } catch (error) {
    if (error.code === 'ENOENT') return reply(res, 404, { error: 'Não encontrado.' });
    throw error;
  }
  const extension = path.extname(filename);
  const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[extension];
  res.writeHead(200, {
    'Content-Type': `${type}; charset=utf-8`,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
  });
  res.end(req.method === 'HEAD' ? undefined : content);
}
