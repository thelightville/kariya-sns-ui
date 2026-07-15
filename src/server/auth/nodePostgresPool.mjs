import { readFileSync } from "node:fs";

import pg from "pg";

import { AUTH_SCHEMA_HEAD } from "./productionConfig.mjs";

const { Pool } = pg;

function fail() {
  throw new Error("cloud_auth_runtime_unavailable");
}

export function createNodePostgresPool(config, { PoolClass = Pool } = {}) {
  if (!config || config.schema_head !== AUTH_SCHEMA_HEAD) fail();
  let ca;
  try {
    ca = readFileSync(config.database_ca_path, "utf8");
  } catch {
    fail();
  }
  if (!ca.includes("BEGIN CERTIFICATE")) fail();
  return new PoolClass({
    connectionString: config.database_url,
    ssl: { ca, rejectUnauthorized: true, minVersion: "TLSv1.3" },
    max: 10,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: false,
    options: "-c statement_timeout=3000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=5000",
  });
}

export async function assertAuthSchemaHead(pool, expected = AUTH_SCHEMA_HEAD) {
  try {
    const result = await pool.query(
      "SELECT schema_head FROM ksns_auth_schema_head WHERE singleton = TRUE"
    );
    if (result.rowCount !== 1 || result.rows[0]?.schema_head !== expected) fail();
  } catch {
    fail();
  }
}
