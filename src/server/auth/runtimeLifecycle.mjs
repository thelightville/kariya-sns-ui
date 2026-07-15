const STATE = Symbol.for("kariya.ksns.auth-runtime-lifecycle.v1");

export function installAuthRuntimeShutdown(composition, processObject = process) {
  if (!composition || typeof composition.close !== "function") {
    throw new TypeError("production composition close boundary is required");
  }
  if (processObject[STATE]) return processObject[STATE];
  let closing;
  const close = () => {
    closing ??= Promise.resolve(composition.close()).catch(() => {});
    return closing;
  };
  processObject.once("SIGTERM", close);
  processObject.once("SIGINT", close);
  const installed = Object.freeze({ close });
  processObject[STATE] = installed;
  return installed;
}
