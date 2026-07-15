import { createCloudExchangeService } from "./cloudExchangeService.mjs";
import {
  unavailableCloudExchangeClient,
  unavailableSessionIntrospector,
  unavailableTransactionCipher,
  unavailableTransactionStore,
} from "./ports.mjs";
import { createSessionAuthority } from "./sessionAuthority.mjs";
import {
  loadProductionAuthConfig,
  productionRuntimeRequested,
} from "./productionConfig.mjs";
import { createProductionAuthComposition } from "./productionRuntime.mjs";
import { installAuthRuntimeShutdown } from "./runtimeLifecycle.mjs";

export const AUTH_COOKIE_NAME = "sns_token";

const REGION_BY_ORIGIN = Object.freeze({
  "https://sns.kariya.ng": "ng",
  "https://sns.kariya.ca": "ca",
});

export function configuredRegion(configuredOrigin) {
  const region = REGION_BY_ORIGIN[configuredOrigin];
  if (!region) throw new Error("cloud_auth_runtime_unavailable");
  return region;
}

export function hostLocalSessionCookie(value, maxAge) {
  if (
    typeof value !== "string" ||
    !Number.isSafeInteger(maxAge) ||
    maxAge < 1 ||
    maxAge > 899
  ) {
    throw new TypeError("invalid host-local session cookie");
  }
  return {
    name: AUTH_COOKIE_NAME,
    value,
    options: Object.freeze({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    }),
  };
}

export function clearedHostLocalSessionCookie() {
  return {
    name: AUTH_COOKIE_NAME,
    value: "",
    options: Object.freeze({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    }),
  };
}

export function createAuthRuntime({
  store,
  cipher,
  cloud,
  introspector,
  clock,
  random,
  uuid,
}) {
  return Object.freeze({
    exchange: createCloudExchangeService({
      store,
      cipher,
      cloud,
      clock,
      random,
      uuid,
    }),
    sessions: createSessionAuthority({ introspector, cloud }),
  });
}

function unavailableRuntime() {
  const cloud = unavailableCloudExchangeClient();
  return createAuthRuntime({
    store: unavailableTransactionStore(),
    cipher: unavailableTransactionCipher(),
    cloud,
    introspector: unavailableSessionIntrospector(),
  });
}

export function selectAuthRuntime(
  env = process.env,
  { productionFactory = createProductionAuthComposition } = {}
) {
  if (!productionRuntimeRequested(env)) {
    return Object.freeze({ runtime: unavailableRuntime(), composition: null });
  }
  try {
    const config = loadProductionAuthConfig(env);
    const composition = productionFactory(config, { runtimeFactory: createAuthRuntime });
    installAuthRuntimeShutdown(composition);
    return Object.freeze({ runtime: composition.runtime, composition });
  } catch {
    return Object.freeze({ runtime: unavailableRuntime(), composition: null });
  }
}

const selected = selectAuthRuntime();
export const authRuntime = selected.runtime;
export const authRuntimeComposition = selected.composition;
