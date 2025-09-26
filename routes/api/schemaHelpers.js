import { z } from 'zod';

/**
 * @param {string} field
 * @param {{ max?: number }} [options]
 */
export function requiredTrimmedString(field, options) {
  const { max } = options ?? {};

  let schema = z
    .string({ required_error: `${field} is required.` })
    .trim()
    .min(1, `${field} is required.`);

  if (typeof max === 'number') {
    schema = schema.max(max, `${field} must be at most ${max} characters.`);
  }

  return z.preprocess((value) => (value === undefined ? value : String(value)), schema);
}

export function normalizedEmailSchema(field) {
  return z.preprocess(
    (value) => (value === undefined ? value : String(value)),
    z
      .string({ required_error: `${field} is required.` })
      .trim()
      .min(1, `${field} is required.`)
      .max(128, `${field} must be at most 128 characters.`)
      .email('Invalid email address.')
  );
}
