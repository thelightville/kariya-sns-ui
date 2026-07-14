export const DEFAULT_NEXT_PATH = "/overview";

const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f-\u009f\\]/u;
const ENCODED_SEPARATOR = /%(?:2f|5c)/i;
const VALIDATION_ORIGIN = "https://ksns.invalid";

function isSingleSlashPath(value) {
  return value.startsWith("/") && !value.startsWith("//");
}

export function safeNextPath(value) {
  if (typeof value !== "string" || !isSingleSlashPath(value)) {
    return DEFAULT_NEXT_PATH;
  }

  let decoded = value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (
      !isSingleSlashPath(decoded) ||
      CONTROL_OR_BACKSLASH.test(decoded) ||
      ENCODED_SEPARATOR.test(decoded)
    ) {
      return DEFAULT_NEXT_PATH;
    }

    let nextDecoded;
    try {
      nextDecoded = decodeURIComponent(decoded);
    } catch {
      return DEFAULT_NEXT_PATH;
    }

    if (nextDecoded === decoded) {
      break;
    }
    decoded = nextDecoded;
  }

  if (
    !isSingleSlashPath(decoded) ||
    CONTROL_OR_BACKSLASH.test(decoded) ||
    ENCODED_SEPARATOR.test(decoded)
  ) {
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
