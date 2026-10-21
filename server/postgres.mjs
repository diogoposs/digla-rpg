import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { readLocalDocument } from './storage.mjs';

const unavailable = () =>
  Object.assign(
    new Error('O banco de dados está indisponível. Reconecte após o servidor reiniciar.'),
    { status: 503 },
  );
const fenced = () =>
  Object.assign(new Error('Outra instância assumiu o mundo. Reconecte ao servidor atualizado.'), {
    status: 503,
  });

export function postgresConfig(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.pathname.slice(1)
    )
      throw new Error();
  } catch {
    throw new Error('DATABASE_URL deve ser uma conexão PostgreSQL válida.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  // Do not let sslmode=require replace certificate verification in pg's parser.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  url.searchParams.set('sslmode', local ? 'disable' : 'verify-full');
  return {
    connectionString: url.toString(),
    enableChannelBinding: !local,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
    statement_timeout: 15000,
    query_timeout: 20000,
    application_name: 'digla-rpg',
  };
}

// Private account rows and one world row commit together. The in-memory game
// remains authoritative; PostgreSQL is the durable checkpoint, not the game loop.
export async function openPostgresStore({
  directory,
  connectionString,
  pool: providedPool,
  flushIntervalMs = 1000,
  onFatal = () => {},
}) {
  const pool = providedPool || new Pool(postgresConfig(connectionString));
  const owner = randomUUID();
  const context = new AsyncLocalStorage();
  let accounts, sharedWorld, lastAccounts, lastWorld;
  let failed = null,
    opened = false,
    closed = false;
  let sequence = 0,
    pending = null,
    inFlight = null,
    timer = null;
  const waiters = [];
  function fail(error) {
    if (!failed) {
      failed = error;
      clearTimeout(timer);
      pending = null;
      for (const w of waiters.splice(0)) w.reject(error);
      if (opened && !closed) onFatal(error);
    }
    return failed;
  }
  const idleError = () => fail(unavailable());
  pool.on?.('error', idleError);
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Transaction-scoped locks work with Neon's pooled connection URL.
    await client.query('SELECT pg_advisory_xact_lock(1684630123)');
    await client.query(await readFile(new URL('./db/schema.sql', import.meta.url), 'utf8'));
    let row = (
      await client.query('SELECT schema_version, state FROM digla_world WHERE id = 1 FOR UPDATE')
    ).rows[0];
    if (!row) {
      if (
        Number((await client.query('SELECT count(*) AS count FROM digla_accounts')).rows[0].count)
      )
        throw new Error(
          'Banco inconsistente: contas sem mundo. Restaure o salvamento antes de iniciar.',
        );
      const initial = directory
        ? await readLocalDocument(directory)
        : { schema: 1, accounts: {}, world: {} };
      await client.query(
        'INSERT INTO digla_world (id, schema_version, state, owner_id) VALUES (1, 1, $1::jsonb, $2::uuid)',
        [JSON.stringify(initial.world), owner],
      );
      for (const [key, value] of Object.entries(initial.accounts))
        await client.query(
          'INSERT INTO digla_accounts (account_key, data) VALUES ($1, $2::jsonb)',
          [key, JSON.stringify(value)],
        );
      row = { schema_version: 1, state: initial.world };
    } else {
      if (row.schema_version !== 1) throw new Error('Versão do banco incompatível.');
      // A new deployment fences the old process instead of letting two copies
      // overwrite the same world during a Render deployment handoff.
      await client.query('UPDATE digla_world SET owner_id = $1::uuid WHERE id = 1', [owner]);
    }
    const rows = (await client.query('SELECT account_key, data FROM digla_accounts')).rows;
    accounts = Object.assign(
      Object.create(null),
      Object.fromEntries(rows.map((r) => [r.account_key, r.data])),
    );
    sharedWorld = row.state;
    lastAccounts = new Map(rows.map((r) => [r.account_key, JSON.stringify(r.data)]));
    lastWorld = serializeWorld(sharedWorld);
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client?.query('ROLLBACK');
    } catch {}
    client?.release();
    client = null;
    pool.off?.('error', idleError);
    if (!providedPool) await pool.end().catch(() => {});
    throw new Error(
      'Não foi possível iniciar o PostgreSQL. Verifique DATABASE_URL, acesso ao banco e permissões de criação de tabelas.',
    );
  } finally {
    client?.release();
  }
  opened = true;

  function serializeWorld(world) {
    const { worldRevision, ...state } = world;
    return JSON.stringify(state);
  }
  function snapshot() {
    return {
      seq: ++sequence,
      accounts: new Map(Object.entries(accounts).map(([key, a]) => [key, JSON.stringify(a)])),
      world: serializeWorld(sharedWorld),
    };
  }
  function assertWritable() {
    if (failed) throw failed;
    if (closed) throw unavailable();
  }
  async function commit(work) {
    const changed = [...work.accounts].filter(([key, data]) => lastAccounts.get(key) !== data);
    const removed = [...lastAccounts.keys()].filter((key) => !work.accounts.has(key));
    const worldChanged = work.world !== lastWorld;
    if (!changed.length && !removed.length && !worldChanged) return;
    let c;
    try {
      c = await pool.connect();
      await c.query('BEGIN');
      const row = (await c.query('SELECT owner_id FROM digla_world WHERE id = 1 FOR UPDATE'))
        .rows[0];
      if (row?.owner_id !== owner) throw fenced();
      for (const [key, data] of changed)
        await c.query(
          'INSERT INTO digla_accounts (account_key, data) VALUES ($1, $2::jsonb) ON CONFLICT (account_key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
          [key, data],
        );
      for (const key of removed)
        await c.query('DELETE FROM digla_accounts WHERE account_key = $1', [key]);
      if (worldChanged)
        await c.query(
          'UPDATE digla_world SET state = $1::jsonb, revision = revision + 1, updated_at = now() WHERE id = 1',
          [work.world],
        );
      else
        await c.query(
          'UPDATE digla_world SET revision = revision + 1, updated_at = now() WHERE id = 1',
        );
      await c.query('COMMIT');
      lastAccounts = work.accounts;
      lastWorld = work.world;
    } catch (error) {
      try {
        await c?.query('ROLLBACK');
      } catch {}
      // Stop accepting actions on a failed commit: don't confirm an in-memory
      // trade and silently fall back to an ephemeral JSON file.
      throw fail(error.status === 503 ? error : unavailable());
    } finally {
      c?.release();
    }
  }
  function schedule() {
    if (timer || failed || closed) return;
    timer = setTimeout(() => {
      timer = null;
      void flush().catch(() => {});
    }, flushIntervalMs).unref();
  }
  async function flush() {
    clearTimeout(timer);
    timer = null;
    if (failed) throw failed;
    if (inFlight) {
      await inFlight;
      if (pending) return flush();
      return;
    }
    if (!pending) return;
    const work = pending;
    pending = null;
    inFlight = commit(work)
      .then(() => {
        for (let i = waiters.length - 1; i >= 0; i--)
          if (waiters[i].seq <= work.seq) waiters.splice(i, 1)[0].resolve();
      })
      .finally(() => {
        inFlight = null;
      });
    await inFlight;
    if (pending) {
      if (waiters.length) return flush();
      schedule();
    }
  }
  function save(options = {}) {
    try {
      assertWritable();
    } catch (error) {
      return Promise.reject(error);
    }
    pending = snapshot();
    if (!options.force && (options.defer || context.getStore()?.defer)) {
      schedule();
      return Promise.resolve();
    }
    const result = new Promise((resolve, reject) =>
      waiters.push({ seq: pending.seq, resolve, reject }),
    );
    void flush().catch(() => {});
    return result;
  }
  save.background = (fn) =>
    context.run({ defer: true }, () => {
      assertWritable();
      return fn();
    });
  return {
    backend: 'postgres',
    accounts,
    sharedWorld,
    save,
    flush,
    assertWritable,
    get healthy() {
      return !failed && !closed;
    },
    async close() {
      if (closed) return;
      clearTimeout(timer);
      try {
        await flush();
      } finally {
        closed = true;
        pool.off?.('error', idleError);
        if (!providedPool) await pool.end();
      }
    },
  };
}
