-- Only the Node server connects to these private tables. No browser database API.
CREATE TABLE IF NOT EXISTS digla_world (
  id smallint PRIMARY KEY CHECK (id = 1),
  schema_version integer NOT NULL CHECK (schema_version = 1),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  owner_id uuid NOT NULL,
  revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digla_accounts (
  account_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
