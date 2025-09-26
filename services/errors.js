const SENSITIVE_HEADER_KEYS = new Set(['authorization', 'proxy-authorization']);
const AUTHORIZATION_PATTERN = /(authorization\s*:\s*)([^\r\n]+)/gi;

export class ServiceError extends Error {
  constructor(message, statusCode = 500, details) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function sanitizeErrorDetails(details) {
  if (details === undefined) {
    return undefined;
  }

  const sanitized = sanitizeValue(details, new WeakSet());

  if (sanitized === undefined) {
    return undefined;
  }

  if (sanitized === null) {
    return null;
  }

  if (Array.isArray(sanitized)) {
    return sanitized.length > 0 ? sanitized : undefined;
  }

  if (typeof sanitized === 'object') {
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  return sanitized;
}

function sanitizeValue(value, seen) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value.replace(AUTHORIZATION_PATTERN, (_, prefix) => `${prefix}[REDACTED]`);
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, seen));
  }

  const sanitized = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === 'request' || normalizedKey === 'response') {
      continue;
    }

    if (SENSITIVE_HEADER_KEYS.has(normalizedKey)) {
      sanitized[key] = redactValue(entry);
      continue;
    }

    const sanitizedEntry = sanitizeValue(entry, seen);
    if (sanitizedEntry !== undefined) {
      sanitized[key] = sanitizedEntry;
    }
  }

  return sanitized;
}

function redactValue(value) {
  if (Array.isArray(value)) {
    return value.map(() => '[REDACTED]');
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).map((key) => [key, '[REDACTED]']));
  }

  return '[REDACTED]';
}
