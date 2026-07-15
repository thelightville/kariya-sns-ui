import { createCloudMtlsClient } from "./cloudMtlsClient.mjs";
import { createNodePostgresPool, assertAuthSchemaHead } from "./nodePostgresPool.mjs";
import { createPostgresTransactionStore } from "./postgresTransactionStore.mjs";
import { createRegionalEnvelopeKeyProvider } from "./regionalEnvelopeKeyProvider.mjs";
import { createAesGcmTransactionCipher } from "./transactionCrypto.mjs";
import { createAuthRuntime } from "./runtimeComposition.mjs";

function gatedPort(ready, target, methods) {
  return Object.freeze(
    Object.fromEntries(
      methods.map((method) => [
        method,
        async (...args) => {
          await ready;
          return target[method](...args);
        },
      ])
    )
  );
}

export function createProductionAuthComposition(
  config,
  {
    pool = createNodePostgresPool(config),
    keyProvider = createRegionalEnvelopeKeyProvider({
      region: config.region,
      keyResource: config.kms_key_resource,
    }),
    cloud = createCloudMtlsClient(config),
  } = {}
) {
  const store = createPostgresTransactionStore(pool);
  const cipher = createAesGcmTransactionCipher(keyProvider);
  const ready = Promise.all([
    assertAuthSchemaHead(pool, config.schema_head),
    keyProvider.assertReady(),
    cloud.assertReady(),
  ]).then(() => undefined);

  const gatedStore = gatedPort(ready, store, [
    "create",
    "markRegistered",
    "reserveCallback",
    "releaseReservation",
    "markRedeemSent",
    "complete",
    "failTerminal",
    "expire",
    "purgeTerminal",
  ]);
  const gatedCipher = gatedPort(ready, cipher, ["seal", "open"]);
  const gatedCloud = gatedPort(ready, cloud, [
    "register",
    "redeem",
    "revoke",
    "logout",
  ]);
  const introspector = gatedPort(ready, cloud, ["introspect"]);
  const runtime = createAuthRuntime({
    store: gatedStore,
    cipher: gatedCipher,
    cloud: gatedCloud,
    introspector,
  });

  let closed = false;
  return Object.freeze({
    runtime,
    ready,
    async close() {
      if (closed) return;
      closed = true;
      await Promise.allSettled([cloud.close(), keyProvider.close(), pool.end()]);
    },
  });
}
