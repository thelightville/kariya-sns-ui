export const DEFAULT_NEXT_PATH = "/overview";

const MAX_DECODE_DEPTH = 8;
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f-\u009f\\]/u;
const ENCODED_SEPARATOR = /%(?:2f|5c)/i;
const VALIDATION_ORIGIN = "https://ksns.invalid";

function isSingleSlashPath(value) {
  return value.startsWith("/") && !value.startsWith("//");
}

function isUnsafeLevel(value) {
  return (
    !isSingleSlashPath(value) ||
    CONTROL_OR_BACKSLASH.test(value) ||
    ENCODED_SEPARATOR.test(value)
  );
}

export function safeNextPath(value) {
  if (typeof value !== "string" || isUnsafeLevel(value)) {
    return DEFAULT_NEXT_PATH;
  }

  let decoded = value;
  let stabilized = false;

  for (let depth = 0; depth < MAX_DECODE_DEPTH; depth += 1) {
    if (isUnsafeLevel(decoded)) {
      return DEFAULT_NEXT_PATH;
    }

    let nextDecoded;
    try {
      nextDecoded = decodeURIComponent(decoded);
    } catch {
      return DEFAULT_NEXT_PATH;
    }

    if (nextDecoded === decoded) {
      stabilized = true;
      break;
    }
    decoded = nextDecoded;
  }

  if (!stabilized || isUnsafeLevel(decoded)) {
    return DEFAULT_NEXT_PATH;
  }

  try {
    const target = new URL(value, VALIDATION_ORIGIN);
    if (target.origin !== VALIDATION_ORIGIN || !isSingleSlashPath(target.pathname)) {
      return DEFAULT_NEXT_PATH;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return DEFAULT_NEXT_PATH;
  }
}
