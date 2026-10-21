import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { postgresConfig, openPostgresStore } from '../../server/postgres.mjs';

// PGlite runs PostgreSQL's engine locally. CI uses an actual PostgreSQL service
// over the pg wire protocol, in an isolated schema that this fixture creates.
export async function databaseFixture(t) {
  const statements = [],
    stores = [];
  let connectionString = null;
  let driver,
    cleanup,
    queryHook = null;
  if (process.env.TEST_DATABASE_URL) {
    const admin = new Pool(postgresConfig(process.env.TEST_DATABASE_URL));
    const schema = 'digla_test_' + randomUUID().replaceAll('-', '');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const connection = new URL(process.env.TEST_DATABASE_URL);
    connection.searchParams.set('options', '-c search_path=' + schema);
    connectionString = connection.toString();
    const pg = new Pool({
      ...postgresConfig(process.env.TEST_DATABASE_URL),
      options: '-c search_path=' + schema,
    });
    driver = { connect: () => pg.connect() };
    cleanup = async () => {
      await pg.end();
      // Only drop the fresh, generated test schema; never existing game tables.
      if (!/^digla_test_[0-9a-f]{32}$/.test(schema)) throw new Error('Invalid test schema');
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite();
    let queue = Promise.resolve();
    driver = {
      async connect() {
        const previous = queue;
        let unlock;
        queue = new Promise((resolve) => {
          unlock = resolve;
        });
        await previous;
        return {
          query: async (text, values = []) =>
            text.includes(';') && !values.length
              ? (await db.exec(text), { rows: [] })
              : db.query(text, values),
          release: unlock,
        };
      },
    };
    cleanup = () => db.close();
  }
  const pool = {
    async connect() {
      const client = await driver.connect();
      return {
        async query(text, values) {
          statements.push(text);
          if (queryHook) await queryHook(text, values);
          return client.query(text, values);
        },
        release: () => client.release(),
      };
    },
    async query(text, values) {
      const client = await this.connect();
      try {
        return await client.query(text, values);
      } finally {
        client.release();
      }
    },
  };
  t.after(async () => {
    queryHook = null;
    await Promise.allSettled(stores.map((s) => s.close()));
    await cleanup();
  });
  return {
    connectionString,
    pool,
    statements,
    hook(fn) {
      queryHook = fn;
    },
    async open(options = {}) {
      const store = await openPostgresStore({ pool, flushIntervalMs: 60000, ...options });
      stores.push(store);
      return store;
    },
  };
}
