import { z } from 'zod';

export function requiredTrimmedString(field) {
  return z.preprocess(
    (value) => (value === undefined ? value : String(value)),
    z
      .string({ required_error: `${field} is required.` })
      .trim()
      .min(1, `${field} is required.`)
  );
}

export function normalizedEmailSchema(field) {
  return z.preprocess(
    (value) => (value === undefined ? value : String(value)),
    z
      .string({ required_error: `${field} is required.` })
      .trim()
      .min(1, `${field} is required.`)
      .email('Invalid email address.')
  );
}
