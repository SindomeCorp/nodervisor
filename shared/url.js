const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Normalizes the provided value into a safe http(s) URL string.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeSafeUrl(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (!SAFE_URL_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Determines whether the provided value is a safe http(s) URL.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSafeUrl(value) {
  return normalizeSafeUrl(value) !== null;
}

/**
 * Ensures that the provided value is a safe http(s) URL and returns the
 * normalized string. Throws an error if the value is unsafe.
 *
 * @param {unknown} value
 * @param {string} [message]
 * @returns {string}
 */
export function assertSafeUrl(value, message = 'URL must be a valid http(s) URL.') {
  const normalized = normalizeSafeUrl(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

export const safeUrlProtocols = SAFE_URL_PROTOCOLS;
